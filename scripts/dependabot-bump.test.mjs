// @vitest-environment node
// Unit tests of dependabot-bump.mjs (Spec 010, plan U-DB-1…U-DB-15), ported from web's
// scripts/dependabot-bump.test.mjs to Vitest (plan D3). Run with `pnpm test scripts/dependabot-bump.test.mjs`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';

import {
  decide,
  isBumpCommit,
  nextPatch,
  rebump,
  setVersion,
  trailingBump,
} from './dependabot-bump.mjs';

const PACKAGE_JSON = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
const CURRENT = JSON.parse(PACKAGE_JSON).version;

describe('nextPatch', () => {
  it('U-DB-1: increases the patch number', () => {
    assert.equal(nextPatch('5.2.0'), '5.2.1');
    assert.equal(nextPatch('5.2.9'), '5.2.10');
    assert.equal(nextPatch('10.0.99'), '10.0.100');
  });

  it('U-DB-2: rejects anything that is not X.Y.Z', () => {
    for (const version of ['4.4', 'v4.4.0', '4.4.0-rc.1', '4.4.0+build', '', undefined]) {
      assert.throws(() => nextPatch(version), /not an X\.Y\.Z version/);
    }
  });
});

describe('setVersion', () => {
  it('U-DB-3: changes only the version value of package.json', () => {
    const updated = setVersion(PACKAGE_JSON, '9.9.9');
    assert.equal(JSON.parse(updated).version, '9.9.9');
    assert.equal(updated, PACKAGE_JSON.replace(`"version": "${CURRENT}"`, '"version": "9.9.9"'));
    assert.equal(updated.length, PACKAGE_JSON.length - CURRENT.length + 5);
  });

  it('U-DB-4: ignores a nested "version" key and fails without a top-level one', () => {
    const text =
      '{\n  "name": "x",\n  "version": "1.0.0",\n  "engines": {\n    "version": "2.0.0"\n  }\n}\n';
    assert.equal(
      setVersion(text, '1.0.1'),
      text.replace('"version": "1.0.0"', '"version": "1.0.1"'),
    );
    const nestedOnly = '{\n  "name": "x",\n  "engines": {\n    "version": "2.0.0"\n  }\n}\n';
    assert.throws(() => setVersion(nestedOnly, '1.0.1'), /no top-level "version"/);
  });
});

describe('decide', () => {
  it('U-DB-5: noop when the PR already has main + 1 patch', () => {
    assert.equal(
      decide({ author: 'dependabot[bot]', prVersion: '4.5.1', mainVersion: '4.5.0' }),
      'noop',
    );
  });

  it('U-DB-6: rebump when main moved to the PR version', () => {
    assert.equal(
      decide({ author: 'dependabot[bot]', prVersion: '4.5.1', mainVersion: '4.5.1' }),
      'rebump',
    );
    assert.equal(
      decide({ author: 'app/dependabot', prVersion: '4.5.1', mainVersion: '4.6.0' }),
      'rebump',
    );
  });

  it('U-DB-7: rebump when the PR has main version (bump lost on recreate)', () => {
    assert.equal(
      decide({ author: 'dependabot[bot]', prVersion: '4.5.0', mainVersion: '4.5.0' }),
      'rebump',
    );
  });

  it('U-DB-8: skip any PR not authored by Dependabot', () => {
    for (const author of [
      'mfigueroa23',
      'github-actions[bot]',
      'portfolio-version-bump[bot]',
      '',
    ]) {
      assert.equal(decide({ author, prVersion: '4.5.0', mainVersion: '4.5.0' }), 'skip');
    }
  });
});

describe('isBumpCommit', () => {
  it('U-DB-9: recognises the bump subject and nothing else', () => {
    assert.equal(isBumpCommit('chore(release): Bump version to v4.5.1'), true);
    assert.equal(isBumpCommit('chore(release): Version 5.2.0'), false);
    assert.equal(isBumpCommit('chore(release): Bump version to v4.5'), false);
    assert.equal(isBumpCommit('build(deps): bump the npm-minor-patch group with 3 updates'), false);
    assert.equal(isBumpCommit('chore(release): Bump version to v4.5.1 and more'), false);
  });
});

const pkg = (version) => `{\n  "name": "x",\n  "version": "${version}",\n  "dependencies": {}\n}\n`;
const DEP = { sha: 'dep1', subject: 'build(deps): bump dep from 1.0.0 to 2.0.0' };
const BUMP = { sha: 'bump1', subject: 'chore(release): Bump version to v1.0.1' };
const PR = { number: 7, headRefName: 'dependabot/npm/dep-2.0.0' };

/**
 * An in-memory GitHub for one PR branch: commits, the branch head, files by ref and how far the
 * branch is behind main. Every write is recorded in `calls`, and `fail` makes a write throw.
 */
