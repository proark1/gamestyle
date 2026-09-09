import type { GameDatabase } from '@/db/contract';
import type { AudioStorage } from './service';
import {
  AudioError,
  elevenRequest,
  generateAudio,
} from '../../shared/audio/provider';
import {
  DEFAULT_SETTINGS,
  GAME_NAMES,
  type GameId,
} from '../../shared/audio/types';
import {
  NARRATOR_DEFAULTS,
  type NarratorConfig,
  type NarratorState,
} from '../../shared/audio/narrator-config';

// A reserved settings row shares the narrator across the collection without changing game mixes.
const SHARED = 'shared-narrator';
async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader)
    throw new AudioError('ElevenLabs returned an empty response.', 502);
  const decoder = new TextDecoder();
  let text = '',
    size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 24 * 1024 * 1024) {
        await reader.cancel();
        throw new AudioError(
          'The audition response is too large. Shorten the audition script.',
          502,
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (e) {
    if (e instanceof AudioError) throw e;
    throw new AudioError(
      'The voice response could not be read. Check the status before generating again.',
      502,
    );
  } finally {
    reader.releaseLock();
  }
}
export async function narratorState(db: GameDatabase): Promise<NarratorState> {
  const row = await db
    .prepare('SELECT settings, lease_until FROM audio_settings WHERE game = ?')
    .bind(SHARED)
    .first<{ settings: string; lease_until: number }>();
  return {
    config: NARRATOR_DEFAULTS,
    audition: null,
    voice: null,
    sample: null,
    ...JSON.parse(row?.settings || '{}'),
    busy: (row?.lease_until || 0) > Date.now(),
  };
}
export function parseNarrator(value: unknown): NarratorConfig {
  const v = value as NarratorConfig | undefined;
  if (
    !v ||
    typeof v.name !== 'string' ||
    !v.name.trim() ||
    v.name.length > 80 ||
    typeof v.description !== 'string' ||
    v.description.trim().length < 20 ||
    v.description.length > 1000 ||
    typeof v.text !== 'string' ||
    v.text.trim().length < 100 ||
    v.text.length > 1000
  )
    throw new AudioError(
      'Enter a voice name (1–80 characters), description (20–1000), and audition text (100–1000).',
    );
  return {
    name: v.name.trim(),
    description: v.description.trim(),
    text: v.text.trim(),
  };
}
export async function narratorAction(
  db: GameDatabase,
  game: GameId,
  body: Record<string, unknown>,
  storage: AudioStorage,
  keyFor: (
    game: GameId,
    exact?: boolean,
  ) => Promise<{ key: string; sourceGame: GameId }>,
  request: typeof fetch = fetch,
) {
  if (body.op === 'narrator-get') return narratorState(db);
  const allowed = [
    'narrator-save',
    'narrator-design',
    'narrator-select',
    'narrator-speak',
  ];
  if (!allowed.includes(String(body.op)))
    throw new AudioError('Unknown narrator action.');
  // Validate before any provider calls. A single cross-game lease prevents overlapping auditions and selections.
  const config =
    body.op === 'narrator-save' || body.op === 'narrator-design'
      ? parseNarrator(body.config)
      : null;
  if (
    body.op === 'narrator-speak' &&
    (typeof body.text !== 'string' ||
      !body.text.trim() ||
      body.text.length > 1000)
  )
    throw new AudioError('Enter spoken text of 1–1000 characters.');
  await db
    .prepare(
      'INSERT INTO audio_settings (game) VALUES (?) ON CONFLICT(game) DO NOTHING',
    )
    .bind(SHARED)
    .run();
  const lease = crypto.randomUUID();
  const lock = await db
    .prepare(
      'UPDATE audio_settings SET lease = ?, lease_until = ? WHERE game = ? AND lease_until < ?',
    )
    .bind(lease, Date.now() + 240_000, SHARED, Date.now())
    .run();
  if (!lock.meta.changes)
    throw new AudioError(
      'The narrator is busy in a workshop. Wait, then refresh its status.',
      409,
    );
  try {
    const state = await narratorState(db);
    const persist = () =>
      db
        .prepare(
          'UPDATE audio_settings SET settings = ? WHERE game = ? AND lease = ?',
        )
        .bind(JSON.stringify({ ...state, busy: false }), SHARED, lease)
        .run();
    if (config) {
      state.config = config;
      await persist();
    }
    if (body.op === 'narrator-design') {
      const { key, sourceGame } = await keyFor(game);
      const response = await elevenRequest(
        '/text-to-voice/design?output_format=mp3_44100_128',
        key,
        {
          voice_description: config!.description,
          text: config!.text,
          model_id: 'eleven_ttv_v3',
          auto_generate_text: false,
        },
        request,
      );
      const result = (await boundedJson(response)) as {
        previews?: {
          generated_voice_id: string;
          audio_base_64: string;
          media_type: string;
        }[];
      };
      if (
        !Array.isArray(result.previews) ||
        !result.previews.length ||
        result.previews.length > 10
      )
        throw new AudioError(
          'ElevenLabs returned no usable voice auditions.',
          502,
        );
      const previews = [];
      for (const p of result.previews) {
        if (
          !/^[a-zA-Z0-9_-]{1,100}$/.test(p.generated_voice_id) ||
          typeof p.audio_base_64 !== 'string' ||
          p.audio_base_64.length > 16 * 1024 * 1024 ||
          !/^audio\/(mpeg|mp3)$/.test(p.media_type)
        )
          throw new AudioError('ElevenLabs returned an invalid audition.', 502);
        let bytes: Uint8Array;
        try {
          bytes = Uint8Array.from(atob(p.audio_base_64), (c) =>
            c.charCodeAt(0),
          );
        } catch {
          throw new AudioError(
            'ElevenLabs returned an invalid audio file.',
            502,
          );
        }
        if (bytes.length < 32)
          throw new AudioError('The audition audio is empty.', 502);
        const file = crypto.randomUUID() + '.mp3';
        await storage.putAudio(`${sourceGame}/${file}`, bytes);
        previews.push({
          id: p.generated_voice_id,
          url: `/api/audio/${sourceGame}/file/${file}`,
        });
      }
      state.audition = { config: config!, sourceGame, previews };
      await persist();
    }
    if (body.op === 'narrator-select') {
      const audition = state.audition;
      const preview = audition?.previews.find((p) => p.id === body.previewId);
      if (!audition || !preview)
        throw new AudioError(
          'This audition is no longer available. Refresh the narrator.',
        );
      if (!preview.voiceId) {
        const { key } = await keyFor(audition.sourceGame, true);
        const response = await elevenRequest(
          '/text-to-voice',
          key,
          {
            voice_name: audition.config.name,
            voice_description: audition.config.description,
            generated_voice_id: preview.id,
          },
          request,
        );
        const created = (await boundedJson(response)) as { voice_id?: string };
        if (
          !created.voice_id ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(created.voice_id)
        )
          throw new AudioError('ElevenLabs returned no saved voice ID.', 502);
        preview.voiceId = created.voice_id;
        // Keep the created ID before applying it, so a retried selection does not create another voice.
        await persist();
      }
      const voiceId = preview.voiceId;
      state.voice = {
        id: voiceId,
        name: audition.config.name,
        sourceGame: audition.sourceGame,
      };
      await db.batch([
        ...Object.keys(GAME_NAMES).map((target) =>
          db
            .prepare(
              "INSERT INTO audio_settings (game, settings) VALUES (?, ?) ON CONFLICT(game) DO UPDATE SET settings = json_set(audio_settings.settings, '$.voiceId', ?)",
            )
            .bind(
              target,
              JSON.stringify({ ...DEFAULT_SETTINGS, voiceId }),
              voiceId,
            ),
        ),
        db
          .prepare(
            'UPDATE audio_settings SET settings = ? WHERE game = ? AND lease = ?',
          )
          .bind(JSON.stringify({ ...state, busy: false }), SHARED, lease),
      ]);
    }
    if (body.op === 'narrator-speak') {
      if (!state.voice)
        throw new AudioError('Choose and save a narrator audition first.');
      const { key } = await keyFor(state.voice.sourceGame, true);
      const spokenText = (body.text as string).trim();
      const bytes = await generateAudio(
        {
          id: 'narrator.sample',
          name: 'Narrator sample',
          group: 'Narrator',
          category: 'speech',
          prompt: '[playfully]',
          text: spokenText,
          duration: 10,
          loop: false,
          volume: 1,
        },
        { ...DEFAULT_SETTINGS, voiceId: state.voice.id },
        key,
        request,
      );
      const file = crypto.randomUUID() + '.mp3';
      await storage.putAudio(`${game}/${file}`, bytes);
      state.sample = {
        text: spokenText,
        url: `/api/audio/${game}/file/${file}`,
        voiceId: state.voice.id,
      };
      await persist();
    }
    return { ...state, busy: false };
  } finally {
    await db
      .prepare(
        'UPDATE audio_settings SET lease = NULL, lease_until = 0 WHERE game = ? AND lease = ?',
      )
      .bind(SHARED, lease)
      .run();
  }
}
