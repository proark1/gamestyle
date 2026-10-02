import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const target = resolve('C:/Users/assad/.codex/worktrees/host-live-release/gamestyle');
const expectedHead = 'eaadf34cb9847aa426e6502dc1b92758b59a3d69';
const git = (...args) =>
  execFileSync('git', ['-C', target, ...args], { encoding: 'utf8' }).trim();

if (
  git('rev-parse', '--show-toplevel').replaceAll('\\', '/').toLowerCase() !==
  target.replaceAll('\\', '/').toLowerCase()
) {
  throw new Error('Release target is not the expected worktree');
}
if (git('rev-parse', 'HEAD') !== expectedHead || git('status', '--porcelain')) {
  throw new Error('Release worktree must be clean at the reviewed origin/main');
}

async function copy(relative) {
  const destination = resolve(target, relative);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(source, relative), destination);
}

async function replaceOnce(relative, before, after) {
  const path = resolve(target, relative);
  const content = (await readFile(path, 'utf8')).replaceAll('\r\n', '\n');
  if (!content.includes(before) || content.indexOf(before) !== content.lastIndexOf(before)) {
    throw new Error(`Expected unique source text in ${relative}`);
  }
  await writeFile(path, content.replace(before, after));
}

const brandMarkup = `        <a className="collection-brand" href="/">
          <span>
            <Gamepad2 size={24} />
          </span>
          JUMBLEYARD<span className="brand-period">.</span>
        </a>`;
const hostMarkup = `        <a className="collection-brand" href="/">
          <span className="collection-brand-face" aria-hidden="true">
            <img src="/images/brand/host-head-header.webp" alt="" width="46" height="46" />
            <img
              className="collection-brand-face-wink"
              src="/images/brand/host-head-wink-header.webp"
              alt=""
              width="46"
              height="46"
            />
          </span>
          <span>jumbleyard</span>
        </a>`;
await replaceOnce('app/CollectionClient.tsx', brandMarkup, hostMarkup);
await replaceOnce(
  'app/CollectionClient.tsx',
  "import './landing-gamefeel.css';",
  "import './landing-gamefeel.css';\nimport './host-identity.css';",
);
await replaceOnce(
  'app/layout.tsx',
  "icons: { icon: '/favicon.svg', apple: '/favicon.svg' },",
  `icons: {
    icon: { url: '/images/brand/host-icon-32.png', sizes: '32x32', type: 'image/png' },
    apple: { url: '/images/brand/host-app-icon.png', type: 'image/png' },
  },`,
);
await replaceOnce('app/layout.tsx', "themeColor: '#315e53'", "themeColor: '#1b718d'");

for (const file of [
  'app/host-identity.css',
  'public/favicon.svg',
  'public/manifest.json',
  'public/manifest.webmanifest',
  'public/images/brand/host-head.png',
  'public/images/brand/host-head-wink.png',
  'public/images/brand/host-head-header.webp',
  'public/images/brand/host-head-wink-header.webp',
  'public/images/brand/host-icon-32.png',
  'public/images/brand/host-icon-192.png',
  'public/images/brand/host-icon-512.png',
  'public/images/brand/host-maskable-512.png',
  'public/images/brand/host-app-icon.png',
  'android/app/src/main/res/values/ic_launcher_background.xml',
  'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
]) {
  await copy(file);
}

for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  for (const icon of ['ic_launcher.png', 'ic_launcher_round.png']) {
    await copy(`android/app/src/main/res/mipmap-${density}/${icon}`);
  }
  if (density !== 'xxxhdpi') {
    await copy(`android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`);
  }
}

console.log(`Prepared Host release in ${target}`);
