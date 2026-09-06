/** Public origins are configured explicitly when HTTPS terminates at a proxy. */
export function isRoomOriginAllowed(request: Request, publicOrigin?: string): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return origin === new URL(publicOrigin || request.url).origin;
  } catch {
    return false;
  }
}
