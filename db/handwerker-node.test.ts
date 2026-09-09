import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sqliteAdapter } from './node';
import { migrateSqlite, openSqlite } from './sqlite.mjs';

void test('cached SQL keeps concurrent bindings isolated and evicts old statements', async () => {
  const native = openSqlite(':memory:');
  try {
    let prepared = 0;
    const prepare = native.prepare.bind(native);
    native.prepare = (sql: string) => {
      prepared++;
      return prepare(sql);
    };
    const db = sqliteAdapter(native);
    const rows = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        db.prepare('SELECT ? AS value').bind(i).first<{ value: number }>(),
      ),
    );
    assert.deepEqual(
      rows.map((row) => row?.value),
      Array.from({ length: 100 }, (_, i) => i),
    );
    assert.equal(prepared, 1);
    for (let i = 0; i < 256; i++)
      await db.prepare(`SELECT ${i} AS value`).first();
    await db.prepare('SELECT ? AS value').bind(999).first();
    assert.equal(
      prepared,
      258,
      'The least recently used statement was evicted',
    );
  } finally {
    native.close();
  }
});

void test('Handwerker migration preserves existing games and isolates identical room codes', () => {
  const native = openSqlite(':memory:');
  try {
    // Reproduce a pre-import database with an active Jumbleyard room and saved audio.
    native.exec(
      'CREATE TABLE _game_migrations (name TEXT PRIMARY KEY NOT NULL, applied INTEGER NOT NULL)',
    );
    for (const name of ['0000_chief_vargas.sql', '0001_round_xorn.sql']) {
      native.exec(readFileSync(join('drizzle', name), 'utf8'));
      native.prepare('INSERT INTO _game_migrations VALUES (?, 1)').run(name);
    }
    native
      .prepare('INSERT INTO rooms VALUES (?, ?, ?, ?)')
      .run('ABCDEF', '{"existing":true}', 8, 123);
    native
      .prepare(
        'INSERT INTO audio_settings (game, secret, settings) VALUES (?, ?, ?)',
      )
      .run('stack-or-sink', 'preserved-ciphertext', '{"effects":0.4}');
    migrateSqlite(native);
    migrateSqlite(native);
    native
      .prepare('INSERT INTO handwerker_rooms VALUES (?, ?, ?, 0, 1)')
      .run('ABCDEF', 'builder', '{"pieces":[]}');
    native
      .prepare('INSERT INTO handwerker_fp_rooms VALUES (?, ?, ?, 0, 1)')
      .run('ABCDEF', 'bricklayer', '{"parts":[]}');
    native
      .prepare(
        'INSERT INTO handwerker_players VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 1)',
      )
      .run('builder', 'ABCDEF', 'token-hash', 'Builder');
    assert.equal(
      native.prepare('SELECT state FROM rooms WHERE code = ?').get('ABCDEF')
        ?.state,
      '{"existing":true}',
    );
    assert.equal(
      native.prepare('SELECT version FROM rooms WHERE code = ?').get('ABCDEF')
        ?.version,
      8,
    );
    assert.equal(
      native
        .prepare('SELECT secret FROM audio_settings WHERE game = ?')
        .get('stack-or-sink')?.secret,
      'preserved-ciphertext',
    );
    native.prepare('DELETE FROM handwerker_rooms WHERE code = ?').run('ABCDEF');
    assert.equal(
      native.prepare('SELECT COUNT(*) AS count FROM handwerker_players').get()
        ?.count,
      0,
    );
    assert.equal(
      native.prepare('SELECT COUNT(*) AS count FROM handwerker_fp_rooms').get()
        ?.count,
      1,
    );
    assert.equal(
      native.prepare('SELECT COUNT(*) AS count FROM rooms').get()?.count,
      1,
    );
  } finally {
    native.close();
  }
});
void test('group commit preserves successful sites when another batch rolls back', async () => {
  const native = openSqlite(':memory:');
  try {
    migrateSqlite(native);
    const db = sqliteAdapter(native);
    let commits = 0;
    const exec = native.exec.bind(native);
    native.exec = (sql: string) => {
      if (sql === 'COMMIT') commits++;
      return exec(sql);
    };
    const results = await Promise.allSettled([
      db.batch([
        db
          .prepare('INSERT INTO handwerker_rooms VALUES (?, ?, ?, 0, ?)')
          .bind('GOODAA', 'host', '{}', 1),
      ]),
      db.batch([
        db
          .prepare('INSERT INTO handwerker_rooms VALUES (?, ?, ?, 0, ?)')
          .bind('BADAAA', 'host', '{}', 1),
        db
          .prepare('INSERT INTO handwerker_players (id) VALUES (?)')
          .bind('invalid'),
      ]),
      db.batch([
        db
          .prepare('INSERT INTO handwerker_rooms VALUES (?, ?, ?, 0, ?)')
          .bind('GOODBB', 'host', '{}', 1),
      ]),
    ]);
    assert.deepEqual(
      results.map((r) => r.status),
      ['fulfilled', 'rejected', 'fulfilled'],
    );
    const rows = await db
      .prepare('SELECT code FROM handwerker_rooms ORDER BY code')
      .all<{ code: string }>();
    assert.deepEqual(
      rows.results.map((r) => r.code),
      ['GOODAA', 'GOODBB'],
    );
    assert.equal(commits, 1);
  } finally {
    native.close();
  }
});

