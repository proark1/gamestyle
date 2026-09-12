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
/** One page visit to one game, replaced by each newer cumulative report. */
export const analyticsSessions = sqliteTable(
  'analytics_sessions',
  {
    id: text('id').primaryKey(),
    game: text('game').notNull(),
    started: integer('started').notNull(),
    updated: integer('updated').notNull(),
    delivery: integer('delivery').notNull().default(0),
    device: text('device').notNull().default('pointer'),
    entry: text('entry').notNull().default('direct'),
    mode: text('mode').notNull().default(''),
    room: text('room').notNull().default(''),
    reached: text('reached').notNull().default('[]'),
    furthest: text('furthest').notNull().default('opened'),
    furthestRank: integer('furthest_rank').notNull().default(0),
    lastStep: text('last_step').notNull().default('opened'),
    rounds: integer('rounds').notNull().default(0),
    wins: integer('wins').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    humans: integer('humans').notNull().default(0),
    npcs: integer('npcs').notNull().default(0),
    elapsed: integer('elapsed').notNull().default(0),
    active: integer('active').notNull().default(0),
    menuMs: integer('menu_ms').notNull().default(0),
    lobbyMs: integer('lobby_ms').notNull().default(0),
    playingMs: integer('playing_ms').notNull().default(0),
    finishedMs: integer('finished_ms').notNull().default(0),
    actions: text('actions').notNull().default('{}'),
    results: text('results').notNull().default('{}'),
    exit: text('exit').notNull().default(''),
  },
  (table) => [
    index('analytics_sessions_started_idx').on(table.started),
    index('analytics_sessions_game_started_idx').on(table.game, table.started),
    index('analytics_sessions_updated_idx').on(table.updated),
  ],
);
export const analyticsEvents = sqliteTable(
  'analytics_events',
  {
    session: text('session')
      .notNull()
      .references(() => analyticsSessions.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    at: integer('at').notNull(),
    type: text('type').notNull(),
    data: text('data').notNull().default('{}'),
  },
  (table) => [primaryKey({ columns: [table.session, table.seq] })],
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

/** A player's account. It holds no address, name or photo from a provider. */
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  displayName: text('display_name'),
  created: integer('created').notNull(),
  updated: integer('updated').notNull(),
});
/** A way into an account: Google's subject id, or a keyed hash of an email. */
export const accountIdentities = sqliteTable(
  'account_identities',
  {
    provider: text('provider').notNull(),
    subject: text('subject').notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    emailHint: text('email_hint').notNull().default(''),
    created: integer('created').notNull(),
    lastUsed: integer('last_used').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.subject] }),
    index('account_identities_account_idx').on(table.accountId),
  ],
);
export const accountSessions = sqliteTable(
  'account_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    created: integer('created').notNull(),
    renewed: integer('renewed').notNull(),
    expires: integer('expires').notNull(),
  },
  (table) => [
    index('account_sessions_account_idx').on(table.accountId),
    index('account_sessions_expires_idx').on(table.expires),
  ],
);
/** Email sign-in codes, kept only as keyed hashes and deleted after a day. */
export const accountEmailCodes = sqliteTable(
  'account_email_codes',
  {
    id: text('id').primaryKey(),
    emailHash: text('email_hash').notNull(),
    flowHash: text('flow_hash').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    created: integer('created').notNull(),
    expires: integer('expires').notNull(),
    used: integer('used'),
  },
  (table) => [
    index('account_email_codes_email_created_idx').on(
      table.emailHash,
      table.created,
    ),
    index('account_email_codes_created_idx').on(table.created),
  ],
);
