import { planBackfill } from '../../utils/legacyOwnership';
import { isObjectIdString } from '../../utils/validation';
import { toObjectId } from '../objectId';
import { groupBy } from '../repositories/shared';
import {
  MUSIC_KEYS,
  groupSetlists,
  groups,
  ownershipGroups,
  ownershipSetlists,
  ownerships,
  setlistSongKeys,
  setlistSongs,
  setlists,
  songs,
} from '../schema';
import { fromExtendedJson } from './extendedJson';

export const COLLECTIONS = ['songs', 'setlists', 'groups', 'ownerships'] as const;

export const IMPORT_TABLES = [
  'songs',
  'setlists',
  'groups',
  'ownerships',
  'setlist_songs',
  'setlist_song_keys',
  'group_setlists',
  'ownership_setlists',
  'ownership_groups',
] as const;

export type Collection = (typeof COLLECTIONS)[number];
export type ImportTable = (typeof IMPORT_TABLES)[number];
export type LinkTable = Exclude<ImportTable, Collection>;
export type MongoExport = Record<Collection, unknown>;

export type ImportRows = {
  songs: (typeof songs.$inferInsert)[];
  setlists: (typeof setlists.$inferInsert)[];
  groups: (typeof groups.$inferInsert)[];
  ownerships: (typeof ownerships.$inferInsert)[];
  setlist_songs: (typeof setlistSongs.$inferInsert)[];
  setlist_song_keys: (typeof setlistSongKeys.$inferInsert)[];
  group_setlists: (typeof groupSetlists.$inferInsert)[];
  ownership_setlists: (typeof ownershipSetlists.$inferInsert)[];
  ownership_groups: (typeof ownershipGroups.$inferInsert)[];
};

export type InvalidDocument = {
  collection: Collection;
  index: number;
  id: string | null;
  reason: string;
};

export type SkipReason =
  | 'invalid id'
  | 'missing document'
  | 'soft-deleted folder'
  | 'invalid key'
  | 'invalid entry';

export type SkippedLink = {
  table: LinkTable;
  reason: SkipReason;
  fromId: string;
  toId: string | null;
};

export type ImportPlan = {
  read: Record<Collection, number>;
  rows: ImportRows;
  invalidDocuments: InvalidDocument[];
  skippedLinks: SkippedLink[];
  backfill: {
    setlists: number;
    groups: number;
    ambiguous: { setlists: string[]; groups: string[] };
  };
  unknownFields: Record<Collection, Record<string, number>>;
};

type Doc = Record<string, unknown>;
type SongRow = ImportRows['songs'][number];
type SetlistRow = ImportRows['setlists'][number];
type GroupRow = ImportRows['groups'][number];
type OwnershipRow = ImportRows['ownerships'][number];
type EntryValues = {
  entryId: string | null;
  entryName: string | null;
  entryCreatedAt: string | null;
};

type SetlistDoc = {
  row: SetlistRow;
  songRefs: unknown[];
  songKeys: unknown[];
  groupRefs: unknown[];
};
type GroupDoc = { row: GroupRow; setlistRefs: unknown[] };
type OwnershipDoc = { row: OwnershipRow; groupEntries: unknown[]; setlistEntries: unknown[] };

const IGNORED_FIELDS = new Set(['__v']);

const KNOWN_FIELDS: Record<Collection, ReadonlySet<string>> = {
  songs: new Set([
    '_id',
    'title',
    'tempo',
    'originalKey',
    'recommendedKeys',
    'themes',
    'artist',
    'year',
    'code',
    'createdBy',
    'lastUpdatedBy',
    'timeSignature',
    'isVerified',
    'chordLyrics',
    'simplifiedChordLyrics',
    'isDeleted',
    'createdAt',
    'updatedAt',
  ]),
  setlists: new Set([
    '_id',
    'name',
    'date',
    'createdBy',
    'songs',
    'songKeys',
    'lastUpdatedBy',
    'publicLink',
    'groupIds',
    'isDeleted',
    'createdAt',
    'updatedAt',
  ]),
  groups: new Set([
    '_id',
    'groupName',
    'setlistIds',
    'createdBy',
    'lastUpdatedBy',
    'isDeleted',
    'createdAt',
    'updatedAt',
  ]),
  ownerships: new Set([
    '_id',
    'userId',
    'fullName',
    'accessType',
    'groupIds',
    'setlistIds',
    'isDeleted',
    'createdAt',
    'updatedAt',
  ]),
};

