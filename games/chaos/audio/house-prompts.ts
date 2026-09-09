// Six separately directed actions: no generic material substitution.
export const houseMaterial = {
  fridge: {
    grab: 'Gloves lift a compact enamel fridge: rubber feet peel from the floor, a heavy cabinet creaks and an empty glass shelf ticks once.',
    place:
      'A compact fridge is aligned upright on a wooden floor: two pairs of rubber feet thud softly, followed by one glass shelf rattle.',
    drop: 'A compact fridge is set down heavily on concrete: rubber feet thump, thin enamel panels resonate and the closed door latch rattles.',
    remove:
      'A fridge rocks free of its position: rubber feet squeak on flooring, the metal cabinet creaks and a shelf slides a few millimetres.',
    throw:
      'Gloves heave and release a compact fridge: sleeve strain, cabinet flex and one loose shelf clink. End at release, no landing.',
    impact:
      'An intact compact fridge lands on its side: a heavy hollow enamel cabinet clonk, a springy panel wobble and a short shelf rattle. No shattered glass.',
  },
  washer: {
    grab: 'Gloves lift a small front-loading washing machine: rubber feet unstick, a heavy metal frame creaks and the suspended empty drum rocks once.',
    place:
      'A washing machine is seated on four rubber feet: low cushioned contacts, then a brief suspended drum oscillation with a soft spring creak.',
    drop: 'A washing machine is put down abruptly on concrete: weighty cabinet thud, two hollow drum knocks and a short damping spring wobble.',
    remove:
      'A washing machine is dragged slightly then lifted: rubber feet squeal briefly on wood and the loose suspended drum knocks softly inside.',
    throw:
      'A worker heaves a washing machine: glove scuff on enamel, strained casing creak and the suspended drum rolling to one side. Stop at release.',
    impact:
      'A washing machine tips onto concrete: broad metal cabinet clonk, a rubber-damped drum bounce and a final small control knob tick. Machine remains intact.',
  },
  clock: {
    grab: 'A wooden grandfather clock is lifted carefully: palm friction on varnished oak, case joint creak and one quiet brass pendulum tap.',
    place:
      'A grandfather clock settles upright on wooden flooring: two dry oak foot taps, a case creak and a tiny glass-door latch tick.',
    drop: 'A wooden grandfather clock is set firmly on concrete: hollow oak knock, pendulum tapping the case twice, then a little brass mechanism rattle.',
    remove:
      'A tall oak grandfather clock is eased out of its corner: wooden feet scrape, the case creaks and the brass pendulum swings against its stop.',
    throw:
      'Hands swing and release a wooden grandfather clock: varnished wood rubbing, case flex and loose brass pendulum chatter. No landing or chime.',
    impact:
      'An intact oak grandfather clock falls sideways: hollow wooden thump, pendulum clack and a brief off-key brass chime struck by the jolt. No glass breaking.',
  },
  duck: {
    grab: 'A gloved hand picks up a rubber bath duck: dry rubber rubbing and a tiny accidental airy squeak as the body compresses.',
    place:
      'A rubber bath duck is gently placed on wood: soft hollow rubber pat and a tiny air release. No exaggerated impact.',
    drop: 'A hollow rubber bath duck is dropped onto concrete: a soft rubber plop, one little bounce and a brief imperfect squeak.',
    remove:
      'A rubber bath duck is peeled from a wooden surface: short sticky rubber rub, then a small suction pop as its base lifts.',
    throw:
      'A gloved hand squeezes and throws a rubber bath duck: one compressed nasal squeak and rubber friction. Stop at release, no landing.',
    impact:
      'A rubber bath duck bounces on concrete: three diminishing hollow rubber pats and an involuntary short squeak on the first bounce.',
  },
} as const;
