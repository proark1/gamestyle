import { audioAccess, canEditAudio } from './access';
import { AudioError } from './errors';
import { readJsonObject } from '../http/json-request';
import { budgetError, withRequestBudget } from '../http/request-budget';
import { RoomError } from '../rooms/types';

type Context = { params: Promise<{ game: string }> };
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

/** Both audio backends share authentication, bounded input and public manifest caching. */
export function createAudioRoutes<Game extends string, Library>(options: {
  isGame: (game: unknown) => game is Game;
  library: (game: Game) => Promise<Library>;
  manifest: (library: Library) => unknown;
  update: (game: Game, body: Record<string, unknown>) => Promise<unknown>;
}) {
  const manifests = new Map<
    Game,
    { expires: number; value: Promise<unknown> }
  >();
  const failure = (error: unknown) =>
    error instanceof RoomError
      ? budgetError(error)
      : json(
          {
            error:
              error instanceof AudioError
                ? error.message
                : 'Audio storage is unavailable. Please try again shortly.',
          },
          error instanceof AudioError ? error.status : 503,
        );
  const authorize = async (request: Request) => {
    const access = await audioAccess(request);
    if (!access.configured)
      throw new AudioError(
        'Administrator access has not been configured.',
        503,
      );
    if (!access.authorized)
      throw new AudioError('Sign in with the administrator password.', 401);
  };
  return {
    GET: withRequestBudget(async (request: Request, context: Context) => {
      const { game } = await context.params;
      if (!options.isGame(game)) return json({ error: 'Game not found.' }, 404);
      try {
        const query = new URL(request.url).searchParams;
        if (query.has('access')) return json(await audioAccess(request));
        if (query.has('manifest')) {
          let cached = manifests.get(game);
          if (!cached || cached.expires <= Date.now()) {
            const value = options.library(game).then(options.manifest);
            cached = { expires: Date.now() + 10_000, value };
            manifests.set(game, cached);
            // Failed reads must not poison the cache; concurrent readers share one load.
            void value.catch(() => {
              if (manifests.get(game)?.value === value) manifests.delete(game);
            });
          }
          return json(await cached.value);
        }
        await authorize(request);
        return json(await options.library(game));
      } catch (error) {
        return failure(error);
      }
    }),
    POST: withRequestBudget(async (request: Request, context: Context) => {
      const { game } = await context.params;
      if (!options.isGame(game)) return json({ error: 'Game not found.' }, 404);
      if (
        !canEditAudio(request) ||
        !request.headers.get('content-type')?.startsWith('application/json')
      )
        return json(
          {
            error:
              'Open the sound workshop on this game’s website to make changes.',
          },
          403,
        );
      try {
        await authorize(request);
        const body = await readJsonObject(request, 16_000);
        try {
          return json(await options.update(game, body));
        } finally {
          manifests.clear();
        }
      } catch (error) {
        return failure(error);
      }
    }),
  };
}
