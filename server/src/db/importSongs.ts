import { inArray } from 'drizzle-orm';
import { getDb } from './connect';
import { songs } from './schema';

export type SongRow = typeof songs.$inferInsert;
export type SkippedSong = { index: number; id: string | null };
export type MappedSongs = { rows: SongRow[]; skipped: SkippedSong[] };

type ExtendedJson = Record<string, unknown>;

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const INSERT_BATCH_SIZE = 500;

const isRecord = (value: unknown): value is ExtendedJson =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseObjectId = (value: unknown): string | null => {
  const hex = isRecord(value) ? value.$oid : value;
  return typeof hex === 'string' && OBJECT_ID.test(hex) ? hex.toLowerCase() : null;
};

export const parseDate = (value: unknown): Date | null => {
  const raw = isRecord(value) ? value.$date : value;
  const instant = isRecord(raw) ? Number(raw.$numberLong) : raw;
  if (typeof instant !== 'string' && typeof instant !== 'number') return null;
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const objectIdDate = (id: string): Date => new Date(parseInt(id.slice(0, 8), 16) * 1000);

const requiredText = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const optionalText = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const textArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const toSongRow = (document: unknown): SongRow | null => {
  if (!isRecord(document)) return null;
  const id = parseObjectId(document._id);
  const title = requiredText(document.title);
  const artist = requiredText(document.artist);
  const originalKey = requiredText(document.originalKey);
  const chordLyrics = requiredText(document.chordLyrics);
  if (!id || !title || !artist || !originalKey || !chordLyrics) return null;
  const createdAt = parseDate(document.createdAt) ?? objectIdDate(id);
  return {
    id,
    title,
    artist,
    originalKey,
    chordLyrics,
    tempo: textArray(document.tempo),
    recommendedKeys: textArray(document.recommendedKeys),
    themes: textArray(document.themes),
    timeSignature: textArray(document.timeSignature),
    year: optionalText(document.year),
    code: optionalText(document.code),
    simplifiedChordLyrics: optionalText(document.simplifiedChordLyrics),
    createdBy: parseObjectId(document.createdBy),
    lastUpdatedBy: parseObjectId(document.lastUpdatedBy),
    isVerified: document.isVerified === true,
    isDeleted: document.isDeleted === true,
    createdAt,
    updatedAt: parseDate(document.updatedAt) ?? createdAt,
  };
};

export const mapSongDocuments = (documents: unknown[]): MappedSongs => {
  const rows: SongRow[] = [];
  const skipped: SkippedSong[] = [];
  const seen = new Set<string>();
  documents.forEach((document, index) => {
    const row = toSongRow(document);
    if (row && !seen.has(row.id)) {
      seen.add(row.id);
      rows.push(row);
    } else {
      skipped.push({ index, id: isRecord(document) ? parseObjectId(document._id) : null });
    }
  });
  return { rows, skipped };
};

export const countExistingSongs = async (ids: string[]): Promise<number> => {
  if (ids.length === 0) return 0;
  const rows = await getDb().select({ id: songs.id }).from(songs).where(inArray(songs.id, ids));
  return rows.length;
};

export const insertSongs = (rows: SongRow[]): Promise<number> =>
  getDb().transaction(async (tx) => {
    let inserted = 0;
    for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
      const batch = rows.slice(start, start + INSERT_BATCH_SIZE);
      const result = await tx
        .insert(songs)
        .values(batch)
        .onConflictDoNothing({ target: songs.id })
        .returning({ id: songs.id });
      inserted += result.length;
    }
    return inserted;
  });
