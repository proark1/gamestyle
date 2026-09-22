import { packager } from '@electron/packager';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const source = resolve('.tmp/desktop-package');
const project = JSON.parse(await readFile('package.json', 'utf8'));
const apiOrigin = new URL(
  process.env.GAME_API_ORIGIN ?? 'https://www.jumbleyard.com',
);
if (apiOrigin.protocol !== 'https:')
  throw Error('GAME_API_ORIGIN must use HTTPS');
await mkdir(source, { recursive: true });
await cp('dist/native', resolve(source, 'client'), { recursive: true });
await cp('desktop/main.cjs', resolve(source, 'main.cjs'));
await writeFile(
  resolve(source, 'runtime.json'),
  JSON.stringify({ apiOrigin: apiOrigin.origin }),
);
await writeFile(
  resolve(source, 'package.json'),
  JSON.stringify({
    name: 'jumbleyard',
    productName: 'Jumbleyard',
    version: project.version,
    main: 'main.cjs',
    type: 'module',
  }),
);
console.log(
  await packager({
    dir: source,
    name: 'Jumbleyard',
    out: 'output/desktop',
    overwrite: true,
    asar: true,
    platform: process.env.DESKTOP_PLATFORM ?? process.platform,
    arch: process.env.DESKTOP_ARCH ?? process.arch,
    electronVersion: JSON.parse(
      await readFile('node_modules/electron/package.json', 'utf8'),
    ).version,
  }),
);
