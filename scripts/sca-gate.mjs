// Decides whether Grype's findings block a pull request or a release (Spec 010, plan D7).
// Twin of web's scripts/sca-gate.mjs (plan D1): fix both copies together.
//
// A finding blocks when it is Critical or High, has a fixed version and no valid exception
// covers it. Findings without a fix or below High are only reported. Exceptions live in
// `.github/sca-exceptions.json`: `[{ "id": "GHSA-…", "reason": "…", "expires": "YYYY-MM-DD" }]`.
// An entry is valid through its expiry day (UTC); an expired entry no longer covers its finding,
// and an incomplete one fails the gate. An exception matches the advisory's id or any related
// id, so a GHSA entry covers the CVE Grype reports for it.
//
// The table goes to the job summary (`$GITHUB_STEP_SUMMARY`) and to stdout.
//
// Usage: node scripts/sca-gate.mjs [--exceptions <file>] [--title <text>] --report <grype.json> …
// `--title` names the report that follows it. Exit 1 on a blocking finding, an invalid
// exception or an unreadable report.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const BLOCKING_SEVERITIES = new Set(['critical', 'high']);
const DEFAULT_EXCEPTIONS = '.github/sca-exceptions.json';

/** Splits the exception entries into valid, expired and invalid ones (`today` is YYYY-MM-DD). */
export function validateExceptions(entries, today) {
  const result = { valid: [], expired: [], invalid: [] };
  entries.forEach((entry, index) => {
    const problem = entryProblem(entry);
    if (problem) result.invalid.push({ index, entry, problem });
    else if (entry.expires < today) result.expired.push(entry);
    else result.valid.push(entry);
  });
  return result;
}

function entryProblem(entry) {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return 'not an object';
  if (!nonEmpty(entry.id)) return 'missing id';
  if (!nonEmpty(entry.reason)) return 'missing reason';
  if (!isIsoDate(entry.expires)) return 'expires is not a YYYY-MM-DD date';
  return null;
}

const nonEmpty = (value) => typeof value === 'string' && value.trim() !== '';

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // Date rolls 2026-02-30 over to March, so the round trip rejects impossible days.
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** `blocking`, `excepted` or `reported` for one Grype match, given the valid exceptions. */
export function classify(match, exceptions) {
  const ids = advisoryIds(match);
  if (exceptions.some((entry) => ids.has(entry.id.trim().toLowerCase()))) return 'excepted';
  const severity = String(match.vulnerability?.severity ?? '').toLowerCase();
  const fixed = match.vulnerability?.fix?.state === 'fixed';
  return BLOCKING_SEVERITIES.has(severity) && fixed ? 'blocking' : 'reported';
}

function advisoryIds(match) {
  const ids = [match.vulnerability?.id, ...(match.relatedVulnerabilities ?? []).map((v) => v.id)];
  return new Set(ids.filter(Boolean).map((id) => id.toLowerCase()));
}

/** The table rows of a Grype report, one per package, version and advisory. */
export function findings(report, exceptions) {
  const rows = new Map();
  for (const match of report.matches) {
    const row = {
      package: match.artifact?.name ?? '?',
      installed: match.artifact?.version ?? '?',
      fixedIn: (match.vulnerability?.fix?.versions ?? []).join(', ') || '—',
      severity: match.vulnerability?.severity ?? 'Unknown',
      advisory: match.vulnerability?.id ?? '?',
      status: classify(match, exceptions),
    };
    rows.set(`${row.package}@${row.installed}#${row.advisory}`, row);
  }
  return [...rows.values()];
}

/** The Markdown summary of every report plus the expired and invalid exceptions. */
export function summary(sections, { expired, invalid }) {
  const lines = ['## Software composition analysis', ''];
  for (const { title, rows } of sections) {
    lines.push(`### ${title}`, '');
    if (rows.length === 0) {
      lines.push('No known vulnerabilities.', '');
      continue;
    }
    lines.push('| Package | Installed | Fixed in | Severity | Advisory | Status |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const row of rows) {
      const cells = [
        row.package,
        row.installed,
        row.fixedIn,
        row.severity,
        row.advisory,
        row.status,
      ];
      lines.push(`| ${cells.map(cell).join(' | ')} |`);
    }
    const count = (status) => rows.filter((row) => row.status === status).length;
    lines.push(
      '',
      `${count('blocking')} blocking, ${count('excepted')} excepted, ${count('reported')} reported.`,
      '',
    );
  }
  if (expired.length > 0) {
    lines.push('### Expired exceptions', '');
    for (const entry of expired)
      lines.push(`- ${entry.id} (expired ${entry.expires}): ${entry.reason}`);
    lines.push('');
  }
  if (invalid.length > 0) {
    lines.push('### Invalid exceptions', '');
    for (const { index, entry, problem } of invalid) {
      const id = nonEmpty(entry?.id) ? ` (${entry.id})` : '';
      lines.push(`- #${index + 1}${id}: ${problem}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// Markdown table cells cannot hold pipes or line breaks.
const cell = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');

function parseArgs(argv) {
  const options = { exceptions: DEFAULT_EXCEPTIONS, reports: [] };
  let title;
  for (let i = 0; i < argv.length; i++) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (value === undefined) throw new Error(`${flag} needs a value`);
    if (flag === '--exceptions') options.exceptions = value;
    else if (flag === '--title') title = value;
    else if (flag === '--report') {
      options.reports.push({ file: value, title: title ?? value });
      title = undefined;
    } else throw new Error(`unknown option ${flag}`);
    i++;
  }
  if (options.reports.length === 0) throw new Error('at least one --report is required');
  return options;
}

function readJson(file, what) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`cannot read the ${what} ${file}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`the ${what} ${file} is not valid JSON`);
  }
}

function main(argv) {
  const options = parseArgs(argv);
  const entries = existsSync(options.exceptions)
    ? readJson(options.exceptions, 'exceptions file')
    : [];
  if (!Array.isArray(entries)) throw new Error(`${options.exceptions} must hold a JSON array`);
  // SCA_GATE_TODAY pins the date in tests.
  const today = process.env.SCA_GATE_TODAY || new Date().toISOString().slice(0, 10);
  const exceptions = validateExceptions(entries, today);

  const sections = options.reports.map(({ file, title }) => {
    const report = readJson(file, 'report');
    if (!Array.isArray(report?.matches)) throw new Error(`the report ${file} has no matches array`);
    return { title, rows: findings(report, exceptions.valid) };
  });

  const text = summary(sections, exceptions);
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);

  const blocking = sections.some(({ rows }) => rows.some((row) => row.status === 'blocking'));
  return blocking || exceptions.invalid.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`sca-gate: ${error.message}`);
    process.exitCode = 1;
  }
}
