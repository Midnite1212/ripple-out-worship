import { SQL, and, asc, eq, exists, inArray, notInArray, or, sql } from 'drizzle-orm';
import {
  PopulatedSetlistRecord,
  PublicSetlistRecord,
  SetlistAccess,
  SetlistRecord,
  SetlistSongKey,
} from '../../types/setlist.types';
import { PublicSongRecord, SongRecord } from '../../types/song.types';
import {
  InvalidInputError,
  castDate,
  castObjectId,
  castObjectIdArray,
  castRequiredString,
  has,
} from '../cast';
import { getDb } from '../connect';
import { toObjectId } from '../objectId';
import {
  MUSIC_KEYS,
  groupSetlists,
  setlistSongKeys,
  setlistSongs,
  setlists,
  songs,
} from '../schema';
import { Executor, Transaction, groupBy, presentFields, unique } from './shared';
import { toPublicSongRecord, toSongRecord } from './song.repository';

export const SETLIST_FIELDS = ['name', 'date', 'songs', 'songKeys', 'groupIds'] as const;

export type SetlistField = (typeof SETLIST_FIELDS)[number];
export type SetlistFields = Partial<Record<SetlistField, unknown>>;
export type SetlistCreate = SetlistFields & { _id: string; createdBy: string; publicLink: string };
export type SetlistView = 'full' | 'public';
export type SetlistReach =
  | { all: true }
  | { setlistIds: string[]; groupIds: string[]; createdBy?: string };

type SetlistRow = typeof setlists.$inferSelect;
type SetlistLinks = { songIds: string[]; songKeys: SetlistSongKey[]; groupIds: string[] };

type SetlistValues = {
  name?: string;
  date?: Date | null;
  songs?: string[];
  songKeys?: SetlistSongKey[];
  groupIds?: string[];
};

const isMusicKey = (value: unknown): value is string =>
  MUSIC_KEYS.some((musicKey) => musicKey === value);

const castSongKeys = (value: unknown): SetlistSongKey[] => {
  if (!Array.isArray(value)) throw new InvalidInputError('songKeys');
  const keyBySongId = new Map<string, string>();
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) throw new InvalidInputError('songKeys');
    const songId = castObjectId('songKeys.songId', Reflect.get(entry, 'songId'));
    const key: unknown = Reflect.get(entry, 'key');
    if (!isMusicKey(key)) throw new InvalidInputError('songKeys.key');
    keyBySongId.delete(songId);
    keyBySongId.set(songId, key);
  }
  return Array.from(keyBySongId, ([songId, key]) => ({ songId, key }));
};

const toSetlistValues = (fields: SetlistFields): SetlistValues => {
  const values: SetlistValues = {};
  if (has(fields, 'name')) values.name = castRequiredString('name', fields.name);
  if (has(fields, 'date')) values.date = castDate('date', fields.date);
  if (has(fields, 'songs')) values.songs = castObjectIdArray('songs', fields.songs);
  if (has(fields, 'songKeys')) values.songKeys = castSongKeys(fields.songKeys);
  if (has(fields, 'groupIds'))
    values.groupIds = unique(castObjectIdArray('groupIds', fields.groupIds));
  return values;
};

const isLiveSetlist = (id: string): SQL | undefined =>
  and(eq(setlists.id, toObjectId(id)), eq(setlists.isDeleted, false));

const loadLinks = async (executor: Executor, ids: string[]): Promise<Map<string, SetlistLinks>> => {
  if (ids.length === 0) return new Map();
  const [songRows, keyRows, groupLinkRows] = await Promise.all([
    executor
      .select({ setlistId: setlistSongs.setlistId, songId: setlistSongs.songId })
      .from(setlistSongs)
      .where(inArray(setlistSongs.setlistId, ids))
      .orderBy(asc(setlistSongs.setlistId), asc(setlistSongs.position)),
    executor
      .select({
        setlistId: setlistSongKeys.setlistId,
        songId: setlistSongKeys.songId,
        key: setlistSongKeys.key,
      })
      .from(setlistSongKeys)
      .where(inArray(setlistSongKeys.setlistId, ids))
      .orderBy(asc(setlistSongKeys.setlistId), asc(setlistSongKeys.position)),
    executor
      .select({ setlistId: groupSetlists.setlistId, groupId: groupSetlists.groupId })
      .from(groupSetlists)
      .where(inArray(groupSetlists.setlistId, ids))
      .orderBy(asc(groupSetlists.setlistId), asc(groupSetlists.groupId)),
  ]);
  const songIdsBySetlist = groupBy(
    songRows,
    (row) => row.setlistId,
    (row) => row.songId
  );
  const keysBySetlist = groupBy(
    keyRows,
    (row) => row.setlistId,
    (row) => ({ songId: row.songId, key: row.key })
  );
  const groupIdsBySetlist = groupBy(
    groupLinkRows,
    (row) => row.setlistId,
    (row) => row.groupId
  );
  return new Map(
    ids.map((id) => [
      id,
      {
        songIds: songIdsBySetlist.get(id) ?? [],
        songKeys: keysBySetlist.get(id) ?? [],
        groupIds: groupIdsBySetlist.get(id) ?? [],
      },
    ])
  );
};

