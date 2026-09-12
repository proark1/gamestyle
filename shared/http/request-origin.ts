/**
 * Public origins are configured explicitly when HTTPS terminates at a proxy.
 * `publicOrigin` accepts a comma-separated list so one deployment can serve
 * several domains, such as a custom domain alongside its Railway address.
 */
export function isRoomOriginAllowed(
  request: Request,
  publicOrigin?: string,
): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const configured = publicOrigin?.trim() || request.url;
  return configured.split(',').some((candidate) => {
    const allowed = candidate.trim();
    if (!allowed) return false;
    try {
      return origin === new URL(allowed).origin;
    } catch {
      return false;
    }
  });
}

/**
 * For requests that change something a cookie or password protects. Browsers
 * send `Origin` with every POST, so a request without one is refused.
 */
export function hasAllowedOrigin(request: Request, publicOrigin?: string) {
  return (
    !!request.headers.get('origin') &&
    isRoomOriginAllowed(request, publicOrigin)
  );
}
