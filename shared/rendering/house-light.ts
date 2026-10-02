import * as T from 'three';
import { renderQuality } from '../browser/device';

/**
 * The collection's light, taken from Stack or Sink: a warm sun over a
 * sage-green bounce, under a soft pastel sky, through ACES tone mapping at
 * this exposure. Every outdoor and daylight game uses it, so the worker and
 * the scenery read the same from game to game; the dark games (night heists,
 * the hotel corridor) keep their own moody light on purpose.
 */
export const HOUSE_EXPOSURE = 1.3;

/** Skies a game can stand under. Fog fades into the same colour. */
export const SKY = {
  /** Stack or Sink's sea-glass sky, the default. */
  coast: '#b5d4ca',
  /** Farmland and hills: Blend Business, Uphill Delivery. */
  meadow: '#c7d3b6',
  /** Building sites: Permit Pending, Crane Clash, Chain of Fools. */
  site: '#b9cfbd',
  /** Snow and ice: Panic Curling. */
  frost: '#c9dbdc',
  /** Big indoor halls: the warehouse, the airport, the diner. */
  hall: '#d9d3c1',
} as const;

const SUN_COLOUR = '#fff1d2';
const SUN_INTENSITY = 3.3;
const SKY_LIGHT = '#fff2d4';
const GROUND_LIGHT = '#7fa497';
const HEMISPHERE_INTENSITY = 3;

export type HouseLightOptions = {
  /** Background and fog colour; one of `SKY` for a house look. */
  sky?: string;
  /** Linear fog distances in metres, sized to the scene; false for none. */
  fog?: { near: number; far: number } | false;
};

export type HouseLight = {
  hemisphere: T.HemisphereLight;
  /**
   * The key light, casting shadows. It starts where Stack or Sink puts it;
   * each game aims it and sizes its shadow camera for its own scene.
   */
  sun: T.DirectionalLight;
};

/** Sets the sky and fog and adds the house hemisphere light and sun. */
export function addHouseLight(
  scene: T.Scene,
  options: HouseLightOptions = {},
): HouseLight {
  const sky = options.sky ?? SKY.coast;
  const fog = options.fog ?? { near: 65, far: 120 };
  scene.background = new T.Color(sky);
  scene.fog = fog ? new T.Fog(sky, fog.near, fog.far) : null;
  const hemisphere = new T.HemisphereLight(
    SKY_LIGHT,
    GROUND_LIGHT,
    HEMISPHERE_INTENSITY,
  );
  const sun = new T.DirectionalLight(SUN_COLOUR, SUN_INTENSITY);
  sun.position.set(-13, 24, 12);
  sun.castShadow = true;
  const size = renderQuality().shadowMapSize;
  sun.shadow.mapSize.set(size, size);
  sun.shadow.normalBias = 0.05;
  scene.add(hemisphere, sun);
  return { hemisphere, sun };
}
