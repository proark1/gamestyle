import { cue } from '../../../shared/audio/catalog-helpers';
import type { Cue } from '../../../shared/audio/types';

const rig =
  'High-altitude skyscraper window cleaning sounds. 80 stories up, metal cables, soapy water, wind buffeting, comical vertigo slapstick, clean punchy mix, no speech.';

const fx = (
  id: string,
  name: string,
  prompt: string,
  duration: number,
  volume = 0.75,
) =>
  cue(
    id,
    name,
    'Scaffold Scramble',
    `${prompt} ${rig}`,
    'event',
    Math.max(0.5, duration),
    false,
    volume,
  );

const bed = (
  id: string,
  name: string,
  prompt: string,
  duration: number,
  volume = 0.45,
) =>
  cue(
    id,
    name,
    'Scaffold Scramble',
    `${prompt} ${rig}`,
    'ambience',
    duration,
    true,
    volume,
  );

export const scaffoldScrambleCatalog: Cue[] = [
  fx(
    'event.start',
    'Shift start whistle',
    'A crisp mechanical air whistle starting the window-washing shift.',
    1.8,
  ),
  fx(
    'crank.ratchet',
    'Winch ratchet click',
    'Heavy mechanical steel ratchet teeth clicking rhythmically as a manual cable winch is turned.',
    0.6,
    0.7,
  ),
  fx(
    'squeegee.wipe',
    'Squeegee rubber wipe',
    'A sharp rubber squeegee blade gliding across clean wet glass with a satisfying rubbery squeak.',
    0.9,
    0.85,
  ),
  fx(
    'soap.foam',
    'Soap foam slap',
    'A wet fluffy sponge slapping thick soapy foam suds onto a glass window pane.',
    0.7,
    0.8,
  ),
  fx(
    'window.clean',
    'Spotless window chime',
    'A magical sparkling star chime and clean crystal glint sound.',
    1.2,
    0.85,
  ),
  fx(
    'bucket.slide',
    'Bucket metal scrape',
    'A metal water bucket sliding fast down a tilted perforated steel deck with a scraping rattle.',
    0.8,
    0.75,
  ),
  fx(
    'bucket.spill',
    'Soapy water crash',
    'A bucket tumbling over with a metallic clang and a huge slosh of soapy suds splashing across the deck.',
    1.4,
    0.9,
  ),
  fx(
    'hazard.slip',
    'Worker cartoon slip',
    'A comical rubber boot slipping violently on soapy deck with a squeaky skid.',
    0.7,
    0.8,
  ),
  fx(
    'hazard.dangle',
    'Harness catch & tether boing',
    'A sudden nylon webbing snap and bouncy elastic tether cord catching a dangling worker in mid-air.',
    1.2,
    0.85,
  ),
  fx(
    'hazard.wind',
    'High-altitude wind gust',
    'A fierce whistling gust of wind buffeting skyscraper cables and howling past the platform.',
    2.5,
    0.75,
  ),
  fx(
    'hazard.pigeon',
    'Pigeon flap and coo',
    'Rapid flapping pigeon wings and a startled cartoon pigeon squawk.',
    1.0,
    0.8,
  ),
  fx(
    'hazard.tilt_warning',
    'Cradle tilt siren',
    'An urgent mechanical tilt angle warning buzzer and creaking steel suspension cables.',
    1.5,
    0.85,
  ),
  fx(
    'event.win',
    'Job done victory fanfare',
    'A joyful celebratory brass fanfare celebrating 30 spotless windows before the CEO landed.',
    2.8,
    0.9,
  ),
  fx(
    'event.fail',
    'Helicopter disappointment buzzer',
    'An abrupt low horn buzzer and the CEO helicopter honking in disappointment at dirty windows.',
    2.2,
    0.85,
  ),
  bed(
    'ambience.sky',
    'Skyscraper height ambience',
    'High altitude atmospheric open air breeze with faint distant city roar far below and gently creaking suspension ropes.',
    6.0,
    0.35,
  ),
  bed(
    'ambience.helicopter',
    'Chopper blades chop',
    'Deep rhythmic thumping of twin helicopter rotor blades chopping through the air overhead.',
    4.0,
    0.4,
  ),
];
