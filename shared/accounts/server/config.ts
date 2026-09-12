import { OPERATOR, type Operator } from '../operator';
import type { SignInMethods } from '../types';

export type AccountConfig = {
  /** Keys email lookups, sign-in codes and signed cookies. */
  secret?: string;
  google?: { clientId: string; clientSecret: string };
  /** `log` prints codes to the server console; allowed only without HTTPS. */
  email?: { apiKey: string; from: string } | 'log';
  /** Comma-separated public origins, the same value the room APIs use. */
  publicOrigin?: string;
};

type Env = Record<string, string | undefined>;

/**
 * A sign-in method opens once its keys are set and, over HTTPS, once the
 * privacy page names the operator that account holders can turn to. Plain-HTTP
 * development origins need no operator.
 */
export function accountConfig(
  env: Env = process.env,
  operator: Operator | null = OPERATOR,
): AccountConfig {
  const publicOrigin = env.PUBLIC_GAME_ORIGIN?.trim() || undefined;
  const https = !!publicOrigin?.split(',').some((entry) => {
    try {
      return new URL(entry.trim()).protocol === 'https:';
    } catch {
      return false;
    }
  });
  const open = !!operator || !https;
  return {
    secret:
      env.AUTH_SECRET && env.AUTH_SECRET.length >= 32
        ? env.AUTH_SECRET
        : undefined,
    google:
      open && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          }
        : undefined,
    email: !open
      ? undefined
      : env.RESEND_API_KEY && env.EMAIL_FROM
        ? { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }
        : env.ACCOUNT_EMAIL_DEV_LOG === '1' && !https
          ? 'log'
          : undefined,
    publicOrigin,
  };
}

export function signInMethods(config: AccountConfig): SignInMethods {
  return {
    google: !!config.secret && !!config.google,
    email: !!config.secret && !!config.email,
  };
}

/**
 * The public origin a request came through. Behind Railway's proxy the request
 * URL says http, and vinext ignores X-Forwarded-Proto unless told to trust it.
 */
export function publicOriginFor(request: Request, configured?: string) {
  const origins = (configured ?? '').split(',').flatMap((entry) => {
    try {
      return entry.trim() ? [new URL(entry.trim())] : [];
    } catch {
      return [];
    }
  });
  if (!origins.length) return new URL(request.url).origin;
  const host = request.headers.get('host');
  return (origins.find((url) => url.host === host) ?? origins[0]).origin;
}

export const isSecureOrigin = (origin: string) => origin.startsWith('https:');