const NESTED_FIELDS: Partial<Record<Collection, Record<string, ReadonlySet<string>>>> = {
  setlists: { songKeys: new Set(['songId', 'key']) },
  ownerships: {
    groupIds: new Set(['id', 'name', 'createdAt']),
    setlistIds: new Set(['id', 'name', 'createdAt']),
  },
};

class FieldError extends Error {
  constructor(
    readonly field: string,
    readonly problem: 'missing' | 'invalid'
  ) {
    super(`${problem} ${field}`);
    this.name = 'FieldError';
  }
}

const isDoc = (value: unknown): value is Doc =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

const isMusicKey = (value: unknown): value is string =>
  MUSIC_KEYS.some((musicKey) => musicKey === value);

const toId = (value: unknown): string | null =>
  isObjectIdString(value) ? toObjectId(value) : null;

const objectIdTime = (id: string): Date => new Date(parseInt(id.slice(0, 8), 16) * 1000);

const optionalString = (doc: Doc, field: string): string | null => {
  const value = doc[field];
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  throw new FieldError(field, 'invalid');
};

const requiredString = (doc: Doc, field: string): string => {
  const value = optionalString(doc, field);
  if (value === null) throw new FieldError(field, 'missing');
  return value;
};

const stringArray = (doc: Doc, field: string): string[] => {
  const value = doc[field];
  if (value === undefined || value === null) return [];
  const items: unknown[] = Array.isArray(value) ? value : [value];
  return items
    .filter((item) => item !== null && item !== undefined)
    .map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'number' || typeof item === 'boolean') return String(item);
      throw new FieldError(field, 'invalid');
    });
};

const refArray = (doc: Doc, field: string): unknown[] => {
  const value = doc[field];
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

const booleanField = (doc: Doc, field: string, fallback: boolean): boolean => {
  const value = doc[field];
  if (value === undefined || value === null) return fallback;
  if (value === true || value === 'true' || value === 1) return true;
  if (value === false || value === 'false' || value === 0) return false;
  throw new FieldError(field, 'invalid');
};

const dateField = (doc: Doc, field: string): Date | null => {
  const value = doc[field];
  if (value === undefined || value === null || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new FieldError(field, 'invalid');
  return date;
};

const reference = (doc: Doc, field: string): string | null => {
  const value = optionalString(doc, field);
  return value !== null && isObjectIdString(value) ? toObjectId(value) : value;
};

const timestamps = (doc: Doc, id: string) => ({
  createdAt: dateField(doc, 'createdAt') ?? objectIdTime(id),
  updatedAt: dateField(doc, 'updatedAt') ?? objectIdTime(id),
});

const toSong = (doc: Doc, id: string): SongRow => ({
  id,
  title: requiredString(doc, 'title'),
  tempo: stringArray(doc, 'tempo'),
  originalKey: requiredString(doc, 'originalKey'),
  recommendedKeys: stringArray(doc, 'recommendedKeys'),
  themes: stringArray(doc, 'themes'),
  artist: requiredString(doc, 'artist'),
  year: optionalString(doc, 'year'),
  code: optionalString(doc, 'code'),
  createdBy: reference(doc, 'createdBy'),
  lastUpdatedBy: reference(doc, 'lastUpdatedBy'),
  timeSignature: stringArray(doc, 'timeSignature'),
  isVerified: booleanField(doc, 'isVerified', false),
  chordLyrics: requiredString(doc, 'chordLyrics'),
  simplifiedChordLyrics: optionalString(doc, 'simplifiedChordLyrics'),
  isDeleted: booleanField(doc, 'isDeleted', false),
  ...timestamps(doc, id),
});

const toSetlist = (doc: Doc, id: string): SetlistDoc => ({
  row: {
    id,
    name: requiredString(doc, 'name'),
    date: dateField(doc, 'date'),
    createdBy: reference(doc, 'createdBy'),
    lastUpdatedBy: reference(doc, 'lastUpdatedBy'),
    publicLink: optionalString(doc, 'publicLink'),
    isDeleted: booleanField(doc, 'isDeleted', false),
    ...timestamps(doc, id),
  },
  songRefs: refArray(doc, 'songs'),
  songKeys: refArray(doc, 'songKeys'),
  groupRefs: refArray(doc, 'groupIds'),
});

const toGroup = (doc: Doc, id: string): GroupDoc => ({
  row: {
    id,
    groupName: requiredString(doc, 'groupName'),
    createdBy: reference(doc, 'createdBy'),
    lastUpdatedBy: reference(doc, 'lastUpdatedBy'),
    isDeleted: booleanField(doc, 'isDeleted', false),
    ...timestamps(doc, id),
  },
  setlistRefs: refArray(doc, 'setlistIds'),
});

const toOwnership = (doc: Doc, id: string): OwnershipDoc => ({
  row: {
    id,
    userId: requiredString(doc, 'userId'),
    fullName: requiredString(doc, 'fullName'),
    accessType: optionalString(doc, 'accessType') ?? 'unsigned',
    isDeleted: booleanField(doc, 'isDeleted', false),
    ...timestamps(doc, id),
  },
  groupEntries: refArray(doc, 'groupIds'),
  setlistEntries: refArray(doc, 'setlistIds'),
});

const countUnknownFields = (collection: Collection, doc: Doc, counts: Record<string, number>) => {
  const add = (field: string) => {
    counts[field] = (counts[field] ?? 0) + 1;
  };
  for (const field of Object.keys(doc)) {
    if (!KNOWN_FIELDS[collection].has(field) && !IGNORED_FIELDS.has(field)) add(field);
  }
  for (const [field, known] of Object.entries(NESTED_FIELDS[collection] ?? {})) {
    const items = doc[field];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!isDoc(item)) continue;
      for (const key of Object.keys(item)) {
        if (!known.has(key) && !IGNORED_FIELDS.has(key)) add(`${field}[].${key}`);
      }
    }
  }
};

