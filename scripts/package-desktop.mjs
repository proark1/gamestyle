import { packager } from '@electron/packager';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
const source = resolve('.tmp/desktop-package');
const client = resolve(source, 'client');
if (!client.startsWith(source + sep))
  throw Error(
    'The desktop client staging path must remain in its package directory.',
  );
const project = JSON.parse(await readFile('package.json', 'utf8'));
const apiOrigin = new URL(
  process.env.GAME_API_ORIGIN ?? 'https://www.jumbleyard.com',
);
if (apiOrigin.protocol !== 'https:')
  throw Error('GAME_API_ORIGIN must use HTTPS');
await mkdir(source, { recursive: true });
// Replace the previous build so obsolete hashed chunks do not accumulate.
await rm(client, { recursive: true, force: true });
await cp('dist/native', client, { recursive: true });
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
    // Electron ships trusted checksums for this version; cached builds need no
    // separate network request just to verify their already-downloaded archive.
    download: {
      checksums: JSON.parse(
        await readFile('node_modules/electron/checksums.json', 'utf8'),
      ),
    },
    electronVersion: JSON.parse(
      await readFile('node_modules/electron/package.json', 'utf8'),
    ).version,
  }),
);
