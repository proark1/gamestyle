export type LookStyleId = 'storybook' | 'stormlight' | 'graphic';

export type MaterialRole =
  | 'rock'
  | 'sand'
  | 'grass'
  | 'leaf'
  | 'wood'
  | 'paint'
  | 'plaster'
  | 'metal'
  | 'cloth'
  | 'rope'
  | 'glass'
  | 'hand'
  | 'sleeve'
  | 'fish';

export type LookPalette = Record<MaterialRole, string> & {
  sky: string;
  fog: string;
  sea: string;
  seaDeep: string;
  foam: string;
  sun: string;
  beacon: string;
  ink: string;
};

export type LookStyle = {
  id: LookStyleId;
  key: '1' | '2' | '3';
  label: string;
  eyebrow: string;
  description: string;
  palette: LookPalette;
  exposure: number;
  fogDensity: number;
  sunIntensity: number;
  hemiIntensity: number;
  roughness: number;
  metalness: number;
  clearcoat: number;
  waterAmplitude: number;
  waterSpeed: number;
  wind: number;
  rain: number;
  edgeStrength: number;
  ambientParticles: number;
};

export type LookdevInput = {
  forward: number;
  strafe: number;
  sprint: boolean;
};

export type PlayerPose = {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
};

export type LookdevStats = {
  fps: number;
  frameMs: number;
};

export type LookdevRuntime = {
  setStyle(style: LookStyleId): void;
  setInput(input: LookdevInput): void;
  setReducedMotion(reduced: boolean): void;
  look(deltaX: number, deltaY: number): void;
  activateBeacon(): boolean;
  reset(): void;
  target(): 'beacon' | null;
  dispose(): void;
};
