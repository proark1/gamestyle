/** Joysticks use screen down as +z; movement uses screen forward as +z. */
export function movementAxes(
  keys: ReadonlySet<string>,
  stick: { x: number; z: number },
) {
  const x =
    stick.x +
    Number(keys.has('KeyD') || keys.has('ArrowRight')) -
    Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const z =
    -stick.z +
    Number(keys.has('KeyW') || keys.has('ArrowUp')) -
    Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const magnitude = Math.min(1, Math.hypot(x, z));
  return { x, z, magnitude };
}

/** Fit the playable court, including its walls, at every orbit angle. */
export function courtCameraDistance(
  yaw: number,
  pitch: number,
  aspect: number,
  fov = 46,
) {
  const tanV = Math.tan((fov * Math.PI) / 360);
  const tanH = tanV * Math.max(0.1, aspect);
  let distance = 0;
  for (const x of [-7, 7])
    for (const z of [-11.5, 11.5])
      for (const y of [-1, 3]) {
        const right = x * Math.cos(yaw) - z * Math.sin(yaw);
        const up =
          -x * Math.sin(yaw) * Math.sin(pitch) +
          y * Math.cos(pitch) -
          z * Math.cos(yaw) * Math.sin(pitch);
        const near =
          x * Math.sin(yaw) * Math.cos(pitch) +
          y * Math.sin(pitch) +
          z * Math.cos(yaw) * Math.cos(pitch);
        distance = Math.max(
          distance,
          near + Math.abs(right) / tanH,
          near + Math.abs(up) / tanV,
        );
      }
  return distance * 1.07;
}

export function courtViewport(
  width: number,
  height: number,
  safeTop = 0,
  safeBottom = 0,
) {
  const short = height < 500;
  const top = short ? 82 : width < 700 ? 130 : 145;
  const bottom = short ? 70 : width < 700 ? 165 : 100;
  return {
    bottom: bottom + safeBottom,
    height: Math.max(80, height - top - bottom - safeTop - safeBottom),
  };
}
