# Accounts and sign-in

Players can sign in with Google or with a 6-digit code sent by email. Guests still play every game exactly as before. Accounts exist so later features, such as coins and wardrobe items, can follow a player to any device. Until sign-in is configured the account button stays hidden and nothing changes for players.

## How it works

- `shared/accounts/server/` holds the server side. `routes.ts` builds the route handlers from injected dependencies, so tests run against an in-memory database; `handlers.ts` binds them to the real database and environment for the `app/api/account/*` routes.
- Other server code calls `currentAccount(request)` from `shared/accounts/server/current.ts`. It reads the session cookie and never writes.
- `shared/accounts/AccountButton.tsx` sits in the game toolbar and the landing header. It asks `GET /api/account/session` once per page, renders nothing until a sign-in method is configured, and opens the sign-in or account dialog. Inside a game, Google sign-in opens a popup so the room stays connected; its last page, `/account/signed-in`, reports back over a `BroadcastChannel`.

## Endpoints

| Request | Purpose |
| --- | --- |
| `GET /api/account/session` | The signed-in account's summary and the configured sign-in methods. Renews the session at most once a day. |
| `GET /api/account/google/start?return=/path&popup=1` | Starts Google sign-in. |
| `GET /api/account/google/callback` | Google returns here. |
| `POST /api/account/email/start` `{email}` | Sends a code (202). |
| `POST /api/account/email/verify` `{email, code}` | Signs in. |
| `POST /api/account/profile` `{displayName}` | Saves an optional name. |
| `POST /api/account/sign-out` `{everywhere}` | Signs out on this device or on every device. |
| `POST /api/account/delete` `{confirm: "delete"}` | Deletes the account and everything saved with it. |

## What is stored

`drizzle/0004_accounts.sql` adds four tables:

- `accounts`: a random id, an optional display name and timestamps.
- `account_identities`: `google` with Google's subject id, or `email` with HMAC-SHA256(`AUTH_SECRET`, normalized address), plus a masked hint such as `p•••@example.com`. No raw address, Google name or photo.
- `account_sessions`: the SHA-256 of each session token. A session ends 60 days after its last renewal.
- `account_email_codes`: the HMAC of each code, bound to the browser that asked for it. Codes work for 10 minutes and 5 tries, and are deleted after a day.

Expired sessions and codes older than a day are deleted at most once an hour by the session check every page makes, so the cleanup runs without anyone signing in again, and with sign-in switched off.

Every table with an `account_id` column must reference `accounts(id)` with `ON DELETE CASCADE`, so deleting an account removes everything saved with it. `db/accounts-node.test.ts` fails for any table that does not.

## Security

- **Cookies.** `__Host-jy_session` (HttpOnly, Secure, SameSite=Lax) carries the session. `jy_signed_in` is a readable hint with no account details. `__Host-jy_email_flow` and `__Host-jy_google_flow` live for 30 and 10 minutes. On plain-HTTP development origins the `__Host-` prefix and `Secure` are dropped.
- **Behind the proxy.** Railway's proxy hands the server an `http` request URL, and vinext ignores `X-Forwarded-Proto` unless `VINEXT_TRUST_PROXY=1`. The Secure flag and Google's redirect address therefore come from `PUBLIC_GAME_ORIGIN`.
- **Cross-site requests.** Every cookie-authenticated POST needs an allowed `Origin` (`hasAllowedOrigin` in `shared/http/request-origin.ts`), checked before the database is touched. SameSite=Lax covers the rest.
- **Google.** The authorization code flow keeps its state, nonce and PKCE (S256) verifier in a signed 10-minute cookie. The ID token comes straight from Google's token endpoint over TLS, so its signature is not checked separately (OpenID Connect Core 3.1.3.7); a token supplied by a browser is never accepted. A Google identity joins an existing email account only when Google hosts that address: Gmail, or the Workspace domain named in `hd`. Existing accounts are never merged. When Google later hosts a different address for the same Google account, as after a Workspace rename, the old address's email identity is removed and the account's other sessions end; the new address joins unless another account holds it. Each flow is answered once, and answers have a rate budget of their own, so a flood of starts cannot turn players away on their way back from Google.
- **Email codes.** An address gets at most 3 codes per 15 minutes and 10 a day, counted in the database, and each browser has in-memory limits too. Replies are the same whether or not an address has an account.
- **Analytics stay anonymous.** `scripts/check-architecture.mjs` stops analytics code from importing accounts, and analytics reports are sent without cookies.

## Configuration

Set these on the Railway service. Sign-in stays off until `AUTH_SECRET` and at least one method are set and, over HTTPS, until `OPERATOR` in `shared/accounts/operator.ts` names who runs the site, because the privacy page sends account holders there for access and export requests.

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | At least 32 characters, for example from `openssl rand -hex 32`. Keys email fingerprints, codes and signed cookies. Back it up and never change it: a new secret makes every email account unreachable. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email codes, for example `EMAIL_FROM="Jumbleyard <sign-in@jumbleyard.com>"`. |
| `PUBLIC_GAME_ORIGIN` | Already set; it must include `https://www.jumbleyard.com`. |

`.railway/railway.ts` lists each of these as `preserve()`, so `railway config apply` keeps the values set in Railway. Applying the config deletes any variable the file doesn't list, so add a new one there too.

### Google Cloud

1. Create a project and open **Google Auth Platform**.
2. Under Branding, enter the app name, a support email, the privacy page `https://www.jumbleyard.com/privacy` and the authorized domain `jumbleyard.com`. Choose the External audience and publish the app.
3. Under Data access, add the `openid` and `userinfo.email` scopes.
4. Under Clients, create a **Web application** client with these redirect URIs:
   - `https://www.jumbleyard.com/api/account/google/callback`
   - `http://localhost:3000/api/account/google/callback` for local testing
5. Copy the client id and secret into Railway.

### Resend

`jumbleyard.com` is already set up in Resend. Its DKIM record (`resend._domainkey.jumbleyard.com`), the SPF and bounce MX records on `send.jumbleyard.com` (Resend's EU region, `eu-west-1`) and a DMARC policy are published, so no DNS work is needed.

1. In Resend, confirm `jumbleyard.com` shows as verified, and turn off open and click tracking for it.
2. Create an API key with sending access limited to `jumbleyard.com`, and store it as `RESEND_API_KEY`.
3. Set `EMAIL_FROM` to an address on that domain, for example `Jumbleyard <sign-in@jumbleyard.com>`.
4. Accept Resend's data processing agreement if nobody has yet.

## Local testing

Without a mail service, set `AUTH_SECRET` and `ACCOUNT_EMAIL_DEV_LOG=1`. On an origin without HTTPS the server then prints each code to its console instead of sending it; an HTTPS origin ignores the setting.

```sh
node scripts/test.mjs shared/accounts db/accounts-node.test.ts
```

## Privacy page

`/privacy` describes what the site stores. Before sign-in goes live, fill in the operator's name, address and contact email in `OPERATOR` in `shared/accounts/operator.ts`; over HTTPS no sign-in method opens until then.
