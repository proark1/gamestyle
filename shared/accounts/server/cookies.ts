export function readCookie(request: Request, name: string) {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name)
      return part.slice(at + 1).trim();
  }
  return undefined;
}

type CookieOptions = { maxAge: number; secure: boolean; httpOnly?: boolean };

/** Every account cookie is host-only, site-wide and SameSite=Lax. */
export function setCookie(
  name: string,
  value: string,
  { maxAge, secure, httpOnly = true }: CookieOptions,
) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}${secure ? '; Secure' : ''}`;
}

/** `__Host-` cookies must be Secure, so plain-HTTP development drops it. */
export const cookieName = (base: string, secure: boolean) =>
  secure ? `__Host-${base}` : base;