function fakeApi({ commits, behindBy = 0, files = {}, fail = {} }) {
  const state = { head: commits.at(-1).sha, calls: [] };
  const api = {
    state,
    commits: async () => commits,
    head: async () => state.head,
    file: async (ref) => files[ref] ?? pkg('1.0.0'),
    behindBy: async () => behindBy,
    updateRef: async (sha) => {
      state.calls.push(['updateRef', sha]);
      if (fail.updateRef) throw new Error(fail.updateRef);
      state.head = sha;
    },
    mergeMain: async () => {
      state.calls.push(['mergeMain', state.head]);
      if (fail.mergeMain) throw Object.assign(new Error(fail.mergeMain), { conflict: true });
      state.head = 'merge1';
      return 'merge1';
    },
    createCommit: async ({ expectedHead, message, contents }) => {
      state.calls.push(['createCommit', expectedHead, message, contents]);
      if (fail.createCommit) {
        state.head = 'someone-else';
        throw new Error(fail.createCommit);
      }
      state.head = 'new1';
      return 'new1';
    },
  };
  return api;
}

describe('trailingBump', () => {
  it('U-DB-10: keeps the last non-bump commit and drops only trailing bump commits', () => {
    assert.deepEqual(trailingBump([DEP, BUMP]), { keep: 'dep1', dropped: 1 });
    assert.deepEqual(trailingBump([DEP]), { keep: 'dep1', dropped: 0 });
    assert.throws(
      () =>
        trailingBump([
          DEP,
          BUMP,
          { sha: 'own1', subject: 'build(deps): Approve the build script of x' },
        ]),
      /a commit was added after the version bump/,
    );
    assert.throws(() => trailingBump([BUMP]), /no Dependabot commit/);
    // A merge of main left by an earlier bump is kept like any other non-bump commit.
    assert.deepEqual(trailingBump([DEP, { sha: 'merge1', subject: "Merge branch 'main'" }, BUMP]), {
      keep: 'merge1',
      dropped: 1,
    });
  });
});

describe('rebump', () => {
  it('U-DB-11: drops the stale bump, merges main and adds one signed bump commit', async () => {
    const api = fakeApi({
      commits: [DEP, BUMP],
      behindBy: 2,
      files: { merge1: pkg('1.0.1') },
    });
    const sha = await rebump(api, PR, 'bump1', '1.0.2');
    assert.equal(sha, 'new1');
    assert.deepEqual(
      api.state.calls.map((call) => call.slice(0, 2)),
      [
        ['updateRef', 'dep1'],
        ['mergeMain', 'dep1'],
        ['createCommit', 'merge1'],
      ],
    );
    const [, , message, contents] = api.state.calls[2];
    assert.equal(message, 'chore(release): Bump version to v1.0.2');
    assert.equal(contents, pkg('1.0.2'));
  });

  it('U-DB-12: an up-to-date branch without a bump only gets the bump commit', async () => {
    const api = fakeApi({ commits: [DEP], behindBy: 0, files: { dep1: pkg('1.0.0') } });
    assert.equal(await rebump(api, PR, 'dep1', '1.0.1'), 'new1');
    assert.deepEqual(
      api.state.calls.map((call) => call.slice(0, 2)),
      [['createCommit', 'dep1']],
    );
  });

  it('U-DB-13: a merge conflict restores the original head and adds no commit', async () => {
    const api = fakeApi({
      commits: [DEP, BUMP],
      behindBy: 1,
      fail: { mergeMain: 'Merge conflict' },
    });
    await assert.rejects(rebump(api, PR, 'bump1', '1.0.2'), /does not merge with main/);
    assert.equal(api.state.head, 'bump1');
    assert.deepEqual(
      api.state.calls.map((call) => call[0]),
      ['updateRef', 'mergeMain', 'updateRef'],
    );
  });

  it('U-DB-14: pushes nothing when the branch moved, and never overwrites another push', async () => {
    const moved = fakeApi({ commits: [DEP, BUMP] });
    await assert.rejects(rebump(moved, PR, 'other-head', '1.0.2'), /the branch moved/);
    assert.deepEqual(moved.state.calls, []);

    const raced = fakeApi({
      commits: [DEP],
      fail: { createCommit: 'Expected branch to point to "dep1"' },
    });
    await assert.rejects(rebump(raced, PR, 'dep1', '1.0.1'), /the branch moved/);
    assert.equal(raced.state.head, 'someone-else');
    assert.deepEqual(
      raced.state.calls.map((call) => call[0]),
      ['createCommit'],
    );
  });

  it('U-DB-15: a bump commit followed by another commit is never reset', async () => {
    const api = fakeApi({
      commits: [DEP, BUMP, { sha: 'own1', subject: 'build(deps): Approve the build script of x' }],
    });
    await assert.rejects(rebump(api, PR, 'own1', '1.0.2'), /after the version bump/);
    assert.deepEqual(api.state.calls, []);
  });
});
