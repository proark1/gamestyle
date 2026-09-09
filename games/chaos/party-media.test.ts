import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { GameScene } from './scene';
function fixture() {
  const game = Object.create(GameScene.prototype) as GameScene,
    mission = new T.Group(),
    worker = new T.Group(),
    name = new T.Sprite();
  worker.add(name);
  Object.assign(game, {
    partyView: { mission },
    workers: new Map([['player', worker]]),
    renderer: { render() {}, domElement: {} },
    scene: new T.Scene(),
    camera: new T.PerspectiveCamera(),
  });
  return { game, mission, name };
}
void test('export rendering hides private mission targets and respects name opt-in', () => {
  const { game, mission, name } = fixture();
  game.publicFrame(() => {
    assert.equal(mission.visible, false);
    assert.equal(name.visible, false);
  }, false);
  assert.equal(mission.visible, true);
  assert.equal(name.visible, true);
  game.publicFrame(() => {
    assert.equal(mission.visible, false);
    assert.equal(name.visible, true);
  }, true);
});
void test('failed export restores the live scene without revealing previously hidden names', () => {
  const { game, mission, name } = fixture();
  name.visible = false;
  assert.throws(
    () =>
      game.publicFrame(() => {
        throw new Error('encoder failed');
      }, false),
    /encoder/,
  );
  assert.equal(mission.visible, true);
  assert.equal(name.visible, false);
});
