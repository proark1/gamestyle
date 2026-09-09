import * as T from 'three';

function grain(kind: 'fine' | 'sand' | 'cloth' | 'water') {
  const size = 128,
    pixels = new Uint8Array(size * size * 4);
  let seed = 1947;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      seed = (seed * 16807) % 2147483647;
      const noise = seed / 2147483647,
        wave =
          Math.sin(x * 0.15 + Math.sin(y * 0.14) * 2) *
          Math.cos(y * 0.19 + x * 0.025);
      const value =
        kind === 'water'
          ? 180 + wave * 50
          : kind === 'cloth'
            ? 210 + noise * 22 - (x % 4 === 0 || y % 4 === 0 ? 26 : 0)
            : kind === 'sand'
              ? 173 + noise * 81
              : 221 + noise * 32;
      const index = (y * size + x) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
  const t = new T.DataTexture(pixels, size, size);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.magFilter = T.LinearFilter;
  t.minFilter = T.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
function print(lines: string[], foreground: string, background?: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 512, 256);
  }
  ctx.fillStyle = foreground;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    ctx.font = `${i ? '500 34px' : '800 57px'} sans-serif`;
    ctx.fillText(line, 256, 128 + (i - (lines.length - 1) / 2) * 64, 478);
  });
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return new T.MeshStandardMaterial({
    map: t,
    transparent: !background,
    roughness: 0.78,
    metalness: 0,
    depthWrite: !!background,
    side: T.DoubleSide,
  });
}
export function createDetailMaterials() {
  const fine = grain('fine'),
    sand = grain('sand'),
    cloth = grain('cloth'),
    water = grain('water');
  return {
    skin: new T.MeshStandardMaterial({
      color: 0xb77c61,
      roughness: 0.72,
      bumpMap: fine,
      bumpScale: 0.0003,
    }),
    nails: new T.MeshStandardMaterial({ color: 0xbd9281, roughness: 0.53 }),
    sleeve: new T.MeshStandardMaterial({
      color: 0x405b50,
      map: cloth,
      bumpMap: cloth,
      bumpScale: 0.002,
      roughness: 0.95,
    }),
    cuff: new T.MeshStandardMaterial({
      color: 0x263a33,
      map: cloth,
      roughness: 1,
    }),
    stitches: new T.MeshStandardMaterial({ color: 0xa4aa91, roughness: 1 }),
    sand: new T.MeshStandardMaterial({
      color: 0xcaa76d,
      map: sand,
      bumpMap: sand,
      bumpScale: 0.023,
      roughness: 1,
    }),
    cement: new T.MeshStandardMaterial({
      color: 0xb4ad9c,
      map: fine,
      bumpMap: sand,
      bumpScale: 0.012,
      roughness: 1,
    }),
    sack: new T.MeshStandardMaterial({
      color: 0xd1ba8d,
      map: fine,
      bumpMap: cloth,
      bumpScale: 0.004,
      roughness: 0.96,
    }),
    sackInk: print(['BRICK BY HAND', 'CEMENT · 25 kg', 'KEEP DRY'], '#325b48'),
    bucket: new T.MeshStandardMaterial({
      color: 0x9ba7a5,
      roughness: 0.48,
      metalness: 0.72,
      bumpMap: fine,
      bumpScale: 0.002,
    }),
    bucketInside: new T.MeshStandardMaterial({
      color: 0x596760,
      roughness: 0.8,
      metalness: 0.3,
    }),
    bucketInk: print(
      ['BRICK BY HAND', '12 L · BUILDING BUCKET'],
      '#304d41',
      '#d9c9a0',
    ),
    waterInk: print(
      ['UTILITY WATER', '200 L · BUILDING SITE'],
      '#304d41',
      '#d9c9a0',
    ),
    steel: new T.MeshStandardMaterial({
      color: 0xa6b0ad,
      roughness: 0.32,
      metalness: 0.82,
      bumpMap: fine,
      bumpScale: 0.001,
    }),
    paint: new T.MeshStandardMaterial({
      color: 0x547969,
      roughness: 0.38,
      metalness: 0.35,
      bumpMap: fine,
      bumpScale: 0.0015,
    }),
    barrel: new T.MeshStandardMaterial({
      color: 0x376a85,
      roughness: 0.46,
      metalness: 0.42,
      bumpMap: fine,
      bumpScale: 0.002,
    }),
    glass: new T.MeshStandardMaterial({
      color: 0x66898e,
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.64,
      depthWrite: false,
      side: T.DoubleSide,
    }),
    liquid: new T.MeshStandardMaterial({
      color: 0x2b6d7d,
      roughness: 0.22,
      metalness: 0.08,
      bumpMap: water,
      bumpScale: 0.03,
    }),
    foam: new T.MeshStandardMaterial({
      color: 0xb5d0cd,
      roughness: 0.2,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
    amber: new T.MeshStandardMaterial({
      color: 0xeda544,
      emissive: 0x805019,
      emissiveIntensity: 0.13,
      roughness: 0.24,
    }),
    lamp: new T.MeshStandardMaterial({
      color: 0xe6e2c8,
      roughness: 0.19,
      metalness: 0.2,
    }),
    red: new T.MeshStandardMaterial({ color: 0x9b302c, roughness: 0.27 }),
    truckInk: print(['BRICK BY HAND', 'BUILDING SERVICES'], '#eadca9'),
    plate: print(['SW · 204'], '#263c35', '#e1dfcc'),
  };
}
