import { MongoExport } from '../db/import/plan';

export const USER_A = '64b000000000000000000a01';
export const USER_B = '64b000000000000000000a02';
export const SONG_1 = '64c000000000000000000001';
export const SONG_2 = '65000000000000000000000a';
export const SONG_DELETED = '64c000000000000000000003';
export const SONG_INVALID = '64c000000000000000000004';
export const SETLIST_1 = '64d000000000000000000001';
export const SETLIST_BACKFILL = '64d000000000000000000002';
export const SETLIST_DELETED = '64d000000000000000000003';
export const SETLIST_AMBIGUOUS = '64d000000000000000000004';
export const GROUP_1 = '64e000000000000000000001';
export const GROUP_DELETED = '64e000000000000000000002';
export const GROUP_3 = '64e000000000000000000003';
export const OWNERSHIP_A = '64f000000000000000000001';
export const OWNERSHIP_B = '64f000000000000000000002';
export const OWNERSHIP_DUPLICATE = '64f000000000000000000003';
export const MISSING_ID = '64b0000000000000000000ee';

const oid = (id: string) => ({ $oid: id });
const date = (iso: string) => ({ $date: iso });
const canonicalDate = (iso: string) => ({ $date: { $numberLong: String(Date.parse(iso)) } });
const entry = (id: string, name: string) => ({ id, name, createdAt: '2026-01-05T00:00:00.000Z' });

