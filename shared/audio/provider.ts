import { AudioError } from './errors';
export { AudioError } from './errors';
import type { Cue, AudioSettings } from './types';
import { promptLimit } from './limits';
const API = 'https://api.elevenlabs.io/v1';
async function providerErrorCode(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  try {
    const decoder = new TextDecoder();
    let text = '',
      size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        return '';
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const detail = JSON.parse(text)?.detail;
    return typeof detail?.code === 'string'
      ? detail.code
      : typeof detail?.status === 'string'
        ? detail.status
        : '';
  } catch {
    return '';
  } finally {
    reader.releaseLock();
  }
}
export async function elevenRequest(
  path: string,
  key: string,
  body?: unknown,
  request: typeof fetch = fetch,
  signal?: AbortSignal,
) {
  let response: Response;
  try {
    response = await request(`${API}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'xi-api-key': key,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(180_000)])
        : AbortSignal.timeout(180_000),
    });
  } catch {
    if (signal?.aborted) throw new AudioError('Generation cancelled.', 409);
    throw new AudioError(
      'ElevenLabs did not respond in time. Check the status before retrying; the job may already have been charged.',
      504,
    );
  }
  if (!response.ok) {
    // Map only recognized codes to our own messages. Never expose raw provider
    // text, unknown codes, prompts or credentials, even in server logs.
    const code = await providerErrorCode(response);
    const explanations: Record<string, string> = {
      text_too_long:
        'ElevenLabs rejected the prompt length. Shorten the prompt before retrying.',
      max_character_limit_exceeded:
        'ElevenLabs rejected the prompt length. Shorten the prompt before retrying.',
      quota_exceeded:
        'Your ElevenLabs credit allowance is exhausted. Check your subscription or API-key credit limit.',
      rate_limit_exceeded:
        'ElevenLabs rate limit reached. Wait before resuming the batch.',
      concurrent_limit_exceeded:
        'Your ElevenLabs account has too many active jobs. Wait for them to finish, then resume.',
      too_many_concurrent_requests:
        'Your ElevenLabs account has too many active jobs. Wait for them to finish, then resume.',
      voice_not_found:
        'The selected ElevenLabs voice is unavailable. Select and save another voice.',
      invalid_parameters:
        'ElevenLabs rejected a generation setting. Check the prompt, model, duration and voice.',
    };
    const errors: Record<number, string> = {
      400: 'ElevenLabs rejected this request. Check the prompt length and generation settings before retrying.',
      401: 'ElevenLabs rejected the key. Check or replace it.',
      403: 'This key or plan does not allow this feature. Check your ElevenLabs permissions.',
      402: 'Your ElevenLabs credits or plan do not cover this generation.',
      429: 'ElevenLabs limit reached. Check your credits and active jobs before retrying.',
      422: 'ElevenLabs rejected these settings. Check the prompt, voice and duration.',
    };
    throw new AudioError(
      `${Object.hasOwn(explanations, code) ? explanations[code] : errors[response.status] || (response.status >= 500 ? 'ElevenLabs has a temporary server error. Your saved sounds are kept; resume later.' : 'ElevenLabs rejected the job. Check the generation settings before retrying.')} (ElevenLabs HTTP ${response.status}${Object.hasOwn(explanations, code) ? `; ${code}` : ''})`,
      response.status >= 500 ? 502 : 400,
    );
  }
  return response;
}
export function generationRequest(cue: Cue, settings: AudioSettings) {
  if (cue.prompt.length > promptLimit(cue.category))
    throw new AudioError(
      `${cue.name}: prompt is ${cue.prompt.length} characters; the limit is ${promptLimit(cue.category)}. Shorten it before generating.`,
    );
  if (cue.category === 'speech') {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(settings.voiceId))
      throw new AudioError(
        'Select an ElevenLabs voice and save your settings first.',
      );
    return {
      path: `/text-to-speech/${settings.voiceId}?output_format=mp3_44100_128`,
      body: {
        text: `${cue.prompt}\n${cue.text}`,
        model_id: 'eleven_v3',
        language_code: 'en',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      },
    };
  }
  if (cue.category === 'music')
    return {
      path: '/music?output_format=mp3_44100_128',
      body: {
        prompt: cue.prompt,
        music_length_ms: Math.round(cue.duration * 1000),
        force_instrumental: true,
        model_id: 'music_v1',
      },
    };
  return {
    path: '/sound-generation?output_format=mp3_44100_128',
    body: {
      text: cue.prompt,
      duration_seconds: cue.duration,
      loop: cue.loop,
      prompt_influence: 0.65,
      model_id: 'eleven_text_to_sound_v2',
    },
  };
}
export async function generateAudio(
  cue: Cue,
  settings: AudioSettings,
  key: string,
  request: typeof fetch = fetch,
  signal?: AbortSignal,
) {
  const spec = generationRequest(cue, settings),
    response = await elevenRequest(spec.path, key, spec.body, request, signal);
  if (
    !/audio\/(mpeg|mp3)|application\/octet-stream/i.test(
      response.headers.get('content-type') || '',
    )
  )
    throw new AudioError('ElevenLabs did not return an audio file.', 502);
  const reader = response.body?.getReader();
  if (!reader) throw new AudioError('The audio file is empty.', 502);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      throw new AudioError('Generation cancelled.', 409);
    }
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 12 * 1024 * 1024) {
      await reader.cancel();
      throw new AudioError(
        'The audio file is too large. Choose a shorter duration.',
        502,
      );
    }
    chunks.push(value);
  }
  if (size < 32)
    throw new AudioError('ElevenLabs returned an empty audio file.', 502);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
