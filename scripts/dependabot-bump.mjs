// Keeps every open Dependabot PR one patch version above `main` (Spec 010, RF-18 to RF-26).
// Twin of web's scripts/dependabot-bump.mjs (plan D1): fix both copies together.
//
// For each open PR authored by Dependabot (or only `--pr N`), it compares the PR's
// `package.json` version with `main`'s. When it is not `main` + 1 patch, it rebuilds the top of
// the branch through GitHub's API, so every commit is signed and verified, as the `main` ruleset
// requires (plan D5):
//   1. trailing bump commits are dropped by moving the branch back to the last other commit,
//      which keeps Dependabot's own signed commits untouched;
//   2. when the branch is behind, `main` is merged into it (a merge commit made by GitHub);
//   3. one `chore(release): Bump version to vX.Y.Z` commit is added with createCommitOnBranch.
// Each write expects the head it read, so a concurrent push is never overwritten. If a step
// fails, the branch goes back to its original head (when nobody pushed meanwhile), a failed
// `Version bump` commit status is set and a comment asks for `@dependabot recreate`.
//
// It only calls `gh`: nothing from the PR is checked out, installed or executed (plan D4), and
// `package.json` is edited as text (RF-19).
//
// Environment: GH_TOKEN (the bump App's token) and GITHUB_REPOSITORY (owner/repo).
//
// Usage: node scripts/dependabot-bump.mjs [--pr <number>]
import { execFileSync } from 'node:child_process';

const STATUS_CONTEXT = 'Version bump';
const DEPENDABOT_LOGINS = new Set(['dependabot[bot]', 'app/dependabot', 'dependabot']);
const BUMP_SUBJECT = /^chore\(release\): Bump version to v\d+\.\d+\.\d+$/;
// The top-level "version" of a Prettier-formatted package.json is indented by two spaces.
const VERSION_LINE = /^( {2}"version": ")[^"]*(")/m;

/** `X.Y.Z` → `X.Y.(Z+1)`. */
export function nextPatch(version) {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
  if (!parts) throw new Error(`${JSON.stringify(version)} is not an X.Y.Z version`);
  return `${parts[1]}.${parts[2]}.${Number(parts[3]) + 1}`;
}

/** The package.json text with only its top-level version value replaced. */
export function setVersion(text, version) {
  if (!VERSION_LINE.test(text)) throw new Error('package.json has no top-level "version" line');
  return text.replace(VERSION_LINE, `$1${version}$2`);
}

export const isBumpCommit = (subject) => BUMP_SUBJECT.test(subject);

/** `skip` (not Dependabot's), `noop` (already main + 1 patch) or `rebump`. */
export function decide({ author, prVersion, mainVersion }) {
  if (!DEPENDABOT_LOGINS.has(author)) return 'skip';
  return prVersion === nextPatch(mainVersion) ? 'noop' : 'rebump';
}

/**
 * The commit the branch goes back to (the last one that is not a bump) and how many trailing
 * bump commits that drops. A bump commit with other commits after it is never dropped, since
 * that would also drop them.
 */
export function trailingBump(commits) {
  let index = commits.length - 1;
  while (index >= 0 && isBumpCommit(commits[index].subject)) index--;
  if (index < 0) throw new Error('the branch has no Dependabot commit to keep');
  if (commits.slice(0, index).some((commit) => isBumpCommit(commit.subject))) {
    throw new Error('a commit was added after the version bump; it is left for the owner');
  }
  return { keep: commits[index].sha, dropped: commits.length - 1 - index };
}

/**
 * Rebuilds the top of the PR branch through `api` (see githubApi) with one bump commit to
 * `version`; `headSha` is the head the caller read. Returns the new head.
 */
export async function rebump(api, pr, headSha, version) {
  const moved = () => new Error('the branch moved while bumping it, left for the next run');
  if ((await api.head()) !== headSha) throw moved();
  const commits = await api.commits();
  if (commits.at(-1)?.sha !== headSha) throw moved();
  const { keep } = trailingBump(commits);

  let current = headSha;
  try {
    if (keep !== current) {
      await api.updateRef(keep);
      current = keep;
    }
    if ((await api.behindBy(current)) > 0) {
      try {
        current = await api.mergeMain();
      } catch (error) {
        throw error.conflict ? new Error('the branch does not merge with main') : error;
      }
    }
    const contents = setVersion(await api.file(current), version);
    return await api.createCommit({
      expectedHead: current,
      message: `chore(release): Bump version to v${version}`,
      contents,
    });
  } catch (error) {
    // Undo only what this run did: if someone else pushed meanwhile, their head stays.
    const head = await api.head();
    if (head !== current) throw moved();
    if (current !== headSha) await api.updateRef(headSha);
    throw error;
  }
}

const run = (command, args, options = {}) =>
  execFileSync(command, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options });

const gh = (...args) => run('gh', args);

