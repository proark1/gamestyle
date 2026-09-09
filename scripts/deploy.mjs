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

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function fail(problem, remedy) {
  console.error(`\n  Refusing to deploy: ${problem}\n  ${remedy}\n`);
  console.error('  Pass --force to deploy anyway.\n');
  process.exit(1);
}

if (force) console.warn('\n  --force: skipping deploy safety checks.\n');
else {
  const dirty = git('status', '--porcelain');
  if (dirty)
    fail(
      `the working tree has ${dirty.split('\n').length} uncommitted change(s)`,
      'Commit or stash them, so what ships matches a commit you can point at.',
    );

  try {
    execFileSync('git', ['fetch', 'origin', 'main', '--quiet'], {
      stdio: 'ignore',
    });
  } catch {
    fail(
      'could not reach origin to compare against main',
      'Check the network; deploying blind is how production loses work.',
    );
  }

  const head = git('rev-parse', 'HEAD');
  const origin = git('rev-parse', 'origin/main');
  if (head !== origin) {
    const behind = git('rev-list', '--count', 'HEAD..origin/main');
    const ahead = git('rev-list', '--count', 'origin/main..HEAD');
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

  console.log(`\n  Deploying ${head.slice(0, 7)}, in sync with origin/main.\n`);
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
  ],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
process.exit(up.status ?? 1);
