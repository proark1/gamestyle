import type { Cue } from './types';
const materials = {
  crate: [
    'Wooden crate',
    'Intact hollow timber crate with nailed slats',
    'dry wood taps, restrained hollow box resonance and small joint creaks',
  ],
  pallet: [
    'Pallet',
    'Heavy slatted timber pallet',
    'layered low wooden clacks, rough edge scraping and short board flex',
  ],
  plank: [
    'Long plank',
    'Long solid timber plank',
    'low woody knock, small grain scrape and short flexible board vibration',
  ],
  sofa: [
    'Old sofa',
    'Heavy fabric sofa with foam cushions and a timber frame',
    'muted padded thump, upholstery friction and subtle spring and frame creak',
  ],
  bathtub: [
    'Bathtub',
    'Intact enamel-coated metal bathtub',
    'rounded hollow low metal thunk and brief rim resonance, no cracking enamel',
  ],
  fridge: [
    'Fridge',
    'Unpowered intact steel refrigerator with internal shelves',
    'heavy dull panel thud, short sheet-metal flex and a tiny internal shelf rattle',
  ],
} as const;
const actions = {
  grab: [
    'Pick up',
    'Lift clear of compact sand by hand; initial surface release and weight settling in the grip. No landing impact.',
    1.2,
  ],
  place: [
    'Place',
    'Carefully lower onto firm stacked salvage; a small first contact followed by full weight settling. No drop from height.',
    1.5,
  ],
  impact: [
    'Impact',
    'Fall a short distance onto a rigid support; one weighty contact, small secondary bounce and quick settling. Remains intact.',
    2,
  ],
  rotate: [
    'Turn',
    'Turn a carried load in the hands; slight grip adjustment and torsional strain. No contact with the ground.',
    1.1,
  ],
  splash: [
    'Hit water',
    'Enter shallow seawater after a short fall; body-sized splash and a little water running over its surface, brief material contact below the water.',
    2.3,
  ],
} as const;
export function salvageCues(): Cue[] {
  return Object.entries(materials).flatMap(([id, [name, object, texture]]) =>
    Object.entries(actions).map(([action, [label, motion, duration]]) => ({
      id: `material.${id}.${action}`,
      name: `${name} · ${label}`,
      group: name,
      category: 'material',
      prompt: `${object}. ${motion} Emphasize ${texture}. Real close outdoor Foley, natural mass, clean onset and short decay. No speech, music, destruction, beeps or cartoon effects.`,
      duration,
      loop: false,
      volume: action === 'impact' ? 0.8 : 0.65,
      text: '',
    })),
  );
}
