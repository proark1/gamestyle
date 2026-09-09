import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable(
  'rooms',
  {
    code: text('code').primaryKey(),
    state: text('state').notNull(),
    version: integer('version').notNull().default(0),
    updated: integer('updated').notNull(),
  },
  (table) => [index('idx_rooms_updated').on(table.updated)],
);
export const audioSettings = sqliteTable('audio_settings', {
  game: text('game').primaryKey(),
  secret: text('secret'),
  settings: text('settings').notNull().default('{}'),
  lease: text('lease'),
  leaseUntil: integer('lease_until').notNull().default(0),
});
export const audioCues = sqliteTable(
  'audio_cues',
  {
    game: text('game').notNull(),
    cue: text('cue').notNull(),
    config: text('config').notNull(),
    file: text('file'),
    generated: integer('generated'),
    generatedConfig: text('generated_config'),
    error: text('error').notNull().default(''),
    request: text('request'),
  },
  (table) => [primaryKey({ columns: [table.game, table.cue] })],
);
export const audioGenerationJobs = sqliteTable(
  'audio_generation_jobs',
  {
    game: text('game').notNull(),
    request: text('request').notNull(),
    cancelled: integer('cancelled').notNull().default(0),
    created: integer('created').notNull(),
  },
  (table) => [primaryKey({ columns: [table.game, table.request] })],
);

export const handwerkerRooms = sqliteTable('handwerker_rooms', {
  code: text('code').primaryKey(),
  host: text('host').notNull(),
  world: text('world').notNull(),
  version: integer('version').notNull().default(0),
  updated: integer('updated').notNull(),
});
export const handwerkerPlayers = sqliteTable(
  'handwerker_players',
  {
    id: text('id').primaryKey(),
    room: text('room')
      .notNull()
      .references(() => handwerkerRooms.code, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    name: text('name').notNull(),
    color: integer('color').notNull(),
    slot: integer('slot').notNull(),
    x: real('x').notNull(),
    z: real('z').notNull(),
    angle: real('angle').notNull(),
    jump: integer('jump').notNull().default(0),
    seen: integer('seen').notNull(),
  },
  (table) => [
    index('handwerker_players_room_idx').on(table.room),
    uniqueIndex('handwerker_players_room_slot_idx').on(table.room, table.slot),
  ],
);
export const handwerkerFirstPersonRooms = sqliteTable('handwerker_fp_rooms', {
  code: text('code').primaryKey(),
  host: text('host').notNull(),
  world: text('world').notNull(),
  version: integer('version').notNull().default(0),
  updated: integer('updated').notNull(),
});
export const handwerkerFirstPersonPlayers = sqliteTable(
  'handwerker_fp_players',
  {
    id: text('id').primaryKey(),
    room: text('room')
      .notNull()
      .references(() => handwerkerFirstPersonRooms.code, {
        onDelete: 'cascade',
      }),
    tokenHash: text('token_hash').notNull(),
    name: text('name').notNull(),
    color: integer('color').notNull(),
    slot: integer('slot').notNull(),
    x: real('x').notNull(),
    y: real('y').notNull(),
    z: real('z').notNull(),
    yaw: real('yaw').notNull(),
    pitch: real('pitch').notNull(),
    seen: integer('seen').notNull(),
  },
  (table) => [
    uniqueIndex('handwerker_fp_players_room_slot').on(table.room, table.slot),
  ],
);
export const handwerkerSavedBuilds = sqliteTable(
  'handwerker_saved_builds',
  {
    id: text('id').primaryKey(),
    ownerHash: text('owner_hash').notNull(),
    title: text('title').notNull(),
    author: text('author').notNull(),
    sourceId: text('source_id'),
    snapshot: text('snapshot').notNull(),
    created: integer('created').notNull(),
  },
  (table) => [
    index('handwerker_saved_builds_owner_created_idx').on(
      table.ownerHash,
      table.created,
    ),
  ],
);
