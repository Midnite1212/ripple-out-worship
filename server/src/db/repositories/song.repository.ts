import { SQL, and, arrayOverlaps, asc, count, eq, ilike, or, sql } from 'drizzle-orm';
import { PublicSongRecord, SongRecord, SongViewRecord } from '../../types/song.types';
import {
  InvalidInputError,
  castOptionalString,
  castRequiredString,
  castStringArray,
  has,
} from '../cast';
import { getDb } from '../connect';
import { generateObjectId, toObjectId } from '../objectId';
import { songs } from '../schema';
import { presentFields } from './shared';

export const SONG_FIELDS = [
  'title',
  'artist',
  'themes',
  'tempo',
  'year',
  'code',
  'timeSignature',
  'simplifiedChordLyrics',
  'originalKey',
  'recommendedKeys',
  'chordLyrics',
] as const;

export type SongField = (typeof SONG_FIELDS)[number];
export type SongFields = Partial<Record<SongField, unknown>>;
export type SongSortField = 'title' | 'code';

export type SongSearch = {
  keyword: string;
  code: string;
  tempo: string[];
  themes: string[];
  sortBy: SongSortField;
  offset: number;
  limit: number;
};

type SongRow = typeof songs.$inferSelect;
type SongValues = Partial<Omit<typeof songs.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>>;

const REQUIRED_STRING_FIELDS = ['title', 'originalKey', 'artist', 'chordLyrics'] as const;
const OPTIONAL_STRING_FIELDS = ['year', 'code', 'simplifiedChordLyrics'] as const;
const STRING_ARRAY_FIELDS = ['tempo', 'recommendedKeys', 'timeSignature'] as const;

const toSongViewRecord = (row: SongRow): SongViewRecord => ({
  _id: row.id,
  title: row.title,
  tempo: row.tempo,
  originalKey: row.originalKey,
  themes: row.themes,
  artist: row.artist,
  ...presentFields({ year: row.year, code: row.code }),
  timeSignature: row.timeSignature,
  isVerified: row.isVerified,
  ...presentFields({ simplifiedChordLyrics: row.simplifiedChordLyrics }),
  isDeleted: row.isDeleted,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const toPublicSongRecord = (row: SongRow): PublicSongRecord => ({
  ...toSongViewRecord(row),
  recommendedKeys: row.recommendedKeys,
  chordLyrics: row.chordLyrics,
});

export const toSongRecord = (row: SongRow): SongRecord => ({
  ...toPublicSongRecord(row),
  ...presentFields({ createdBy: row.createdBy, lastUpdatedBy: row.lastUpdatedBy }),
});

const toSongValues = (fields: SongFields): SongValues => {
  const values: SongValues = {};
  for (const field of REQUIRED_STRING_FIELDS) {
    if (has(fields, field)) values[field] = castRequiredString(field, fields[field]);
  }
  for (const field of OPTIONAL_STRING_FIELDS) {
    if (has(fields, field)) values[field] = castOptionalString(field, fields[field]);
  }
  for (const field of STRING_ARRAY_FIELDS) {
    if (has(fields, field)) values[field] = castStringArray(field, fields[field]);
  }
  if (has(fields, 'themes')) {
    values.themes = castStringArray('themes', fields.themes, { itemsRequired: true });
  }
  return values;
};

const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

export const containsPattern = (value: string): string => `%${escapeLikePattern(value)}%`;

const isLiveSong = (id: string): SQL | undefined =>
  and(eq(songs.id, toObjectId(id)), eq(songs.isDeleted, false));

const searchCondition = ({ keyword, code, tempo, themes }: SongSearch): SQL | undefined => {
  const conditions: (SQL | undefined)[] = [eq(songs.isDeleted, false)];
  const textMatches: SQL[] = [];
  if (keyword) textMatches.push(ilike(songs.title, containsPattern(keyword)));
  if (code) textMatches.push(ilike(songs.code, containsPattern(code)));
  if (textMatches.length > 0) conditions.push(or(...textMatches));
  if (tempo.length > 0) conditions.push(arrayOverlaps(songs.tempo, tempo));
  if (themes.length > 0) conditions.push(arrayOverlaps(songs.themes, themes));
  return and(...conditions);
};

const searchOrder = (sortBy: SongSortField): SQL[] =>
  sortBy === 'code'
    ? [sql`${songs.code} collate "C" asc nulls first`, asc(songs.id)]
    : [sql`${songs.title} collate "C" asc`, asc(songs.id)];

export const songRepository = {
  async create(fields: SongFields): Promise<SongRecord> {
    const values = toSongValues(fields);
    const { title, originalKey, artist, chordLyrics } = values;
    if (!title || !originalKey || !artist || !chordLyrics) {
      throw new InvalidInputError('song');
    }
    const now = new Date();
    const [row] = await getDb()
      .insert(songs)
      .values({
        ...values,
        title,
        originalKey,
        artist,
        chordLyrics,
        id: generateObjectId(now),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toSongRecord(row);
  },

  async findLiveById(id: string): Promise<SongRecord | null> {
    const [row] = await getDb().select().from(songs).where(isLiveSong(id));
    return row ? toSongRecord(row) : null;
  },

  async listLive(): Promise<SongRecord[]> {
    const rows = await getDb()
      .select()
      .from(songs)
      .where(eq(songs.isDeleted, false))
      .orderBy(asc(songs.id));
    return rows.map(toSongRecord);
  },

  async listLiveView(): Promise<SongViewRecord[]> {
    const rows = await getDb()
      .select()
      .from(songs)
      .where(eq(songs.isDeleted, false))
      .orderBy(asc(songs.id));
    return rows.map(toSongViewRecord);
  },

  async search(search: SongSearch): Promise<{ songs: SongRecord[]; totalCount: number }> {
    const where = searchCondition(search);
    const db = getDb();
    const rows = await db
      .select()
      .from(songs)
      .where(where)
      .orderBy(...searchOrder(search.sortBy))
      .offset(search.offset)
      .limit(search.limit);
    const [{ totalCount }] = await db.select({ totalCount: count() }).from(songs).where(where);
    return { songs: rows.map(toSongRecord), totalCount };
  },

  async updateLive(id: string, fields: SongFields): Promise<SongRecord | null> {
    const [row] = await getDb()
      .update(songs)
      .set({ ...toSongValues(fields), updatedAt: new Date() })
      .where(isLiveSong(id))
      .returning();
    return row ? toSongRecord(row) : null;
  },

  async softDelete(id: string): Promise<boolean> {
    const rows = await getDb()
      .update(songs)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(isLiveSong(id))
      .returning({ id: songs.id });
    return rows.length > 0;
  },
};
