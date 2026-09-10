import { execFileSync, spawnSync } from 'node:child_process';

/** `railway up` uploads the directory it is run from, not a git ref. This repo
 *  routinely has a dozen worktrees with concurrent sessions, so the usual
 *  outcome of deploying from one is that production silently loses whatever
 *  landed on main since that worktree was cut: the build succeeds, health stays
 *  green, every page returns 200, and an hour of merged work is gone. That
 *  happened on 2026-09-09, twice. These checks make the two failure modes --
 *  a stale directory and two sessions deploying at once -- refuse instead. */

const SERVICE = 'jumbleyard';
const ENVIRONMENT = 'production';
const force = process.argv.includes('--force');

/** Resolve one directory, check that one, and upload that one, so the upload
 *  cannot disagree with what was checked.
 *
 *  Uploading the right directory is not enough on its own: `railway up` names
 *  every file in its archive relative to the directory the project was linked
 *  in, not the directory it uploads. The link lives on the root checkout, so
 *  from a worktree the whole app arrived nested under
 *  `./.claude/worktrees/<name>/`; the builder found no Dockerfile or
 *  railway.json at the top, fell back to railpack, and failed with "could not
 *  determine how to build the app". --path-as-root roots the archive at this
 *  directory instead: from the root checkout that changes nothing, and from a
 *  worktree it lays the files out exactly as a root-checkout deploy would. */
const DEPLOY_DIR = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

function fail(problem, remedy) {
  console.error(`\n  Refusing to deploy: ${problem}\n  ${remedy}\n`);
  console.error('  Pass --force to deploy anyway.\n');
  process.exit(1);
}

if (force) console.warn('\n  --force: skipping deploy safety checks.\n');
else {
  const dirty = execFileSync(
    'git',
    ['-C', DEPLOY_DIR, 'status', '--porcelain'],
    {
      encoding: 'utf8',
    },
  ).trim();
  if (dirty)
    fail(
      `the working tree has ${dirty.split('\n').length} uncommitted change(s)`,
      'Commit or stash them, so what ships matches a commit you can point at.',
    );

  try {
    execFileSync(
      'git',
      ['-C', DEPLOY_DIR, 'fetch', 'origin', 'main', '--quiet'],
      {
        stdio: 'ignore',
      },
    );
  } catch {
    fail(
      'could not reach origin to compare against main',
      'Check the network; deploying blind is how production loses work.',
    );
  }

  const inDir = (...args) =>
    execFileSync('git', ['-C', DEPLOY_DIR, ...args], {
      encoding: 'utf8',
    }).trim();
  const head = inDir('rev-parse', 'HEAD');
  const origin = inDir('rev-parse', 'origin/main');
  if (head !== origin) {
    const behind = inDir('rev-list', '--count', 'HEAD..origin/main');
    const ahead = inDir('rev-list', '--count', 'origin/main..HEAD');
    fail(
      `this directory is ${behind} commit(s) behind and ${ahead} ahead of origin/main`,
      behind > 0
        ? 'Deploying would revert what is on main. Merge origin/main first, or deploy from a checkout that is in sync.'
        : 'Push these commits to main first, so the deploy matches what the repository says is live.',
    );
  }

  const status = spawnSync(
    'npx',
    ['--yes', '@railway/cli', 'status', '--json'],
    { encoding: 'utf8', shell: process.platform === 'win32' },
  );
  const busy = [];
  try {
    for (const environment of JSON.parse(status.stdout).environments.edges)
      for (const instance of environment.node.serviceInstances.edges)
        for (const deployment of instance.node.activeDeployments ?? [])
          if (
            !['SUCCESS', 'FAILED', 'CRASHED', 'REMOVED'].includes(
              deployment.status,
            )
          )
            busy.push(`${deployment.id.slice(0, 8)} ${deployment.status}`);
  } catch {
    console.warn('  Could not read Railway status; continuing.\n');
  }
  if (busy.length)
    fail(
      `another deployment is already in flight (${busy.join(', ')})`,
      'Wait for it. Two sessions deploying at once is how one silently overwrites the other.',
    );

  console.log(
    `
  Deploying ${head.slice(0, 7)} from ${DEPLOY_DIR}
  in sync with origin/main.
`,
  );
}

const up = spawnSync(
  'npx',
  [
    '--yes',
    '@railway/cli',
    'up',
    '--service',
    SERVICE,
    '--environment',
    ENVIRONMENT,
    ...process.argv.slice(2).filter((a) => a !== '--force'),
    // The checked directory is the uploaded directory, and the root of the
    // archive. See DEPLOY_DIR.
    '--path-as-root',
    DEPLOY_DIR,
  ],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
process.exit(up.status ?? 1);
