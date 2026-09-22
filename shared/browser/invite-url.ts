import { isGame } from '../games/identity';

/** Accept only our known routes. Custom-scheme hostnames are route components. */
export function inviteTarget(value: string): string | null {
  try {
    const url = new URL(value);
    const custom = url.protocol === 'jumbleyard:';
    if (
      !custom &&
      (url.protocol !== 'https:' ||
        ![
          'www.jumbleyard.com',
          'jumbleyard.com',
          'jumbleyard.up.railway.app',
        ].includes(url.hostname))
    )
      return null;
    const path = custom ? `/${url.hostname}${url.pathname}` : url.pathname;
    const parts = path.split('/').filter(Boolean);
    if (
      parts[0] === 'room' &&
      parts.length === 2 &&
      /^[A-Z0-9]{6}$/.test(parts[1])
    )
      return `/?room=${encodeURIComponent(parts[1])}`;
    if (
      parts.length > 1 ||
      (parts.length === 1 && !isGame(parts[0]) && parts[0] !== 'party')
    )
      return null;
    return `${parts.length ? '/' + parts[0] : '/'}${url.search}`;
  } catch {
    return null;
  }
}
