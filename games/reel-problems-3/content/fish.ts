import type { FishSpecies } from '../types';
export type FishDefinition = {
  species: FishSpecies;
  name: string;
  color: string;
  accent: string;
  minWeight: number;
  maxWeight: number;
  stamina: number;
  pull: number;
  burstCadence: number;
  burstStrength: number;
  swimAmplitude: number;
  safeTension: number;
  rare: boolean;
  needsNet: boolean;
  school: boolean;
  fragile: boolean;
  score: number;
};
export const FISH_DEFINITIONS: Record<FishSpecies, FishDefinition> = {
  'silver-sprat': {
    species: 'silver-sprat',
    name: 'Silver sprat',
    color: '#bfd7dd',
    accent: '#f4fbef',
    minWeight: 0.4,
    maxWeight: 1.2,
    stamina: 28,
    pull: 0.35,
    burstCadence: 1_350,
    burstStrength: 0.08,
    swimAmplitude: 1.2,
    safeTension: 0.82,
    rare: false,
    needsNet: false,
    school: true,
    fragile: false,
    score: 30,
  },
  'coral-mackerel': {
    species: 'coral-mackerel',
    name: 'Coral mackerel',
    color: '#ef8d75',
    accent: '#ffd49b',
    minWeight: 1.2,
    maxWeight: 3.2,
    stamina: 48,
    pull: 0.55,
    burstCadence: 1_080,
    burstStrength: 0.13,
    swimAmplitude: 1.05,
    safeTension: 0.78,
    rare: false,
    needsNet: false,
    school: true,
    fragile: false,
    score: 52,
  },
  'blue-cod': {
    species: 'blue-cod',
    name: 'Blue cod',
    color: '#5c8ca8',
    accent: '#b6d7c5',
    minWeight: 2.4,
    maxWeight: 5.8,
    stamina: 65,
    pull: 0.68,
    burstCadence: 1_520,
    burstStrength: 0.17,
    swimAmplitude: 0.88,
    safeTension: 0.76,
    rare: false,
    needsNet: false,
    school: false,
    fragile: false,
    score: 70,
  },
  glassfin: {
    species: 'glassfin',
    name: 'Glassfin',
    color: '#b9f0e7',
    accent: '#f6ffe1',
    minWeight: 1.1,
    maxWeight: 2.6,
    stamina: 50,
    pull: 0.48,
    burstCadence: 940,
    burstStrength: 0.2,
    swimAmplitude: 1.12,
    safeTension: 0.58,
    rare: false,
    needsNet: false,
    school: false,
    fragile: true,
    score: 88,
  },
  'lantern-eel': {
    species: 'lantern-eel',
    name: 'Lantern eel',
    color: '#6b5aa6',
    accent: '#f8d55b',
    minWeight: 2,
    maxWeight: 4.5,
    stamina: 72,
    pull: 0.76,
    burstCadence: 1_180,
    burstStrength: 0.22,
    swimAmplitude: 1.24,
    safeTension: 0.7,
    rare: true,
    needsNet: false,
    school: false,
    fragile: false,
    score: 130,
  },
  'storm-tuna': {
    species: 'storm-tuna',
    name: 'Storm tuna',
    color: '#315a70',
    accent: '#f9b55c',
    minWeight: 9,
    maxWeight: 16,
    stamina: 145,
    pull: 1,
    burstCadence: 1_720,
    burstStrength: 0.28,
    swimAmplitude: 0.82,
    safeTension: 0.72,
    rare: true,
    needsNet: true,
    school: false,
    fragile: false,
    score: 220,
  },
};
export const FISH_SPECIES = Object.keys(FISH_DEFINITIONS) as FishSpecies[];
