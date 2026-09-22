import { existsSync } from 'node:fs';
if (!existsSync('dist/native/index.html'))
  throw new Error(
    'Run npm run build:client before syncing the installed client.',
  );
console.log('Using the locally bundled game client in dist/native.');
