import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { inviteCode, isPeerSession, isSession, sessionStore } from './session';

const valid = { peer: true as const, code: 'ABC234', id: 'me', token: 'tok' };

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

const install = (storage: unknown) => {
  (globalThis as { sessionStorage?: unknown }).sessionStorage = storage;
};

beforeEach(() => install(new MemoryStorage()));

void test('a session is valid only with a room code, an id and a token', () => {
  assert.ok(isSession(valid));
  assert.ok(isSession({ code: 'ABC234', id: 'me', token: 'tok' }));
  assert.ok(
    !isSession({ ...valid, code: 'PRACTICE' }),
    'practice is not a room',
  );
  assert.ok(!isSession({ ...valid, code: 'abc234' }), 'codes are stored upper');
  assert.ok(!isSession({ ...valid, id: '' }));
  assert.ok(!isSession({ ...valid, token: '' }), 'a solo session has no token');
  assert.ok(!isSession(null));
  assert.ok(!isSession('ABC234'));
  assert.ok(!isSession([]));
});

void test('only a session marked peer reconnects through the mesh', () => {
  assert.ok(isPeerSession(valid));
  assert.ok(!isPeerSession({ code: 'ABC234', id: 'me', token: 'tok' }));
  assert.ok(!isPeerSession({ ...valid, peer: 'yes' }));
});

void test('a saved session round-trips and clearing removes it', () => {
  const store = sessionStore('game-session-v1');
  assert.equal(store.load(), null);
  store.save(valid);
  assert.deepEqual(store.load(), valid);
  assert.deepEqual(store.loadPeer(), valid);
  store.clear();
  assert.equal(store.load(), null);
});

void test('a stored value that is not a usable session is ignored', () => {
  const store = sessionStore('game-session-v1');
  sessionStorage.setItem(store.key, 'not json at all');
  assert.equal(store.load(), null);
  sessionStorage.setItem(store.key, JSON.stringify({ code: 'ABC234' }));
  assert.equal(store.load(), null);
  sessionStorage.setItem(store.key, JSON.stringify(valid));
  assert.deepEqual(store.load(), valid);
});

void test('a non-peer session does not load as a peer one', () => {
  const store = sessionStore('game-session-v1');
  store.save({ code: 'ABC234', id: 'me', token: 'tok' });
  assert.ok(store.load());
  assert.equal(store.loadPeer(), null);
});

void test('storage that throws never breaks a game', () => {
  install({
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
    removeItem() {
      throw new Error('blocked');
    },
  });
  const store = sessionStore('game-session-v1');
  assert.equal(store.load(), null);
  assert.equal(store.loadPeer(), null);
  store.save(valid);
  store.clear();
});

void test('a party round never rejoins a saved session', () => {
  const store = sessionStore('game-session-v1');
  store.save(valid);
  const global = globalThis as { location?: { search: string } };
  global.location = { search: '?party=XYZ789&round=1' };
  try {
    assert.equal(store.load(), null);
    assert.equal(store.loadPeer(), null);
  } finally {
    delete global.location;
  }
  assert.deepEqual(store.load(), valid, 'the session is kept, just not used');
});

void test('an invite code is read from the query and normalised', () => {
  assert.equal(inviteCode('?room=abc234'), 'ABC234');
  assert.equal(inviteCode('?room=ABC234&x=1'), 'ABC234');
  assert.equal(inviteCode('?room=nope'), null);
  assert.equal(inviteCode(''), null);
  assert.equal(inviteCode('?other=ABC234'), null);
});
