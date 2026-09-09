import type { SiteAudio } from './player';
import type { SceneAudioPlan } from './scene-plan';

export function applyScenePlan(
  clips: SiteAudio,
  plan: SceneAudioPlan,
  available: ReadonlySet<string>,
  fallback: (id: string) => void,
) {
  if (plan.reset) clips.reset();
  if (plan.listener) clips.listen(plan.listener);
  for (const { channel, id, strength } of plan.loops)
    clips.setLoop(channel, id, strength);
  for (const hit of plan.hits) {
    if (
      hit.variant &&
      [hit.id, ...[1, 2, 3].map((n) => `${hit.id}.${n}`)].some((id) =>
        available.has(id),
      )
    )
      clips.variant(hit.id, hit.strength, hit.position, hit.sourceId);
    else if (available.has(hit.id))
      clips.play(hit.id, hit.strength, hit.position, hit.sourceId);
    else fallback(hit.id);
  }
}