void test('single writes and room CAS share durable commits without losing conflict detection', async () => {
  const native = openSqlite(':memory:');
  try {
    migrateSqlite(native);
    const { sqliteRoomStore } = await import('./rooms-node');
    const db = sqliteAdapter(native),
      rooms = sqliteRoomStore(native);
    assert.equal(sqliteAdapter(native), db);
    await rooms.insert({ code: 'ABC234', state: '{}', version: 0, updated: 1 });
    let commits = 0;
    const exec = native.exec.bind(native);
    native.exec = (sql) => {
      if (sql === 'COMMIT') commits++;
      return exec(sql);
    };
    const [first, stale] = await Promise.all([
      rooms.compareAndSwap(
        { code: 'ABC234', state: '{"saved":1}', version: 1, updated: 2 },
        0,
      ),
      rooms.compareAndSwap(
        { code: 'ABC234', state: '{"saved":2}', version: 1, updated: 2 },
        0,
      ),
      db
        .prepare('INSERT INTO handwerker_rooms VALUES (?, ?, ?, 0, ?)')
        .bind('XYZ234', 'host', '{}', 2)
        .run(),
    ]);
    assert.equal(first, true);
    assert.equal(stale, false);
    assert.equal(commits, 1);
    assert.equal((await rooms.get('ABC234'))?.state, '{"saved":1}');
  } finally {
    native.close();
  }
});

void test('room creation rolls back if its player insert fails', async () => {
  const native = openSqlite(':memory:');
  try {
    migrateSqlite(native);
    const db = sqliteAdapter(native);
    await assert.rejects(
      db.batch([
        db
          .prepare('INSERT INTO handwerker_rooms VALUES (?, ?, ?, 0, ?)')
          .bind('ABCDEF', 'host', '{}', 1),
        db
          .prepare('INSERT INTO handwerker_players (id) VALUES (?)')
          .bind('missing-required-fields'),
      ]),
      /NOT NULL/,
    );
    assert.equal(
      await db.prepare('SELECT * FROM handwerker_rooms').first(),
      null,
    );
  } finally {
    native.close();
  }
});

void test('migration is repeatable, worlds survive reopening, and stale versions cannot overwrite them', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'pfusch-db-'));
  const filename = join(directory, 'game.sqlite');
  let native = openSqlite(filename);
  try {
    migrateSqlite(native);
    const db = sqliteAdapter(native);
    await db
      .prepare('INSERT INTO handwerker_rooms VALUES (?, ?, ?, 0, ?)')
      .bind('ABCDEF', 'host', '{}', 1)
      .run();
    const update = db.prepare(
      'UPDATE handwerker_rooms SET world = ?, version = version + 1 WHERE code = ? AND version = ?',
    );
    assert.equal(
      (await update.bind('{"pieces":["wall"]}', 'ABCDEF', 0).run()).meta
        .changes,
      1,
    );
    assert.equal(
      (await update.bind('{"pieces":[]}', 'ABCDEF', 0).run()).meta.changes,
      0,
    );
    native.close();
    native = openSqlite(filename);
    migrateSqlite(native);
    const reopened = sqliteAdapter(native);
    const row = await reopened
      .prepare('SELECT world, version FROM handwerker_rooms WHERE code = ?')
      .bind('ABCDEF')
      .first<{ world: string; version: number }>();
    assert.equal(row?.version, 1);
    assert.deepEqual(JSON.parse(row!.world), { pieces: ['wall'] });
    assert.equal(
      (await reopened.prepare('SELECT * FROM _game_migrations').all()).results
        .length,
      readdirSync('drizzle').filter((name) => /^\d+.*\.sql$/.test(name)).length,
    );
    assert.equal(
      await reopened
        .prepare('SELECT * FROM handwerker_rooms WHERE code = ?')
        .bind('ZZZZZZ')
        .first(),
      null,
    );
  } finally {
    native.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('first-person worlds and resumable identities survive reopening separately from chaos', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'steinwerk-db-'));
  const filename = join(directory, 'game.sqlite');
  let native = openSqlite(filename);
  try {
    migrateSqlite(native);
    const db = sqliteAdapter(native);
    await db.batch([
      db
        .prepare(
          'INSERT INTO handwerker_fp_rooms (code, host, world, version, updated) VALUES (?, ?, ?, 0, ?)',
        )
        .bind(
          'FPSABC',
          'fp-host',
          '{"parts":[{"id":"brick"}],"inventories":{"fp-host":{"mortar":12}}}',
          10,
        ),
      db
        .prepare(
          'INSERT INTO handwerker_fp_players (id, room, token_hash, name, color, slot, x, y, z, yaw, pitch, seen) VALUES (?, ?, ?, ?, 0, 0, 0, 1.8, 5.8, 0, 0, 10)',
        )
        .bind('fp-host', 'FPSABC', 'hash', 'Builder'),
    ]);
    await db
      .prepare('UPDATE handwerker_fp_players SET slot = -rowid WHERE room = ?')
      .bind('FPSABC')
      .run();
    native.close();
    native = openSqlite(filename);
    migrateSqlite(native);
    const reopened = sqliteAdapter(native);
    const room = await reopened
      .prepare('SELECT world FROM handwerker_fp_rooms WHERE code = ?')
      .bind('FPSABC')
      .first<{ world: string }>();
    assert.equal(JSON.parse(room!.world).parts[0].id, 'brick');
    assert.equal(JSON.parse(room!.world).inventories['fp-host'].mortar, 12);
    const player = await reopened
      .prepare(
        'SELECT * FROM handwerker_fp_players WHERE id = ? AND token_hash = ?',
      )
      .bind('fp-host', 'hash')
      .first<{ slot: number }>();
    assert.ok(player && player.slot < 0);
    await reopened
      .prepare(
        'UPDATE handwerker_fp_players SET slot = 0, seen = 100 WHERE id = ?',
      )
      .bind('fp-host')
      .run();
    assert.equal(
      await reopened
        .prepare('SELECT * FROM handwerker_rooms WHERE code = ?')
        .bind('FPSABC')
        .first(),
      null,
    );
  } finally {
    native.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
