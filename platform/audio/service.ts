import type { GameDatabase } from '@/db/contract';
import { getCatalog } from './catalog';
import { FARM_FENCE_CUES } from '../../games/act-natural/audio/fence';
import { GIANT_DEFAULT_AUDIO } from '../../games/dont-wake-the-giant/audio/profile';
import { BUTTON_DEFAULT_AUDIO } from '../../games/one-more-button/audio/profile';
import { decryptKey, encryptKey } from '../../shared/audio/crypto';
import {
  AudioError,
  elevenRequest,
  generateAudio,
} from '../../shared/audio/provider';
import {
  cancelGeneration,
  watchGeneration,
} from '../../shared/audio/cancellation';
import { promptLimit } from '../../shared/audio/limits';
import { narratorAction, narratorState } from './narrator';
import {
  DEFAULT_SETTINGS,
  audioFileUrl,
  isGameId,
  type AudioLibrary,
  type AudioManifest,
  type AudioSettings,
  type Cue,
  type GameId,
} from '../../shared/audio/types';

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
  return {
    ...base,
    prompt: v.prompt.trim(),
    text: v.text.trim(),
    duration: v.duration,
    volume: v.volume,
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
      ? { text: cue.text, voiceId: settings.voiceId, language: 'en' }
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
  const narrator = await narratorState(db);
  // A newly added game inherits the collection's already approved narrator.
  if (
    (game === 'uphill-delivery' ||
      game === 'dont-wake-the-giant' ||
      game === 'reel-problems' ||
      game === 'four-brain-cells') &&
    !settings.voiceId &&
    narrator.voice
  )
    settings.voiceId = narrator.voice.id;
  const sharedKey = narrator.voice
    ? await db
        .prepare(
          'SELECT secret IS NOT NULL AS available FROM audio_settings WHERE game = ?',
        )
        .bind(narrator.voice.sourceGame)
        .first<{ available: number }>()
    : null;
  return {
    game,
    keySaved: !!row?.key_saved,
    keyAvailable: !!row?.key_saved || !!sharedKey?.available,
    settings,
    busy: (row?.lease_until ?? 0) > Date.now(),
    cues: getCatalog(game).map((base) => {
      const stored = map.get(base.id),
        cue = stored ? parseCue(base, JSON.parse(stored.config), false) : base;
      return {
        ...cue,
        file: stored?.file ?? null,
        ...(game === 'one-more-button' && BUTTON_DEFAULT_AUDIO[base.id]
          ? { bundledUrl: BUTTON_DEFAULT_AUDIO[base.id].url }
          : {}),
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
  const bundled =
    data.game === 'act-natural'
      ? FARM_FENCE_CUES
      : data.game === 'dont-wake-the-giant'
        ? GIANT_DEFAULT_AUDIO
        : data.game === 'one-more-button'
          ? BUTTON_DEFAULT_AUDIO
          : {};
  return {
    settings: data.settings,
    cues: Object.fromEntries(
      data.cues
        .filter(
          (c) =>
            (c.file && !(c.category === 'speech' && c.stale)) || bundled[c.id],
        )
        .map((c) => [
          c.id,
          {
            url:
              c.file && !(c.category === 'speech' && c.stale)
                ? audioFileUrl(c.file)
                : bundled[c.id].url,
            volume: c.volume,
            loop: c.loop,
            category: c.category,
          },
        ]),
    ),
  };
}
async function secretSource(
  db: GameDatabase,
  game: GameId,
  storage: AudioStorage,
  voiceId?: string,
  exact = false,
) {
  const narrator = await narratorState(db);
  if (voiceId && narrator.voice?.id === voiceId)
    game = narrator.voice.sourceGame;
  const row = await db
    .prepare(
      'SELECT secret, settings, lease_until FROM audio_settings WHERE game = ?',
    )
    .bind(game)
    .first<SettingsRow>();
  if (row?.secret)
    return {
      key: await decryptKey(row.secret, await storage.masterKey(), game),
      sourceGame: game,
    };
  if (!exact && narrator.voice && narrator.voice.sourceGame !== game) {
    const source = narrator.voice.sourceGame;
    const shared = await db
      .prepare('SELECT secret FROM audio_settings WHERE game = ?')
      .bind(source)
      .first<{ secret: string | null }>();
    if (shared?.secret)
      return {
        key: await decryptKey(shared.secret, await storage.masterKey(), source),
        sourceGame: source,
      };
  }
  throw new AudioError('Save your ElevenLabs API key first.');
}
export async function updateAudio(
  db: GameDatabase,
  game: GameId,
  body: Record<string, unknown>,
  storage: AudioStorage,
  request: typeof fetch = fetch,
) {
  if (typeof body.op === 'string' && body.op.startsWith('narrator-'))
    return narratorAction(
      db,
      game,
      body,
      storage,
      (source, exact) => secretSource(db, source, storage, undefined, exact),
      request,
    );
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
  if (body.op === 'voices') {
    const result = await elevenRequest(
      '/voices',
      (await secretSource(db, game, storage)).key,
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
  if (body.op === 'reuse') {
    if (!isGameId(body.sourceGame) || body.sourceGame === game)
      throw new AudioError('Choose another game’s sound library.');
    const [source, target] = await Promise.all([
      library(db, body.sourceGame),
      library(db, game),
    ]);
    const settings = {
      ...target.settings,
      voiceId: target.settings.voiceId || source.settings.voiceId,
    };
    const lease = crypto.randomUUID();
    const lock = await db
      .prepare(
        'UPDATE audio_settings SET lease = ?, lease_until = ? WHERE game = ? AND lease_until < ?',
      )
      .bind(lease, Date.now() + 30_000, game, Date.now())
      .run();
    if (!lock.meta.changes)
      throw new AudioError(
        'Wait for the current generation to finish before reusing sounds.',
        409,
      );
    try {
      const statements = [];
      for (const base of getCatalog(game)) {
        const saved = source.cues.find((c) => c.id === base.id);
        if (!saved?.file || saved.stale || saved.category !== base.category)
          continue;
        // Game-specific dialogue with the same cue ID must never be swapped in.
        if (
          base.category === 'speech' &&
          (base.text !== saved.text ||
            source.settings.voiceId !== settings.voiceId)
        )
          continue;
        const config = {
          ...base,
          prompt: saved.prompt,
          text: saved.text,
          duration: saved.duration,
          loop: saved.loop,
          volume: saved.volume,
        };
        statements.push(
          db
            .prepare(
              'INSERT INTO audio_cues (game, cue, config, file, generated, generated_config) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(game, cue) DO NOTHING',
            )
            .bind(
              game,
              base.id,
              JSON.stringify(config),
              saved.file,
              saved.generated,
              fingerprint(config, settings),
            ),
        );
      }
      // Only fill an unset voice; do not overwrite a concurrently saved mix.
      statements.push(
        db
          .prepare(
            "UPDATE audio_settings SET settings = json_set(settings, '$.voiceId', ?) WHERE game = ? AND COALESCE(json_extract(settings, '$.voiceId'), '') = ''",
          )
          .bind(settings.voiceId, game),
      );
      const results = (await db.batch(statements)) as {
        meta: { changes: number };
      }[];
      const reused = results
        .slice(0, -1)
        .reduce((sum, result) => sum + result.meta.changes, 0);
      return {
        reused,
        message: `${reused} saved sounds reused. Existing edits were kept. No audio was generated.`,
      };
    } finally {
      await db
        .prepare(
          'UPDATE audio_settings SET lease_until = 0, lease = NULL WHERE game = ? AND lease = ?',
        )
        .bind(game, lease)
        .run();
    }
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
  const lease = crypto.randomUUID();
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
    if (cue.category === 'speech' && !data.settings.voiceId)
      throw new AudioError('Select and save a voice first.');
    const key = (
      await secretSource(
        db,
        game,
        storage,
        cue.category === 'speech' ? data.settings.voiceId : undefined,
      )
    ).key;
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
