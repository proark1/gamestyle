import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = process.argv.slice(2);
const selected = roots.length ? roots : ['games', 'shared', 'platform', 'db'];
const files = selected
  .flatMap((root) => {
    if (statSync(root).isFile()) return [root];
    return readdirSync(root, { recursive: true })
      .filter((file) => /\.test\.(ts|tsx|mjs)$/.test(file))
      .map((file) => resolve(root, file));
  })
  .sort();
if (!files.length)
  throw new Error('No tests found in the selected directories.');
const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...files],
  {
    stdio: 'inherit',
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
