import type { GameDatabase } from '@/db/contract';
import { getCatalog } from './catalog';
import { decryptKey, encryptKey } from '../../../shared/audio/crypto';
import {
  AudioError,
  elevenRequest,
  generateAudio,
} from '../../../shared/audio/construction/provider';
import {
  cancelGeneration,
  watchGeneration,
} from '../../../shared/audio/cancellation';
import { promptLimit } from '../../../shared/audio/limits';
import {
  DEFAULT_SETTINGS,
  type AudioLibrary,
  type AudioManifest,
  type AudioSettings,
  type Cue,
  type GameId,
} from '../../../shared/audio/construction/types';

type SettingsRow = {
  secret: string | null;
  settings: string;
  lease_until: number;
};
type CueRow = {
  cue: string;
  config: string;
  file: string | null;
  generated: number | null;
  generated_config: string | null;
  error: string;
  request: string | null;
};
export type AudioStorage = {
  masterKey(): Promise<string>;
  putAudio(key: string, bytes: Uint8Array): Promise<void>;
};
export function parseSettings(value: unknown): AudioSettings {
  if (!value || typeof value !== 'object')
    throw new AudioError('Invalid audio settings.');
  const v = value as Record<string, unknown>;
  const result = { ...DEFAULT_SETTINGS };
  for (const key of ['effects', 'speech', 'ambience', 'music'] as const) {
    if (
      typeof v[key] !== 'number' ||
      !Number.isFinite(v[key]) ||
      v[key] < 0 ||
      v[key] > 1
    )
      throw new AudioError('Volume must be between 0 and 100 percent.');
    result[key] = v[key];
  }
  if (
    typeof v.voiceId !== 'string' ||
    !/^[a-zA-Z0-9_-]{0,100}$/.test(v.voiceId)
  )
    throw new AudioError('Invalid voice ID.');
  result.voiceId = v.voiceId;
  return result;
}
export function parseCue(
  base: Cue,
  value: unknown,
  enforceProviderLimits = true,
): Cue {
  if (!value || typeof value !== 'object')
    throw new AudioError('Invalid sound.');
  const v = value as Record<string, unknown>;
  const limit = enforceProviderLimits ? promptLimit(base.category) : 2000;
  if (
    typeof v.prompt !== 'string' ||
    !v.prompt.trim() ||
    v.prompt.length > limit
  )
    throw new AudioError(
      `${base.name}: the prompt must contain 1 to ${limit} characters. Shorten it before generating.`,
    );
  // Eleven v3 takes delivery tags, not a prose system prompt. Prose would be spoken aloud.
  if (
    base.category === 'speech' &&
    !/^(\[[a-zA-Z ,'-]{1,60}\]\s*){1,6}$/.test(v.prompt.trim())
  )
    throw new AudioError(
      'Enter voice direction as audio tags, such as [playfully] or [shouting]. Enter speech text in the separate field.',
    );
  if (
    typeof v.text !== 'string' ||
    v.text.length > 1000 ||
    (base.category === 'speech' && !v.text.trim())
  )
    throw new AudioError('Enter speech text of up to 1000 characters.');
  const min = base.category === 'music' ? 3 : 0.5,
    max = base.category === 'music' ? 120 : 30;
  if (
    typeof v.duration !== 'number' ||
    !Number.isFinite(v.duration) ||
    v.duration < min ||
    v.duration > max
  )
    throw new AudioError(`Duration must be between ${min} and ${max} seconds.`);
  if (
    typeof v.volume !== 'number' ||
    !Number.isFinite(v.volume) ||
    v.volume < 0 ||
    v.volume > 1 ||
    typeof v.loop !== 'boolean'
  )
    throw new AudioError('Invalid volume or loop setting.');
  if (
    v.voiceId !== undefined &&
    (typeof v.voiceId !== 'string' || !/^[a-zA-Z0-9_-]{0,100}$/.test(v.voiceId))
  )
    throw new AudioError('Invalid voice override.');
  return {
    ...base,
    prompt: v.prompt.trim(),
    text: v.text.trim(),
    duration: v.duration,
    volume: v.volume,
    ...(base.category === 'speech'
      ? { voiceId: typeof v.voiceId === 'string' ? v.voiceId : '' }
      : {}),
    loop:
      base.category === 'music' || base.category === 'ambience'
        ? v.loop
        : false,
  };
}
function fingerprint(cue: Cue, settings: AudioSettings) {
  return JSON.stringify({
    prompt: cue.prompt,
    ...(cue.category === 'speech'
      ? {
          text: cue.text,
          voiceId: cue.voiceId || settings.voiceId,
          language: 'en',
        }
      : { duration: cue.duration, loop: cue.loop }),
  });
}
export async function library(
  db: GameDatabase,
  game: GameId,
): Promise<AudioLibrary> {
  const [row, saved] = await Promise.all([
    db
      .prepare(
        'SELECT secret IS NOT NULL AS key_saved, settings, lease_until FROM audio_settings WHERE game = ?',
      )
      .bind(game)
      .first<{ key_saved: number; settings: string; lease_until: number }>(),
    db
      .prepare(
        'SELECT cue, config, file, generated, generated_config, error FROM audio_cues WHERE game = ?',
      )
      .bind(game)
      .all<CueRow>(),
  ]);
  const settings: AudioSettings = {
    ...DEFAULT_SETTINGS,
    ...JSON.parse(row?.settings || '{}'),
  };
  const map = new Map(saved.results.map((c) => [c.cue, c]));
  return {
    game,
    keySaved: !!row?.key_saved,
    settings,
    busy: (row?.lease_until ?? 0) > Date.now(),
    cues: getCatalog(game).map((base) => {
      const stored = map.get(base.id),
        cue = stored ? parseCue(base, JSON.parse(stored.config), false) : base;
      return {
        ...cue,
        file: stored?.file ?? null,
        generated: stored?.generated ?? null,
        error: stored?.error || '',
        stale:
          !!stored?.file &&
          stored.generated_config !== fingerprint(cue, settings),
      };
    }),
  };
}
export function manifest(data: AudioLibrary): AudioManifest {
  return {
    settings: data.settings,
    cues: Object.fromEntries(
      data.cues
        .map((c) =>
          !c.file &&
          data.game === 'chaos' &&
          c.id.startsWith('material.stairs.')
            ? {
                ...c,
                file:
                  data.cues.find(
                    (v) =>
                      v.id ===
                      c.id.replace('material.stairs.', 'material.floor.'),
                  )?.file ?? null,
              }
            : c,
        )
        .filter((c) => c.file && !(c.category === 'speech' && c.stale))
        .map((c) => [
          c.id,
          {
            url: `/api/handwerker/audio/${data.game}/file/${c.file!.split('/')[1]}`,
            volume: c.volume,
            loop: c.loop,
            category: c.category,
            ...(c.variantOf ? { variantOf: c.variantOf } : {}),
          },
        ]),
    ),
  };
}
async function secret(db: GameDatabase, game: GameId, storage: AudioStorage) {
  const row = await db
    .prepare(
      'SELECT secret, settings, lease_until FROM audio_settings WHERE game = ?',
    )
    .bind(game)
    .first<SettingsRow>();
  if (!row?.secret) throw new AudioError('Save your ElevenLabs API key first.');
  return decryptKey(row.secret, await storage.masterKey(), game);
}
export async function updateAudio(
  db: GameDatabase,
  game: GameId,
  body: Record<string, unknown>,
  storage: AudioStorage,
  request: typeof fetch = fetch,
) {
  await db
    .prepare(
      'INSERT INTO audio_settings (game) VALUES (?) ON CONFLICT(game) DO NOTHING',
    )
    .bind(game)
    .run();
  if (body.op === 'key') {
    if (
      typeof body.key !== 'string' ||
      body.key.trim().length < 16 ||
      body.key.length > 256 ||
      !/^[a-zA-Z0-9_-]+$/.test(body.key.trim())
    )
      throw new AudioError('Please enter a valid ElevenLabs API key.');
    const encrypted = await encryptKey(
      body.key.trim(),
      await storage.masterKey(),
      game,
    );
    await db
      .prepare('UPDATE audio_settings SET secret = ? WHERE game = ?')
      .bind(encrypted, game)
      .run();
    return { message: 'Key saved securely.' };
  }
  if (body.op === 'delete-key') {
    await db
      .prepare('UPDATE audio_settings SET secret = NULL WHERE game = ?')
      .bind(game)
      .run();
    return { message: 'Key removed.' };
  }
  if (body.op === 'reuse-setup') {
    if (game !== 'first-person' || body.from !== 'chaos')
      throw new AudioError('This saved setup cannot be reused here.');
    const source = await db
      .prepare(
        'SELECT secret, settings, lease_until FROM audio_settings WHERE game = ?',
      )
      .bind('chaos')
      .first<SettingsRow>();
    if (!source?.secret)
      throw new AudioError('No saved construction audio account is available.');
    const target = await library(db, game);
    if (target.busy)
      throw new AudioError('Wait for the current generation to finish.', 409);
    const master = await storage.masterKey();
    const encrypted = await encryptKey(
      await decryptKey(source.secret, master, 'chaos'),
      master,
      game,
    );
    const voiceId = parseSettings({
      ...DEFAULT_SETTINGS,
      ...JSON.parse(source.settings),
    }).voiceId;
    // Preserve a separately saved account, custom mix, and existing voice. No key leaves the server.
    await db
      .prepare(
        "UPDATE audio_settings SET secret = COALESCE(secret, ?), settings = CASE WHEN COALESCE(json_extract(settings, '$.voiceId'), '') = '' THEN json_set(settings, '$.voiceId', ?) ELSE settings END WHERE game = ? AND lease_until <= ?",
      )
      .bind(encrypted, voiceId, game, Date.now())
      .run();
    return {
      message:
        'Saved construction audio setup is available. Existing recordings and settings were kept.',
    };
  }
  if (body.op === 'voices') {
    const result = await elevenRequest(
      '/voices',
      await secret(db, game, storage),
      undefined,
      request,
    );
    const data = (await result.json()) as {
      voices?: {
        voice_id: string;
        name: string;
        description?: string | null;
        labels?: Record<string, string>;
        preview_url?: string | null;
      }[];
    };
    return {
      voices: (data.voices || []).slice(0, 250).map((v) => {
        let previewUrl: string | null = null;
        try {
          const url = new URL(v.preview_url || '');
          if (url.protocol === 'https:' && !url.username && !url.password)
            previewUrl = url.href;
        } catch {
          /* Voices without a public sample remain selectable. */
        }
        return {
          id: v.voice_id,
          name: v.name,
          description: v.description || '',
          labels: Object.fromEntries(
            Object.entries(v.labels || {}).filter(
              ([, value]) => typeof value === 'string',
            ),
          ),
          previewUrl,
        };
      }),
    };
  }
  if (body.op === 'settings') {
    await db
      .prepare('UPDATE audio_settings SET settings = ? WHERE game = ?')
      .bind(JSON.stringify(parseSettings(body.settings)), game)
      .run();
    return { message: 'Audio settings saved.' };
  }
  if (body.op === 'cancel') {
    if (
      typeof body.requestId !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(body.requestId)
    )
      throw new AudioError('Invalid generation request.');
    await cancelGeneration(db, game, body.requestId);
    return { message: 'Cancellation requested. Completed sounds are kept.' };
  }
  const base = getCatalog(game).find((c) => c.id === body.cueId);
  if (!base)
    throw new AudioError('This sound does not exist in this game.', 404);
  if (body.op === 'volume') {
    if (
      typeof body.volume !== 'number' ||
      !Number.isFinite(body.volume) ||
      body.volume < 0 ||
      body.volume > 1
    )
      throw new AudioError('Volume must be between 0 and 100 percent.');
    // Patch only playback gain; preserve custom prompts, generation metadata,
    // the current audio file and concurrent prompt edits.
    await db
      .prepare(
        "INSERT INTO audio_cues (game, cue, config) VALUES (?, ?, ?) ON CONFLICT(game, cue) DO UPDATE SET config = json_set(audio_cues.config, '$.volume', ?)",
      )
      .bind(
        game,
        base.id,
        JSON.stringify({ ...base, volume: body.volume }),
        body.volume,
      )
      .run();
    return { message: 'In-game volume saved. No regeneration needed.' };
  }
  if (body.op === 'cue') {
    const config = parseCue(base, body.config);
    await db
      .prepare(
        'INSERT INTO audio_cues (game, cue, config) VALUES (?, ?, ?) ON CONFLICT(game, cue) DO UPDATE SET config = excluded.config',
      )
      .bind(game, base.id, JSON.stringify(config))
      .run();
    return { message: 'Prompt and sound settings saved.' };
  }
  if (body.op !== 'generate') throw new AudioError('Unknown audio action.');
  if (
    typeof body.requestId !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(body.requestId)
  )
    throw new AudioError('Invalid generation request.');
  const key = await secret(db, game, storage),
    lease = crypto.randomUUID();
  const lock = await db
    .prepare(
      'UPDATE audio_settings SET lease = ?, lease_until = ? WHERE game = ? AND lease_until < ?',
    )
    .bind(lease, Date.now() + 240_000, game, Date.now())
    .run();
  if (!lock.meta.changes)
    throw new AudioError(
      'A generation is already running for this game. Wait for it to finish.',
      409,
    );
  let started = false;
  let cancellation: Awaited<ReturnType<typeof watchGeneration>> | undefined;
  try {
    cancellation = await watchGeneration(db, game, body.requestId);
    await cancellation.assertActive();
    const old = await db
      .prepare('SELECT * FROM audio_cues WHERE game = ? AND cue = ?')
      .bind(game, base.id)
      .first<CueRow>();
    if (old?.request === body.requestId)
      throw new AudioError(
        'This job has already been processed. Refresh the status before starting a new job.',
        409,
      );
    const data = await library(db, game),
      cue = data.cues.find((c) => c.id === base.id)!;
    // Validate before starting a potentially billable request.
    const validated = parseCue(base, cue);
    if (cue.category === 'speech' && !cue.voiceId && !data.settings.voiceId)
      throw new AudioError('Select and save a voice first.');
    await db
      .prepare(
        'INSERT INTO audio_cues (game, cue, config, request) VALUES (?, ?, ?, ?) ON CONFLICT(game, cue) DO UPDATE SET request = excluded.request, error = ?',
      )
      .bind(game, base.id, JSON.stringify(validated), body.requestId, '')
      .run();
    started = true;
    await cancellation.assertActive();
    const bytes = await generateAudio(
      validated,
      data.settings,
      key,
      request,
      cancellation.signal,
    );
    await cancellation.assertActive();
    const file = `${game}/${crypto.randomUUID()}.mp3`;
    await storage.putAudio(file, bytes);
    await cancellation.assertActive();
    await db
      .prepare(
        'UPDATE audio_cues SET file = ?, generated = ?, generated_config = ?, error = ? WHERE game = ? AND cue = ? AND request = ?',
      )
      .bind(
        file,
        Date.now(),
        fingerprint(validated, data.settings),
        '',
        game,
        base.id,
        body.requestId,
      )
      .run();
    return { message: 'Sound generated and available in game.' };
  } catch (error) {
    const safe = cancellation?.signal.aborted
      ? new AudioError('Generation cancelled.', 409)
      : error instanceof AudioError
        ? error
        : new AudioError(
            'The sound could not be saved. Check audio storage before generating again.',
            503,
          );
    if (started)
      await db
        .prepare('UPDATE audio_cues SET error = ? WHERE game = ? AND cue = ?')
        .bind(safe.message, game, base.id)
        .run();
    throw safe;
  } finally {
    await cancellation?.dispose();
    await db
      .prepare(
        'UPDATE audio_settings SET lease = NULL, lease_until = 0 WHERE game = ? AND lease = ?',
      )
      .bind(game, lease)
      .run();
  }
}
