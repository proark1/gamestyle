import type { Object3D } from 'three';
import { disposeObject } from './dispose-object';

/** Retain model identity across snapshots; only membership changes allocate. */
export class KeyedModels<T extends { id: string }, M extends Object3D> {
  readonly models = new Map<string, M>();
  constructor(
    private parent: Object3D,
    private create: (item: T) => M,
  ) {}
  sync(items: readonly T[], update: (model: M, item: T) => void) {
    const live = new Set(items.map((item) => item.id));
    for (const [id, model] of this.models) {
      if (live.has(id)) continue;
      model.removeFromParent();
      disposeObject(model);
      this.models.delete(id);
    }
    for (const item of items) {
      let model = this.models.get(item.id);
      if (!model) {
        model = this.create(item);
        this.models.set(item.id, model);
        this.parent.add(model);
      }
      update(model, item);
    }
  }
}