const loadSongs = async <Song>(
  ids: string[],
  toSong: (row: typeof songs.$inferSelect) => Song
): Promise<Map<string, Song[]>> => {
  if (ids.length === 0) return new Map();
  const rows = await getDb()
    .select({ setlistId: setlistSongs.setlistId, song: songs })
    .from(setlistSongs)
    .innerJoin(songs, eq(songs.id, setlistSongs.songId))
    .where(inArray(setlistSongs.setlistId, ids))
    .orderBy(asc(setlistSongs.setlistId), asc(setlistSongs.position));
  return groupBy(
    rows,
    (row) => row.setlistId,
    (row) => toSong(row.song)
  );
};

const toSetlistRecord = (row: SetlistRow, links: SetlistLinks | undefined): SetlistRecord => ({
  _id: row.id,
  name: row.name,
  date: row.date,
  ...presentFields({ createdBy: row.createdBy }),
  songs: links?.songIds ?? [],
  songKeys: links?.songKeys ?? [],
  ...presentFields({ lastUpdatedBy: row.lastUpdatedBy }),
  publicLink: row.publicLink,
  groupIds: links?.groupIds ?? [],
  isDeleted: row.isDeleted,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const assembleRecords = async (
  executor: Executor,
  rows: SetlistRow[]
): Promise<SetlistRecord[]> => {
  const links = await loadLinks(
    executor,
    rows.map(({ id }) => id)
  );
  return rows.map((row) => toSetlistRecord(row, links.get(row.id)));
};

const populateFull = async (rows: SetlistRow[]): Promise<PopulatedSetlistRecord[]> => {
  const ids = rows.map(({ id }) => id);
  const [records, songsBySetlist] = await Promise.all([
    assembleRecords(getDb(), rows),
    loadSongs<SongRecord>(ids, toSongRecord),
  ]);
  return records.map((record) => ({ ...record, songs: songsBySetlist.get(record._id) ?? [] }));
};

const populatePublic = async (rows: SetlistRow[]): Promise<PublicSetlistRecord[]> => {
  const ids = rows.map(({ id }) => id);
  const [records, songsBySetlist] = await Promise.all([
    assembleRecords(getDb(), rows),
    loadSongs<PublicSongRecord>(ids, toPublicSongRecord),
  ]);
  return records.map((record) => ({
    _id: record._id,
    name: record.name,
    date: record.date,
    songs: songsBySetlist.get(record._id) ?? [],
    songKeys: record.songKeys,
    publicLink: record.publicLink,
    isDeleted: record.isDeleted,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
};

const populate = (
  rows: SetlistRow[],
  view: SetlistView
): Promise<PopulatedSetlistRecord[] | PublicSetlistRecord[]> =>
  view === 'public' ? populatePublic(rows) : populateFull(rows);

const replaceSongs = async (tx: Transaction, setlistId: string, songIds: string[]) => {
  await tx.delete(setlistSongs).where(eq(setlistSongs.setlistId, setlistId));
  if (songIds.length === 0) return;
  await tx
    .insert(setlistSongs)
    .values(songIds.map((songId, position) => ({ setlistId, position, songId })));
};

const replaceSongKeys = async (tx: Transaction, setlistId: string, songKeys: SetlistSongKey[]) => {
  await tx.delete(setlistSongKeys).where(eq(setlistSongKeys.setlistId, setlistId));
  if (songKeys.length === 0) return;
  await tx
    .insert(setlistSongKeys)
    .values(songKeys.map(({ songId, key }, position) => ({ setlistId, songId, key, position })));
};

const appendToGroups = async (tx: Transaction, setlistId: string, groupIds: string[]) => {
  for (const groupId of groupIds) {
    await tx
      .insert(groupSetlists)
      .values({
        groupId,
        setlistId,
        position: sql`(select coalesce(max(${groupSetlists.position}), -1) + 1 from ${groupSetlists} where ${groupSetlists.groupId} = ${groupId})`,
      })
      .onConflictDoNothing();
  }
};

const replaceGroups = async (tx: Transaction, setlistId: string, groupIds: string[]) => {
  await tx
    .delete(groupSetlists)
    .where(
      groupIds.length > 0
        ? and(eq(groupSetlists.setlistId, setlistId), notInArray(groupSetlists.groupId, groupIds))
        : eq(groupSetlists.setlistId, setlistId)
    );
  await appendToGroups(tx, setlistId, groupIds);
};

const writeLinks = async (tx: Transaction, setlistId: string, values: SetlistValues) => {
  if (values.songs) await replaceSongs(tx, setlistId, values.songs);
  if (values.songKeys) await replaceSongKeys(tx, setlistId, values.songKeys);
  if (values.groupIds) await replaceGroups(tx, setlistId, values.groupIds);
};

const reachCondition = (reach: SetlistReach): SQL | undefined => {
  if ('all' in reach) return eq(setlists.isDeleted, false);
  const setlistIds = reach.setlistIds.map(toObjectId);
  const groupIds = reach.groupIds.map(toObjectId);
  const access: SQL[] = [];
  if (setlistIds.length > 0) access.push(inArray(setlists.id, setlistIds));
  if (groupIds.length > 0) {
    access.push(
      exists(
        getDb()
          .select({ one: sql`1` })
          .from(groupSetlists)
          .where(
            and(eq(groupSetlists.setlistId, setlists.id), inArray(groupSetlists.groupId, groupIds))
          )
      )
    );
  }
  if (reach.createdBy) access.push(eq(setlists.createdBy, toObjectId(reach.createdBy)));
  return and(eq(setlists.isDeleted, false), access.length > 0 ? or(...access) : sql`false`);
};

export const setlistRepository = {
  async create({ _id, createdBy, publicLink, ...fields }: SetlistCreate): Promise<SetlistRecord> {
    const values = toSetlistValues(fields);
    if (values.name === undefined) throw new InvalidInputError('name');
    const { name } = values;
    const id = toObjectId(_id);
    const now = new Date();
    return getDb().transaction(async (tx) => {
      const [row] = await tx
        .insert(setlists)
        .values({
          id,
          name,
          date: values.date ?? null,
          createdBy: toObjectId(createdBy),
          publicLink,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      await writeLinks(tx, id, values);
      const [record] = await assembleRecords(tx, [row]);
      return record;
    });
  },

  async findLiveById(id: string, view: SetlistView) {
    const rows = await getDb().select().from(setlists).where(isLiveSetlist(id));
    const [record] = await populate(rows, view);
    return record ?? null;
  },

  async findLiveByIds(ids: string[], view: SetlistView) {
    const rows = await getDb()
      .select()
      .from(setlists)
      .where(and(inArray(setlists.id, unique(ids.map(toObjectId))), eq(setlists.isDeleted, false)))
      .orderBy(asc(setlists.id));
    return populate(rows, view);
  },

  async listLiveReachable(reach: SetlistReach): Promise<PopulatedSetlistRecord[]> {
    const rows = await getDb()
      .select()
      .from(setlists)
      .where(reachCondition(reach))
      .orderBy(asc(setlists.id));
    return populateFull(rows);
  },

  async findLiveAccess(id: string): Promise<SetlistAccess | null> {
    const [access] = await setlistRepository.findLiveAccessByIds([id]);
    return access ?? null;
  },

  async findLiveAccessByIds(ids: string[]): Promise<SetlistAccess[]> {
    const db = getDb();
    const rows = await db
      .select({ id: setlists.id, createdBy: setlists.createdBy })
      .from(setlists)
      .where(and(inArray(setlists.id, unique(ids.map(toObjectId))), eq(setlists.isDeleted, false)))
      .orderBy(asc(setlists.id));
    const links = await loadLinks(
      db,
      rows.map(({ id }) => id)
    );
    return rows.map((row) => ({
      _id: row.id,
      ...presentFields({ createdBy: row.createdBy }),
      groupIds: links.get(row.id)?.groupIds ?? [],
      songs: links.get(row.id)?.songIds ?? [],
    }));
  },

  async updateLive(id: string, fields: SetlistFields): Promise<SetlistRecord | null> {
    const { songs: songIds, songKeys, groupIds, ...scalars } = toSetlistValues(fields);
    return getDb().transaction(async (tx) => {
      const [row] = await tx
        .update(setlists)
        .set({ ...scalars, updatedAt: new Date() })
        .where(isLiveSetlist(id))
        .returning();
      if (!row) return null;
      await writeLinks(tx, row.id, { songs: songIds, songKeys, groupIds });
      const [record] = await assembleRecords(tx, [row]);
      return record;
    });
  },

  async softDelete(id: string): Promise<boolean> {
    const rows = await getDb()
      .update(setlists)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(isLiveSetlist(id))
      .returning({ id: setlists.id });
    return rows.length > 0;
  },
};
