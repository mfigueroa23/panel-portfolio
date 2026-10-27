// @vitest-environment node
// Unit tests of sca-gate.mjs (Spec 010, plan U-SG-1…U-SG-11), ported from web's
// scripts/sca-gate.test.mjs to Vitest (plan D3). Run with `pnpm test scripts/sca-gate.test.mjs`.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { fileURLToPath } from 'node:url';

import { classify, findings, summary, validateExceptions } from './sca-gate.mjs';

const SCRIPT = fileURLToPath(new URL('./sca-gate.mjs', import.meta.url));
const TODAY = '2026-10-25';

/** A Grype match with the fields the gate reads. */
function match({
  id = 'GHSA-aaaa-bbbb-cccc',
  severity = 'High',
  state = 'fixed',
  versions = ['1.2.4'],
  related = [],
  name = 'lodash',
  version = '1.2.3',
} = {}) {
  return {
    vulnerability: { id, severity, fix: { state, versions } },
    relatedVulnerabilities: related.map((relatedId) => ({ id: relatedId })),
    artifact: { name, version },
  };
}

const exception = (overrides = {}) => ({
  id: 'GHSA-aaaa-bbbb-cccc',
  reason: 'Only reachable from the build tooling',
  expires: '2026-12-31',
  ...overrides,
});

/** Runs the CLI with the given reports and exceptions, written to a temp dir. */
function runCli({ reports, exceptions = [], extraArgs = [] }) {
  const dir = mkdtempSync(join(tmpdir(), 'sca-gate-'));
  const exceptionsFile = join(dir, 'exceptions.json');
  writeFileSync(exceptionsFile, JSON.stringify(exceptions));
  const args = [SCRIPT, '--exceptions', exceptionsFile, ...extraArgs];
  reports.forEach((report, index) => {
    const file = join(dir, `report-${index}.json`);
    if (report !== undefined) {
      writeFileSync(file, typeof report === 'string' ? report : JSON.stringify(report));
    }
    args.push('--title', `Report ${index}`, '--report', file);
  });
  const env = { ...process.env, SCA_GATE_TODAY: TODAY };
  delete env.GITHUB_STEP_SUMMARY;
  return spawnSync(process.execPath, args, { encoding: 'utf8', env });
}

describe('classify', () => {
  it('U-SG-1: a fixed High finding is blocking and the CLI exits 1', () => {
    assert.equal(classify(match(), []), 'blocking');
    assert.equal(classify(match({ severity: 'Critical' }), []), 'blocking');
    const result = runCli({ reports: [{ matches: [match()] }] });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /1 blocking/);
  });

  it('U-SG-2: a Critical finding without a fix is only reported', () => {
    assert.equal(
      classify(match({ severity: 'Critical', state: 'not-fixed', versions: [] }), []),
      'reported',
    );
    const result = runCli({
      reports: [{ matches: [match({ severity: 'Critical', state: 'not-fixed', versions: [] })] }],
    });
    assert.equal(result.status, 0);
  });

  it('U-SG-3: a fixed Medium finding is only reported', () => {
    assert.equal(classify(match({ severity: 'Medium' }), []), 'reported');
    assert.equal(runCli({ reports: [{ matches: [match({ severity: 'Medium' })] }] }).status, 0);
  });

  it('U-SG-4: a report without matches passes and says so', () => {
    const result = runCli({ reports: [{ matches: [] }] });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /No known vulnerabilities/);
  });

  it('U-SG-5: a valid exception for the advisory makes the finding excepted', () => {
    assert.equal(classify(match(), [exception()]), 'excepted');
    const result = runCli({ reports: [{ matches: [match()] }], exceptions: [exception()] });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /excepted/);
  });

  it('U-SG-6: an exception for a GHSA covers the CVE match related to it', () => {
    const cveMatch = match({ id: 'CVE-2026-1234', related: ['GHSA-aaaa-bbbb-cccc'] });
    assert.equal(classify(cveMatch, [exception()]), 'excepted');
    assert.equal(classify(cveMatch, [exception({ id: 'cve-2026-1234' })]), 'excepted');
    assert.equal(classify(cveMatch, [exception({ id: 'GHSA-zzzz-zzzz-zzzz' })]), 'blocking');
  });
});