type Loaded<T> = { docs: T[]; ids: Set<string> };

type UniqueField<T> = { field: string; valueOf: (doc: T) => string | null };

const loadCollection = <T>(
  collection: Collection,
  raw: unknown,
  map: (doc: Doc, id: string) => T,
  plan: ImportPlan,
  unique?: UniqueField<T>
): Loaded<T> => {
  if (!Array.isArray(raw)) throw new Error(`${collection}: expected a JSON array of documents`);
  plan.read[collection] = raw.length;
  const docs: T[] = [];
  const ids = new Set<string>();
  const uniqueValues = new Set<string>();
  raw.forEach((value: unknown, index) => {
    const invalid = (id: string | null, reason: string) =>
      plan.invalidDocuments.push({ collection, index, id, reason });
    const doc = fromExtendedJson(value);
    if (!isDoc(doc)) {
      invalid(null, 'not a document');
      return;
    }
    countUnknownFields(collection, doc, plan.unknownFields[collection]);
    const id = toId(doc._id);
    if (id === null) {
      invalid(null, 'invalid _id');
      return;
    }
    if (ids.has(id)) {
      invalid(id, 'duplicate _id');
      return;
    }
    let mapped: T;
    try {
      mapped = map(doc, id);
    } catch (error: unknown) {
      if (!(error instanceof FieldError)) throw error;
      invalid(id, error.message);
      return;
    }
    const uniqueValue = unique?.valueOf(mapped) ?? null;
    if (unique && uniqueValue !== null) {
      if (uniqueValues.has(uniqueValue)) {
        invalid(id, `duplicate ${unique.field}`);
        return;
      }
      uniqueValues.add(uniqueValue);
    }
    docs.push(mapped);
    ids.add(id);
  });
  return { docs, ids };
};

const toEntries = (
  table: 'ownership_groups' | 'ownership_setlists',
  ownershipId: string,
  items: unknown[],
  plan: ImportPlan
): (EntryValues & { position: number; ownershipId: string })[] => {
  const entries: (EntryValues & { position: number; ownershipId: string })[] = [];
  for (const item of items) {
    if (!isDoc(item)) {
      plan.skippedLinks.push({ table, reason: 'invalid entry', fromId: ownershipId, toId: null });
      continue;
    }
    try {
      entries.push({
        ownershipId,
        position: entries.length,
        entryId: optionalString(item, 'id'),
        entryName: optionalString(item, 'name'),
        entryCreatedAt: optionalString(item, 'createdAt'),
      });
    } catch (error: unknown) {
      if (!(error instanceof FieldError)) throw error;
      plan.skippedLinks.push({ table, reason: 'invalid entry', fromId: ownershipId, toId: null });
    }
  }
  return entries;
};