export const mongoExport = (): MongoExport => ({
  songs: [
    {
      _id: oid(SONG_1),
      title: 'Fixture Song One',
      tempo: ['Slow'],
      originalKey: 'G',
      recommendedKeys: ['A', 'Bb'],
      themes: ['Hope', 'Grace'],
      artist: 'Fixture Artist',
      year: '1999',
      code: 'F1',
      createdBy: oid(USER_A),
      timeSignature: ['3/4'],
      isVerified: true,
      chordLyrics: '[G]One',
      simplifiedChordLyrics: '[G]1',
      isDeleted: false,
      createdAt: date('2026-01-01T10:00:00.000Z'),
      updatedAt: date('2026-01-02T10:00:00.000Z'),
      __v: 0,
    },
    {
      _id: oid(SONG_2.toUpperCase()),
      title: 'Fixture Song Two',
      tempo: 'Fast',
      originalKey: 'C',
      themes: [],
      artist: 'Fixture Artist',
      year: { $numberInt: '2020' },
      chordLyrics: '[C]Two',
      legacyRating: 5,
    },
    {
      _id: oid(SONG_DELETED),
      title: 'Fixture Song Deleted',
      originalKey: 'D',
      themes: ['Hope'],
      artist: 'Fixture Artist',
      chordLyrics: '[D]Gone',
      isDeleted: true,
      createdAt: canonicalDate('2026-01-03T10:00:00.000Z'),
      updatedAt: canonicalDate('2026-01-04T10:00:00.000Z'),
      legacyRating: 2,
    },
    {
      _id: oid(SONG_INVALID),
      originalKey: 'E',
      artist: 'Fixture Artist',
      chordLyrics: '[E]No title',
    },
    { _id: 'not-an-object-id', title: 'Bad id', originalKey: 'C', artist: 'X', chordLyrics: 'x' },
  ],
  setlists: [
    {
      _id: oid(SETLIST_1),
      name: 'Fixture Sunday',
      date: date('2026-02-01T00:00:00.000Z'),
      createdBy: oid(USER_B),
      songs: [oid(SONG_2), oid(SONG_1), oid(MISSING_ID), oid(SONG_DELETED), 'abc', oid(SONG_2)],
      songKeys: [
        { songId: oid(SONG_2), key: 'Eb', _id: oid('64a000000000000000000001') },
        { songId: oid(SONG_1), key: 'H' },
        { songId: oid(MISSING_ID), key: 'C' },
        { songId: oid(SONG_1), key: 'A' },
        { songId: oid(SONG_2), key: 'D' },
      ],
      publicLink: `https://worship.example/setlist/view/${SETLIST_1}`,
      groupIds: [oid(GROUP_1), oid(MISSING_ID)],
      isDeleted: false,
      createdAt: date('2026-01-10T00:00:00.000Z'),
      updatedAt: date('2026-01-11T00:00:00.000Z'),
      __v: 3,
    },
    {
      _id: oid(SETLIST_BACKFILL),
      name: 'Fixture Backfill',
      songs: [oid(SONG_1)],
      groupIds: [oid(GROUP_DELETED)],
      publicLink: null,
      isDeleted: false,
      createdAt: date('2026-01-12T00:00:00.000Z'),
      updatedAt: date('2026-01-12T00:00:00.000Z'),
    },
    {
      _id: oid(SETLIST_DELETED),
      name: 'Fixture Deleted',
      date: null,
      songs: [],
      groupIds: [oid(GROUP_1)],
      isDeleted: true,
      createdAt: date('2026-01-13T00:00:00.000Z'),
      updatedAt: date('2026-01-14T00:00:00.000Z'),
    },
    {
      _id: oid(SETLIST_AMBIGUOUS),
      name: 'Fixture Ambiguous',
      songs: [],
      isDeleted: false,
      createdAt: date('2026-01-15T00:00:00.000Z'),
      updatedAt: date('2026-01-15T00:00:00.000Z'),
    },
  ],
  groups: [
    {
      _id: oid(GROUP_1),
      groupName: 'Fixture Folder',
      setlistIds: [oid(SETLIST_1), oid(MISSING_ID)],
      isDeleted: false,
      createdAt: date('2026-01-20T00:00:00.000Z'),
      updatedAt: date('2026-01-21T00:00:00.000Z'),
    },
    {
      _id: oid(GROUP_DELETED),
      groupName: 'Fixture Deleted Folder',
      setlistIds: [oid(SETLIST_BACKFILL)],
      createdBy: oid(USER_A),
      isDeleted: true,
      createdAt: date('2026-01-22T00:00:00.000Z'),
      updatedAt: date('2026-01-23T00:00:00.000Z'),
    },
    {
      _id: oid(GROUP_3),
      groupName: 'Fixture Ordered Folder',
      setlistIds: [oid(SETLIST_BACKFILL), oid(SETLIST_1)],
      createdBy: oid(USER_B),
      lastUpdatedBy: oid(USER_A),
      isDeleted: false,
      createdAt: date('2026-01-24T00:00:00.000Z'),
      updatedAt: date('2026-01-25T00:00:00.000Z'),
    },
  ],
  ownerships: [
    {
      _id: oid(OWNERSHIP_A),
      userId: USER_A,
      fullName: 'Fixture Owner A',
      accessType: 'admin',
      groupIds: [entry(GROUP_1, 'Fixture Folder')],
      setlistIds: [
        entry(SETLIST_BACKFILL, 'Fixture Backfill'),
        entry(SETLIST_AMBIGUOUS, 'Fixture Ambiguous'),
        'not-an-entry',
        { id: MISSING_ID },
      ],
      isDeleted: false,
      createdAt: date('2026-01-01T00:00:00.000Z'),
      updatedAt: date('2026-01-30T00:00:00.000Z'),
      __v: 7,
    },
    {
      _id: oid(OWNERSHIP_B),
      userId: USER_B,
      fullName: 'Fixture Owner B',
      groupIds: [],
      setlistIds: [{ ...entry(SETLIST_AMBIGUOUS, 'Fixture Ambiguous'), shared: true }],
      createdAt: date('2026-01-02T00:00:00.000Z'),
      updatedAt: date('2026-01-31T00:00:00.000Z'),
    },
    {
      _id: oid(OWNERSHIP_DUPLICATE),
      userId: USER_A,
      fullName: 'Fixture Owner Duplicate',
      groupIds: [],
      setlistIds: [],
    },
  ],
});
