export const COLORS = ['#eaa43c', '#679e99', '#d97863', '#8b81af'];
export const GOAL = 13.5;
export const BOUNDS = 10;
export type Kind = 'crate' | 'pallet' | 'sofa' | 'bathtub' | 'fridge' | 'plank';
export const ITEMS: Record<Kind, { name: string; w: number; h: number; d: number; color: string }> = {
  crate: { name: 'Wooden crate', w: 1.6, h: 1.3, d: 1.6, color: '#b58a55' },
  pallet: { name: 'Pallet', w: 2.4, h: .45, d: 2, color: '#cda66b' },
  sofa: { name: 'Old sofa', w: 2.8, h: 1.05, d: 1.25, color: '#d59940' },
  bathtub: { name: 'Bathtub', w: 2.5, h: .85, d: 1.3, color: '#d9e3db' },
  fridge: { name: 'Fridge', w: 1.4, h: 1.8, d: 1.4, color: '#9dbcb4' },
  plank: { name: 'Long plank', w: 3.6, h: .25, d: 1.2, color: '#bb9762' },
};
export type Quaternion = { x:number; y:number; z:number; w:number };
export type Piece = { id: string; kind: Kind; x: number; y: number; z: number; rotation: number; vy: number; tilt: number; heldBy?: string; unstable: number; quaternion?:Quaternion; vx?:number; vz?:number; angular?:{x:number;y:number;z:number}; sleeping?:boolean; idle?:number; revision?:number };
export type Input = { x: number; z: number; jump: boolean; seq: number };
export type Player = { id: string; name: string; color: number; x: number; y: number; z: number; vy: number; angle: number; grounded: boolean; breath: number; down: boolean; rescued: boolean; seen: number; input: Input; lastJump: number };
export type GameEvent = { id: string; text: string; kind: 'info' | 'danger' | 'good'; at: number };
export type World = { phase: 'lobby' | 'playing' | 'won' | 'lost'; mode: 'normal' | 'practice'; started: number; clock: number; water: number; pieces: Piece[]; players: Player[]; bestHeight: number; events: GameEvent[]; crane: { owner: string | null; piece: string | null; x: number; y: number; z: number }; seed: number; remainder?:number; physicsSignature?:string };
export type Snapshot = { code: string; host: string; world: World; version: number };
export type Session = { code: string; id: string; token: string };
export type Action = { type: 'start' | 'restart' | 'grab' | 'place' | 'rotate' | 'rescue' | 'crane' | 'crane-move' | 'crane-drop' | 'wave'; target?: string; x?: number; z?: number; y?: number; rotation?: number; revision?:number };
export function dimensions(p: Pick<Piece, 'kind' | 'rotation'>) { const item = ITEMS[p.kind]; return p.rotation % 2 ? { w: item.d, h: item.h, d: item.w } : item; }
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