/** The GitHub calls rebump needs, for one PR branch. */
export function githubApi(repo, pr) {
  const branch = pr.headRefName;
  const head = () =>
    gh('api', `repos/${repo}/git/ref/heads/${branch}`, '--jq', '.object.sha').trim();
  return {
    head: async () => head(),
    commits: async () =>
      gh(
        'api',
        '--paginate',
        `repos/${repo}/pulls/${pr.number}/commits`,
        '--jq',
        '.[] | {sha, subject: (.commit.message | split("\n")[0])}',
      )
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
    file: async (ref) =>
      Buffer.from(
        gh(
          'api',
          `repos/${repo}/contents/package.json?ref=${encodeURIComponent(ref)}`,
          '--jq',
          '.content',
        ),
        'base64',
      ).toString('utf8'),
    behindBy: async (sha) =>
      Number(gh('api', `repos/${repo}/compare/main...${sha}`, '--jq', '.behind_by').trim()),
    updateRef: async (sha) => {
      gh(
        'api',
        '-X',
        'PATCH',
        `repos/${repo}/git/refs/heads/${branch}`,
        '-f',
        `sha=${sha}`,
        '-F',
        'force=true',
      );
    },
    mergeMain: async () => {
      try {
        const sha = gh(
          'api',
          `repos/${repo}/merges`,
          '-f',
          `base=${branch}`,
          '-f',
          'head=main',
          '-f',
          `commit_message=Merge branch 'main' into ${branch}`,
          '--jq',
          '.sha',
        ).trim();
        // 204: nothing to merge after all.
        return sha || head();
      } catch (error) {
        if (String(error.stderr).includes('HTTP 409')) {
          throw Object.assign(new Error('merge conflict'), { conflict: true });
        }
        throw error;
      }
    },
    createCommit: async ({ expectedHead, message, contents }) => {
      const body = {
        query:
          'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }',
        variables: {
          input: {
            branch: { repositoryNameWithOwner: repo, branchName: branch },
            expectedHeadOid: expectedHead,
            message: { headline: message },
            fileChanges: {
              additions: [
                { path: 'package.json', contents: Buffer.from(contents).toString('base64') },
              ],
            },
          },
        },
      };
      return run(
        'gh',
        ['api', 'graphql', '--input', '-', '--jq', '.data.createCommitOnBranch.commit.oid'],
        {
          input: JSON.stringify(body),
        },
      ).trim();
    },
  };
}

function openPullRequests(repo, number) {
  const fields = 'number,headRefName,headRefOid,author,state,isCrossRepository';
  const list = number
    ? [JSON.parse(gh('pr', 'view', String(number), '--repo', repo, '--json', fields))]
    : JSON.parse(
        gh(
          'pr',
          'list',
          '--repo',
          repo,
          '--author',
          'app/dependabot',
          '--state',
          'open',
          '--base',
          'main',
          '--limit',
          '100',
          '--json',
          fields,
        ),
      );
  return list.filter((pr) => pr.state === 'OPEN' && !pr.isCrossRepository);
}

function statusOf(repo, sha) {
  const statuses = JSON.parse(gh('api', `repos/${repo}/commits/${sha}/status`)).statuses ?? [];
  return statuses.find((status) => status.context === STATUS_CONTEXT)?.state;
}

function setStatus(repo, sha, state, description) {
  gh(
    'api',
    `repos/${repo}/statuses/${sha}`,
    '-f',
    `state=${state}`,
    '-f',
    `context=${STATUS_CONTEXT}`,
    '-f',
    `description=${description}`,
  );
}

async function processPullRequest(repo, pr) {
  const api = githubApi(repo, pr);
  const head = await api.head();
  if (head !== pr.headRefOid)
    return `#${pr.number}: the branch moved while reading it, left for the next run`;

  const mainVersion = JSON.parse(await api.file('main')).version;
  const prVersion = JSON.parse(await api.file(head)).version;
  const action = decide({ author: pr.author.login, prVersion, mainVersion });
  if (action === 'skip') return `#${pr.number}: not authored by Dependabot, skipped`;

  const version = nextPatch(mainVersion);
  if (action === 'noop') {
    if (statusOf(repo, head) !== 'success') setStatus(repo, head, 'success', `Version ${version}`);
    return `#${pr.number}: already at ${version}`;
  }

  try {
    const pushed = await rebump(api, pr, head, version);
    setStatus(repo, pushed, 'success', `Version ${version}`);
    return `#${pr.number}: ${prVersion} → ${version}`;
  } catch (error) {
    const message = String(error.message).split('\n')[0];
    // One failed status and one comment per head, not one per run.
    if (statusOf(repo, head) !== 'failure') {
      setStatus(repo, head, 'failure', `Cannot bump to ${version}: ${message}`.slice(0, 140));
      gh(
        'pr',
        'comment',
        String(pr.number),
        '--repo',
        repo,
        '--body',
        `The version bump to \`v${version}\` could not be applied: ${message}. ` +
          'Comment `@dependabot recreate` to rebuild this PR on top of `main`; the bump is added again afterwards.',
      );
    }
    throw new Error(`#${pr.number}: ${message}`);
  }
}

async function main(argv) {
  const prIndex = argv.indexOf('--pr');
  const number = prIndex >= 0 ? Number(argv[prIndex + 1]) : undefined;
  if (prIndex >= 0 && !Number.isInteger(number)) throw new Error('--pr needs a PR number');
  const { GH_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env;
  if (!token || !repo) throw new Error('GH_TOKEN and GITHUB_REPOSITORY are required');

  const pullRequests = openPullRequests(repo, number);
  console.log(`${pullRequests.length} open Dependabot PR(s)`);
  let failures = 0;
  for (const pr of pullRequests) {
    try {
      console.log(await processPullRequest(repo, pr));
    } catch (error) {
      failures++;
      console.error(String(error.message).split('\n')[0]);
    }
  }
  return failures > 0 ? 1 : 0;
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(`dependabot-bump: ${String(error.message).split('\n')[0]}`);
    process.exitCode = 1;
  }
}
