import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { GAME_IDS } from '../games/identity';

void test('every game wires a room into the shared voice toolbar without a custom voice override', () => {
  for (const game of GAME_IDS) {
    const path = `games/${game}/Game.tsx`;
    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let wired = false;
    const visit = (node: ts.Node) => {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        node.tagName.getText(source) === 'GameToolbar'
      ) {
        const attributes = node.attributes.properties
          .filter(ts.isJsxAttribute)
          .map((a) => a.name.getText(source));
        assert.ok(
          !attributes.includes('onVoice'),
          `${game} must not bypass the shared panel`,
        );
        if (attributes.includes('voice')) wired = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    assert.ok(
      wired,
      `${game} must supply its session and players to shared voice`,
    );
  }
});