const applyBackfill = (
  setlistDocs: SetlistDoc[],
  groupDocs: GroupDoc[],
  ownershipRows: OwnershipRow[],
  entries: { groups: Map<string, EntryValues[]>; setlists: Map<string, EntryValues[]> },
  plan: ImportPlan
) => {
  const asEntries = (values: EntryValues[] | undefined) =>
    (values ?? []).flatMap(({ entryId }) =>
      entryId === null ? [] : [{ id: entryId, name: '', createdAt: '' }]
    );
  const result = planBackfill({
    setlists: setlistDocs.map(({ row, groupRefs }) => ({
      _id: row.id,
      createdBy: row.createdBy,
      isDeleted: row.isDeleted,
      groupIds: groupRefs.map(toId).filter((id): id is string => id !== null),
    })),
    groups: groupDocs.map(({ row, setlistRefs }) => ({
      _id: row.id,
      createdBy: row.createdBy,
      isDeleted: row.isDeleted,
      setlistIds: setlistRefs.map(toId).filter((id): id is string => id !== null),
    })),
    ownerships: ownershipRows.map((row) => ({
      userId: row.userId,
      isDeleted: row.isDeleted,
      groupIds: asEntries(entries.groups.get(row.id)),
      setlistIds: asEntries(entries.setlists.get(row.id)),
    })),
  });
  const setlistById = new Map(setlistDocs.map((doc) => [doc.row.id, doc.row]));
  const groupById = new Map(groupDocs.map((doc) => [doc.row.id, doc.row]));
  for (const { setlistId, userId } of result.setlistCreatedBy) {
    const row = setlistById.get(setlistId);
    if (row) row.createdBy = toObjectId(userId);
  }
  for (const { groupId, userId } of result.groupCreatedBy) {
    const row = groupById.get(groupId);
    if (row) row.createdBy = toObjectId(userId);
  }
  plan.backfill = {
    setlists: result.setlistCreatedBy.length,
    groups: result.groupCreatedBy.length,
    ambiguous: result.ambiguous,
  };
};

const toSetlistSongs = (docs: SetlistDoc[], songIds: Set<string>, plan: ImportPlan) =>
  docs.flatMap(({ row, songRefs }) => {
    const links: ImportRows['setlist_songs'] = [];
    for (const ref of songRefs) {
      const songId = toId(ref);
      if (songId === null || !songIds.has(songId)) {
        plan.skippedLinks.push({
          table: 'setlist_songs',
          reason: songId === null ? 'invalid id' : 'missing document',
          fromId: row.id,
          toId: songId,
        });
        continue;
      }
      links.push({ setlistId: row.id, position: links.length, songId });
    }
    return links;
  });

const toSetlistSongKeys = (docs: SetlistDoc[], songIds: Set<string>, plan: ImportPlan) =>
  docs.flatMap(({ row, songKeys }) => {
    const keyBySongId = new Map<string, string>();
    for (const entry of songKeys) {
      const skip = (reason: SkipReason, toIdValue: string | null) =>
        plan.skippedLinks.push({
          table: 'setlist_song_keys',
          reason,
          fromId: row.id,
          toId: toIdValue,
        });
      if (!isDoc(entry)) {
        skip('invalid entry', null);
        continue;
      }
      const songId = toId(entry.songId);
      if (songId === null) skip('invalid id', null);
      else if (!songIds.has(songId)) skip('missing document', songId);
      else if (!isMusicKey(entry.key)) skip('invalid key', songId);
      else {
        keyBySongId.delete(songId);
        keyBySongId.set(songId, entry.key);
      }
    }
    return Array.from(keyBySongId, ([songId, key], position) => ({
      setlistId: row.id,
      songId,
      key,
      position,
    }));
  });

