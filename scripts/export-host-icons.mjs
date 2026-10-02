import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const brand = resolve(root, 'public/images/brand');
const head = resolve(brand, 'host-head.png');
const wink = resolve(brand, 'host-head-wink.png');
const blue = '#1B718D';

for (const [source, output] of [
  [head, 'host-head-header.webp'],
  [wink, 'host-head-wink-header.webp'],
]) {
  await sharp(source)
    .resize(256, 256)
    .webp({ quality: 86 })
    .toFile(resolve(brand, output));
}

async function renderIcon(size, { shape = 'rounded', faceScale = 0.86 } = {}) {
  const radius =
    shape === 'circle' ? size / 2 : shape === 'rounded' ? size * 0.19 : 0;
  const background = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="${radius}" fill="${blue}"/></svg>`,
  );
  const faceSize = Math.round(size * faceScale);
  const face = await sharp(head).resize(faceSize, faceSize).png().toBuffer();
  const inset = Math.floor((size - faceSize) / 2);
  return sharp(background)
    .composite([{ input: face, left: inset, top: inset }])
    .png()
    .toBuffer();
}

for (const size of [32, 192, 512]) {
  const icon = await renderIcon(size);
  await sharp(icon).toFile(resolve(brand, `host-icon-${size}.png`));
}
const favicon = await readFile(resolve(brand, 'host-icon-32.png'));
await writeFile(
  resolve(root, 'public/favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><image width="32" height="32" href="data:image/png;base64,${favicon.toString('base64')}"/></svg>\n`,
);

await sharp(await renderIcon(512, { shape: 'square', faceScale: 0.68 })).toFile(
  resolve(brand, 'host-maskable-512.png'),
);
await sharp(await renderIcon(1024, { shape: 'square' })).toFile(
  resolve(brand, 'host-app-icon.png'),
);
await sharp(await renderIcon(1024, { shape: 'square' })).toFile(
  resolve(
    root,
    'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
  ),
);

for (const [density, size] of [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
]) {
  const folder = resolve(root, `android/app/src/main/res/mipmap-${density}`);
  await sharp(await renderIcon(size, { shape: 'square' })).toFile(
    resolve(folder, 'ic_launcher.png'),
  );
  await sharp(
    await renderIcon(size, { shape: 'circle', faceScale: 0.75 }),
  ).toFile(resolve(folder, 'ic_launcher_round.png'));
  if (density !== 'xxxhdpi') {
    const foregroundSize = Math.round(size * 2.25);
    const foreground = await sharp({
      create: {
        width: foregroundSize,
        height: foregroundSize,
        channels: 4,
        background: '#00000000',
      },
    })
      .composite([
        {
          input: await sharp(head)
            .resize(Math.round(foregroundSize * 0.62))
            .png()
            .toBuffer(),
          gravity: 'centre',
        },
      ])
      .png()
      .toBuffer();
    await sharp(foreground).toFile(
      resolve(folder, 'ic_launcher_foreground.png'),
    );
  }
}
