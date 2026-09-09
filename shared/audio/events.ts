import type { SiteAudio } from './player';
import type { AudioEvent } from './world';
export function playEvents(audio: SiteAudio, cues: AudioEvent[]) {
  cues.sort(
    (a, b) =>
      Number(/speech\.(win|fail)$/.test(b.id)) -
      Number(/speech\.(win|fail)$/.test(a.id)),
  );
  for (const cue of cues) {
    if (cue.variant || cue.id.startsWith('step.'))
      audio.variant(cue.id, cue.strength, cue.position, cue.sourceId);
    else audio.play(cue.id, cue.strength, cue.position, cue.sourceId);
  }
}
