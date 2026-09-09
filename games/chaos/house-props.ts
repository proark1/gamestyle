import type { ItemKind } from './model';

export const PROP_USES: Partial<
  Record<ItemKind, { label: string; cue: string; duration: number }>
> = {
  sink: { label: 'Run the tap', cue: 'prop.sink.use', duration: 3500 },
  stove: { label: 'Cook dinner', cue: 'prop.stove.use', duration: 4500 },
  bathtub: {
    label: 'Make a bubble bath',
    cue: 'prop.bathtub.use',
    duration: 4500,
  },
  tv: {
    label: 'Watch the renovation channel',
    cue: 'prop.tv.use',
    duration: 6000,
  },
  piano: { label: 'Play the piano', cue: 'prop.piano.use', duration: 4000 },
  aquarium: {
    label: 'Feed the fish',
    cue: 'prop.aquarium.use',
    duration: 3500,
  },
  easel: { label: 'Paint a picture', cue: 'prop.easel.use', duration: 4000 },
  fridge: { label: 'Check the fridge', cue: 'prop.fridge.use', duration: 2400 },
  washer: { label: 'Run a spin cycle', cue: 'prop.washer.use', duration: 4500 },
  clock: { label: 'Wind the clock', cue: 'prop.clock.use', duration: 3000 },
  duck: { label: 'Squeeze the duck', cue: 'prop.duck.use', duration: 900 },
  toilet: { label: 'Test the flush', cue: 'prop.toilet.use', duration: 3500 },
  lamp: { label: 'Test the lamp', cue: 'prop.lamp.use', duration: 900 },
};
