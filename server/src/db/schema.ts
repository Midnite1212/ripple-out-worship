import { SQL, sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const MUSIC_KEYS = [
  'A',
  'A#',
  'Bb',
  'B',
  'C',
  'C#',
  'Db',
  'D',
  'D#',
  'Eb',
  'E',
  'F',
  'F#',
  'Gb',
  'G',
  'G#',
  'Ab',
] as const;

const isObjectIdHex = (column: AnyPgColumn): SQL => sql`${column} ~ '^[0-9a-f]{24}$'`;

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const songs = pgTable(
  'songs',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    tempo: text('tempo')
      .array()
      .notNull()
      .default(sql`'{}'`),
    originalKey: text('original_key').notNull(),
    recommendedKeys: text('recommended_keys')
      .array()
      .notNull()
      .default(sql`'{}'`),
    themes: text('themes')
      .array()
      .notNull()
      .default(sql`'{}'`),
    artist: text('artist').notNull(),
    year: text('year'),
    code: text('code'),
    createdBy: text('created_by'),
    lastUpdatedBy: text('last_updated_by'),
    timeSignature: text('time_signature')
      .array()
      .notNull()
      .default(sql`'{}'`),
    isVerified: boolean('is_verified').notNull().default(false),
    chordLyrics: text('chord_lyrics').notNull(),
    simplifiedChordLyrics: text('simplified_chord_lyrics'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    ...timestamps,
  },
  (table) => [check('songs_id_object_id', isObjectIdHex(table.id))]
);

export const setlists = pgTable(
  'setlists',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    date: timestamp('date', { withTimezone: true }),
    createdBy: text('created_by'),
    lastUpdatedBy: text('last_updated_by'),
    publicLink: text('public_link').unique('setlists_public_link_unique'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    check('setlists_id_object_id', isObjectIdHex(table.id)),
    index('setlists_created_by_idx').on(table.createdBy),
  ]
);

export const setlistSongs = pgTable(
  'setlist_songs',
  {
    setlistId: text('setlist_id')
      .notNull()
      .references(() => setlists.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    songId: text('song_id')
      .notNull()
      .references(() => songs.id),
  },
  (table) => [
    primaryKey({ columns: [table.setlistId, table.position] }),
    index('setlist_songs_song_id_idx').on(table.songId),
  ]
);

export const setlistSongKeys = pgTable(
  'setlist_song_keys',
  {
    setlistId: text('setlist_id')
      .notNull()
      .references(() => setlists.id, { onDelete: 'cascade' }),
    songId: text('song_id')
      .notNull()
      .references(() => songs.id),
    key: text('key').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.setlistId, table.songId] }),
    index('setlist_song_keys_song_id_idx').on(table.songId),
    check(
      'setlist_song_keys_key_music_key',
      sql`${table.key} in (${sql.join(
        MUSIC_KEYS.map((musicKey) => sql.raw(`'${musicKey}'`)),
        sql`, `
      )})`
    ),
  ]
);

export const groups = pgTable(
  'groups',
  {
    id: text('id').primaryKey(),
    groupName: text('group_name').notNull(),
    createdBy: text('created_by'),
    lastUpdatedBy: text('last_updated_by'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    ...timestamps,
  },
  (table) => [check('groups_id_object_id', isObjectIdHex(table.id))]
);

export const groupSetlists = pgTable(
  'group_setlists',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    setlistId: text('setlist_id')
      .notNull()
      .references(() => setlists.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.setlistId] }),
    index('group_setlists_setlist_id_idx').on(table.setlistId),
  ]
);

export const ownerships = pgTable(
  'ownerships',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().unique('ownerships_user_id_unique'),
    fullName: text('full_name').notNull(),
    accessType: text('access_type').notNull().default('unsigned'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    ...timestamps,
  },
  (table) => [check('ownerships_id_object_id', isObjectIdHex(table.id))]
);

const ownershipEntryColumns = {
  ownershipId: text('ownership_id')
    .notNull()
    .references(() => ownerships.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  entryName: text('entry_name'),
  entryCreatedAt: text('entry_created_at'),
};

export const ownershipSetlists = pgTable(
  'ownership_setlists',
  {
    ...ownershipEntryColumns,
    setlistId: text('setlist_id'),
  },
  (table) => [primaryKey({ columns: [table.ownershipId, table.position] })]
);

export const ownershipGroups = pgTable(
  'ownership_groups',
  {
    ...ownershipEntryColumns,
    groupId: text('group_id'),
  },
  (table) => [
    primaryKey({ columns: [table.ownershipId, table.position] }),
    index('ownership_groups_group_id_idx').on(table.groupId),
  ]
);
