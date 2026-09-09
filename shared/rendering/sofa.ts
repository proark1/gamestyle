import { Group } from 'three';
import { sofaShapes } from '../physics/sofa';
import { box } from './primitives';

export function sofa() {
  const group = new Group();
  for (const shape of sofaShapes()) {
    const mesh = box(group, shape.size, shape.pos, shape.color, shape.rounded);
    mesh.userData.surface = true;
  }
  return group;
}
