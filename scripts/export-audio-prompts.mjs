import { writeFileSync } from 'node:fs';
import { getCatalog } from '../platform/audio/catalog.ts';
import { GAME_NAMES } from '../shared/audio/types.ts';
let text =
  '# Jumbleyard sound prompts\n\nGenerated from the editable workshop defaults. Use `npm run audio:prompts` after changing the catalog. Effects describe a single physical action; footsteps and animal sounds have alternate takes. Speech direction and spoken text are separate. Prompts are ready to generate; this document is not an inventory of generated files.\n';
for (const game of Object.keys(GAME_NAMES)) {
  const cues = getCatalog(game);
  text += `\n## ${GAME_NAMES[game]} — ${cues.length} cues\n`;
  for (const c of cues)
    text += `\n### ${c.name}\n\nID: \`${c.id}\` · ${c.category} · ${c.duration}s · ${c.loop ? 'loop' : 'one-shot'} · cue volume ${Math.round(c.volume * 100)}%\n\n${c.prompt}\n${c.text ? `\nSpoken text: ${c.text}\n` : ''}`;
}
writeFileSync('docs/audio-prompts.md', text);
console.log('Exported all game sound catalogs to docs/audio-prompts.md.');
