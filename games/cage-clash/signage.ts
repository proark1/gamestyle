import * as T from 'three';

export function label(
  text: string,
  color = '#334b43',
  background = '#f7f0da',
  width = 4,
  height = 0.8,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.font = '600 65px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 384, 82, 710);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const mesh = new T.Mesh(
    new T.PlaneGeometry(width, height),
    new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }),
  );
  return mesh;
}
