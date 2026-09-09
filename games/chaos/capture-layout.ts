export function portraitCrop(
  width: number,
  height: number,
  aspect: number,
  focus: { x: number; y: number },
) {
  const w = Math.min(width, height * aspect),
    h = Math.min(height, width / aspect);
  return {
    x: Math.max(0, Math.min(width - w, focus.x * width - w / 2)),
    y: Math.max(0, Math.min(height - h, focus.y * height - h / 2)),
    w,
    h,
  };
}
export function clipCaption(
  text: string,
  names: string[],
  includeNames: boolean,
) {
  let safe = text;
  if (!includeNames)
    for (const name of [...names].sort((a, b) => b.length - a.length))
      if (name) safe = safe.split(name).join('A builder');
  return safe.slice(0, 130);
}
