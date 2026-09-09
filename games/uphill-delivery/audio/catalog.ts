import {
  common,
  steps,
  bed,
  effect,
  speech,
  music,
} from '../../../shared/audio/catalog-helpers';
import { deliveryDetails } from './detail-catalog';
import { salvageCues } from '../../../shared/audio/salvage-prompts';
export const deliveryCatalog = [
  ...deliveryDetails,
  ...common,
  ...steps(['wood', 'fabric', 'grass']),
  ...salvageCues().filter((cue) => cue.id.includes('sofa')),
  bed(
    'mountain',
    'Mountain breeze',
    'Light alpine wind through pine needles, distant village birds and a quiet valley far below.',
  ),
  effect(
    'event.grab',
    'Take a sofa corner',
    'Delivery',
    'Gloved hands grip coarse upholstery, fabric tightens and a wooden sofa frame creaks.',
    1,
  ),
  effect(
    'event.drop',
    'Sofa lands',
    'Delivery',
    'A heavy upholstered sofa drops onto a stone path: padded low thud, wooden feet clack, springs briefly rattle.',
    2,
  ),
  effect(
    'event.bounce',
    'Cushion landing',
    'Delivery',
    'Body weight compresses a large upholstered cushion and rebounds with a soft fabric swish and brief real spring creak.',
    1.4,
  ),
  effect(
    'event.gate',
    'Village gate',
    'Delivery',
    'A heavy wooden gate swings on dry hinges, latch rattles and timber flexes.',
    2,
  ),
  effect(
    'event.door',
    'Outward opening door',
    'Delivery',
    'A substantial cottage front door swings outward quickly with a wooden creak and knocks against padded furniture.',
    2,
  ),
  effect(
    'event.goat',
    'Stubborn goat',
    'Delivery',
    'One short natural goat bleat with a soft brass collar bell and hooves shuffling on stone.',
    2,
  ),
  speech(
    'start',
    'Delivery begins',
    'Four friends. One sofa. And a very optimistic delivery estimate.',
    '[playfully]',
  ),
  speech(
    'door',
    'The door opens',
    'Oh, lovely. It opens outward.',
    '[surprised]',
  ),
  speech(
    'win',
    'Sofa delivered',
    'Delivered. And only slightly more travelled than advertised.',
    '[pleased]',
  ),
  ...music('uphill-delivery'),
];