const toGroupSetlists = (
  setlistDocs: SetlistDoc[],
  groupDocs: GroupDoc[],
  setlistIds: Set<string>,
  plan: ImportPlan
): ImportRows['group_setlists'] => {
  const deletedGroups = new Set(
    groupDocs.filter(({ row }) => row.isDeleted).map(({ row }) => row.id)
  );
  const linkedByGroup = new Map<string, string[]>(groupDocs.map(({ row }) => [row.id, []]));
  const skip = (reason: SkipReason, fromId: string, toIdValue: string | null) =>
    plan.skippedLinks.push({ table: 'group_setlists', reason, fromId, toId: toIdValue });
  const link = (groupId: string, setlistId: string) => {
    const linked = linkedByGroup.get(groupId);
    if (linked && !linked.includes(setlistId)) linked.push(setlistId);
  };

  for (const { row, setlistRefs } of groupDocs) {
    for (const ref of setlistRefs) {
      const setlistId = toId(ref);
      if (setlistId === null) skip('invalid id', row.id, null);
      else if (!setlistIds.has(setlistId)) skip('missing document', row.id, setlistId);
      else if (deletedGroups.has(row.id)) skip('soft-deleted folder', row.id, setlistId);
      else link(row.id, setlistId);
    }
  }
  for (const { row, groupRefs } of setlistDocs) {
    for (const ref of groupRefs) {
      const groupId = toId(ref);
      if (groupId === null) skip('invalid id', row.id, null);
      else if (!linkedByGroup.has(groupId)) skip('missing document', row.id, groupId);
      else if (deletedGroups.has(groupId)) skip('soft-deleted folder', row.id, groupId);
      else link(groupId, row.id);
    }
  }
  return Array.from(linkedByGroup).flatMap(([groupId, linked]) =>
    linked.map((setlistId, position) => ({ groupId, setlistId, position }))
  );
};

const emptyPlan = (): ImportPlan => ({
  read: { songs: 0, setlists: 0, groups: 0, ownerships: 0 },
  rows: {
    songs: [],
    setlists: [],
    groups: [],
    ownerships: [],
    setlist_songs: [],
    setlist_song_keys: [],
    group_setlists: [],
    ownership_setlists: [],
    ownership_groups: [],
  },
  invalidDocuments: [],
  skippedLinks: [],
  backfill: { setlists: 0, groups: 0, ambiguous: { setlists: [], groups: [] } },
  unknownFields: { songs: {}, setlists: {}, groups: {}, ownerships: {} },
});

export const planImport = (exported: MongoExport): ImportPlan => {
  const plan = emptyPlan();
  const songDocs = loadCollection('songs', exported.songs, toSong, plan);
  const setlistDocs = loadCollection('setlists', exported.setlists, toSetlist, plan, {
    field: 'publicLink',
    valueOf: (doc) => doc.row.publicLink ?? null,
  });
  const groupDocs = loadCollection('groups', exported.groups, toGroup, plan);
  const ownershipDocs = loadCollection('ownerships', exported.ownerships, toOwnership, plan, {
    field: 'userId',
    valueOf: (doc) => doc.row.userId,
  });

  const groupEntries = ownershipDocs.docs.flatMap((doc) =>
    toEntries('ownership_groups', doc.row.id, doc.groupEntries, plan)
  );
  const setlistEntries = ownershipDocs.docs.flatMap((doc) =>
    toEntries('ownership_setlists', doc.row.id, doc.setlistEntries, plan)
  );
  const byOwnership = (entries: (EntryValues & { ownershipId: string })[]) =>
    groupBy(
      entries,
      (entry) => entry.ownershipId,
      (entry): EntryValues => entry
    );
  applyBackfill(
    setlistDocs.docs,
    groupDocs.docs,
    ownershipDocs.docs.map(({ row }) => row),
    { groups: byOwnership(groupEntries), setlists: byOwnership(setlistEntries) },
    plan
  );

  plan.rows = {
    songs: songDocs.docs,
    setlists: setlistDocs.docs.map(({ row }) => row),
    groups: groupDocs.docs.map(({ row }) => row),
    ownerships: ownershipDocs.docs.map(({ row }) => row),
    setlist_songs: toSetlistSongs(setlistDocs.docs, songDocs.ids, plan),
    setlist_song_keys: toSetlistSongKeys(setlistDocs.docs, songDocs.ids, plan),
    group_setlists: toGroupSetlists(setlistDocs.docs, groupDocs.docs, setlistDocs.ids, plan),
    ownership_setlists: setlistEntries.map(({ ownershipId, position, entryId, ...entry }) => ({
      ownershipId,
      position,
      setlistId: entryId,
      ...entry,
    })),
    ownership_groups: groupEntries.map(({ ownershipId, position, entryId, ...entry }) => ({
      ownershipId,
      position,
      groupId: entryId,
      ...entry,
    })),
  };
  return plan;
};