describe('validateExceptions', () => {
  it('U-SG-7: an exception that expired yesterday is expired; one expiring today is valid', () => {
    const { valid, expired, invalid } = validateExceptions(
      [exception({ expires: '2026-10-24' }), exception({ id: 'GHSA-today', expires: TODAY })],
      TODAY,
    );
    assert.deepEqual(
      expired.map((entry) => entry.id),
      ['GHSA-aaaa-bbbb-cccc'],
    );
    assert.deepEqual(
      valid.map((entry) => entry.id),
      ['GHSA-today'],
    );
    assert.equal(invalid.length, 0);

    const result = runCli({
      reports: [{ matches: [match()] }],
      exceptions: [exception({ expires: '2026-10-24' })],
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Expired exceptions/);
    assert.match(result.stdout, /GHSA-aaaa-bbbb-cccc/);
  });

  it('U-SG-8: an entry without a reason is invalid, named, and fails with no findings', () => {
    for (const reason of [undefined, '', '   ']) {
      const { invalid } = validateExceptions([exception({ reason })], TODAY);
      assert.equal(invalid.length, 1);
      assert.match(invalid[0].problem, /reason/);
    }
    const result = runCli({
      reports: [{ matches: [] }],
      exceptions: [exception({ reason: '' })],
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Invalid exceptions/);
    assert.match(result.stdout, /#1 \(GHSA-aaaa-bbbb-cccc\)/);
  });

  it('U-SG-9: an entry without an id or with a non-ISO expiry is invalid', () => {
    const { invalid } = validateExceptions(
      [
        exception({ id: undefined }),
        exception({ expires: '31/12/2026' }),
        exception({ expires: '2026-02-30' }),
        'GHSA-not-an-object',
      ],
      TODAY,
    );
    assert.deepEqual(
      invalid.map((entry) => entry.problem),
      [
        'missing id',
        'expires is not a YYYY-MM-DD date',
        'expires is not a YYYY-MM-DD date',
        'not an object',
      ],
    );
  });
});

describe('summary', () => {
  it('U-SG-10: one row per finding with every column, and one section per report', () => {
    const rows = findings(
      {
        matches: [
          match(),
          match(), // the same advisory reported twice by Grype is one row
          match({ id: 'GHSA-low', severity: 'Low', name: 'a|b', versions: [] }),
        ],
      },
      [],
    );
    assert.equal(rows.length, 2);
    const text = summary(
      [
        { title: 'Lockfile', rows },
        { title: 'Image', rows: [] },
      ],
      { expired: [], invalid: [] },
    );
    assert.match(text, /\| Package \| Installed \| Fixed in \| Severity \| Advisory \| Status \|/);
    assert.match(
      text,
      /\| lodash \| 1\.2\.3 \| 1\.2\.4 \| High \| GHSA-aaaa-bbbb-cccc \| blocking \|/,
    );
    assert.match(text, /\| a\\\|b \| 1\.2\.3 \| — \| Low \| GHSA-low \| reported \|/);
    assert.match(text, /### Lockfile/);
    assert.match(text, /### Image\n\nNo known vulnerabilities/);

    const result = runCli({ reports: [{ matches: [match()] }, { matches: [] }] });
    assert.match(result.stdout, /### Report 0/);
    assert.match(result.stdout, /### Report 1/);
  });

  it('U-SG-11: a missing or malformed report exits 1 with a one-line error', () => {
    for (const report of [undefined, '{ not json', '{"matches": 3}']) {
      const result = runCli({ reports: [report] });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /^sca-gate: .+\n$/);
      assert.doesNotMatch(result.stderr, /\n\s+at /);
    }
  });
});
