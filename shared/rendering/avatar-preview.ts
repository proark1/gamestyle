import type * as T from 'three';

/** One player avatar built outside its game, for side-by-side previews. */
export type AvatarPreview = {
  /** The model as the game places it, including any scale it applies. */
  root: T.Object3D;
  /** Poses the model at a moment of its idle or walking loop, in seconds. */
  pose?(time: number, walking: boolean): void;
};

/** A way a player can look in one game, such as the cow or the farmer. */
export type AvatarLook = {
  key: string;
  label: string;
  create(): AvatarPreview;
};
