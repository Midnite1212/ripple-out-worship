import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GROUP_1,
  GROUP_3,
  GROUP_DELETED,
  MISSING_ID,
  OWNERSHIP_A,
  OWNERSHIP_B,
  OWNERSHIP_DUPLICATE,
  SETLIST_1,
  SETLIST_AMBIGUOUS,
  SETLIST_BACKFILL,
  SETLIST_DELETED,
  SONG_1,
  SONG_2,
  SONG_DELETED,
  SONG_INVALID,
  USER_A,
  USER_B,
  mongoExport,
} from '../../testing/mongoExport';
import { MongoExport, planImport } from './plan';

const plan = planImport(mongoExport());

const rowsOf = <T extends { id: string }>(rows: T[], id: string): T => {
  const row = rows.find((candidate) => candidate.id === id);
  assert.ok(row, `row ${id}`);
  return row;
};

const emptyExport = (fields: Partial<MongoExport> = {}): MongoExport => ({
  songs: [],
  setlists: [],
  groups: [],
  ownerships: [],
  ...fields,
});

describe('planImport', () => {
  it('counts the documents read per collection', () => {
    assert.deepEqual(plan.read, { songs: 5, setlists: 4, groups: 3, ownerships: 3 });
  });

  describe('documents', () => {
    it('maps every song field and keeps the stored timestamps', () => {
      assert.deepEqual(rowsOf(plan.rows.songs, SONG_1), {
        id: SONG_1,
        title: 'Fixture Song One',
        tempo: ['Slow'],
        originalKey: 'G',
        recommendedKeys: ['A', 'Bb'],
        themes: ['Hope', 'Grace'],
        artist: 'Fixture Artist',
        year: '1999',
        code: 'F1',
        createdBy: USER_A,
        lastUpdatedBy: null,
        timeSignature: ['3/4'],
        isVerified: true,
        chordLyrics: '[G]One',
        simplifiedChordLyrics: '[G]1',
        isDeleted: false,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
        updatedAt: new Date('2026-01-02T10:00:00.000Z'),
      });
    });

    it('lowercases ids, casts scalars like Mongoose, and falls back to the ObjectId time', () => {
      const song = rowsOf(plan.rows.songs, SONG_2);
      const objectIdTime = new Date(0x65000000 * 1000);
      assert.deepEqual(song.tempo, ['Fast']);
      assert.equal(song.year, '2020');
      assert.deepEqual(song.recommendedKeys, []);
      assert.equal(song.isVerified, false);
      assert.equal(song.isDeleted, false);
      assert.deepEqual(song.createdAt, objectIdTime);
      assert.deepEqual(song.updatedAt, objectIdTime);
    });

    it('imports soft-deleted documents with isDeleted set', () => {
      const song = rowsOf(plan.rows.songs, SONG_DELETED);
      assert.equal(song.isDeleted, true);
      assert.deepEqual(song.createdAt, new Date('2026-01-03T10:00:00.000Z'));
      assert.equal(rowsOf(plan.rows.setlists, SETLIST_DELETED).isDeleted, true);
      assert.equal(rowsOf(plan.rows.groups, GROUP_DELETED).isDeleted, true);
    });

    it('maps setlists, folders, and ownerships', () => {
      assert.deepEqual(rowsOf(plan.rows.setlists, SETLIST_1), {
        id: SETLIST_1,
        name: 'Fixture Sunday',
        date: new Date('2026-02-01T00:00:00.000Z'),
        createdBy: USER_B,
        lastUpdatedBy: null,
        publicLink: `https://worship.example/setlist/view/${SETLIST_1}`,
        isDeleted: false,
        createdAt: new Date('2026-01-10T00:00:00.000Z'),
        updatedAt: new Date('2026-01-11T00:00:00.000Z'),
      });
      assert.equal(rowsOf(plan.rows.setlists, SETLIST_DELETED).date, null);
      assert.deepEqual(rowsOf(plan.rows.groups, GROUP_3), {
        id: GROUP_3,
        groupName: 'Fixture Ordered Folder',
        createdBy: USER_B,
        lastUpdatedBy: USER_A,
        isDeleted: false,
        createdAt: new Date('2026-01-24T00:00:00.000Z'),
        updatedAt: new Date('2026-01-25T00:00:00.000Z'),
      });
      assert.equal(rowsOf(plan.rows.ownerships, OWNERSHIP_A).accessType, 'admin');
      assert.equal(rowsOf(plan.rows.ownerships, OWNERSHIP_B).accessType, 'unsigned');
    });

    it('skips and reports documents with an invalid id, a missing required field, or a duplicate unique value', () => {
      assert.deepEqual(plan.invalidDocuments, [
        { collection: 'songs', index: 3, id: SONG_INVALID, reason: 'missing title' },
        { collection: 'songs', index: 4, id: null, reason: 'invalid _id' },
        { collection: 'ownerships', index: 2, id: OWNERSHIP_DUPLICATE, reason: 'duplicate userId' },
      ]);
      assert.deepEqual(
        plan.rows.songs.map(({ id }) => id),
        [SONG_1, SONG_2, SONG_DELETED]
      );
      assert.deepEqual(
        plan.rows.ownerships.map(({ id }) => id),
        [OWNERSHIP_A, OWNERSHIP_B]
      );
    });

    it('reports duplicate ids and publicLinks and rejects a file that is not an array', () => {
      const song = {
        _id: { $oid: SONG_1 },
        title: 'T',
        originalKey: 'C',
        artist: 'A',
        chordLyrics: 'x',
      };
      const setlist = (id: string) => ({ _id: { $oid: id }, name: 'S', publicLink: 'same' });
      const result = planImport(
        emptyExport({
          songs: [song, song],
          setlists: [setlist(SETLIST_1), setlist(SETLIST_BACKFILL)],
        })
      );
      assert.deepEqual(
        result.invalidDocuments.map(({ collection, index, reason }) => [collection, index, reason]),
        [
          ['songs', 1, 'duplicate _id'],
          ['setlists', 1, 'duplicate publicLink'],
        ]
      );
      assert.throws(() => planImport(emptyExport({ songs: {} })), /songs: expected a JSON array/);
    });

    it('reports a field with an unsupported type instead of guessing', () => {
      const result = planImport(
        emptyExport({
          songs: [
            {
              _id: { $oid: SONG_1 },
              title: { nested: true },
              originalKey: 'C',
              artist: 'A',
              chordLyrics: 'x',
            },
          ],
        })
      );
      assert.deepEqual(result.invalidDocuments, [
        { collection: 'songs', index: 0, id: SONG_1, reason: 'invalid title' },
      ]);
    });
  });

  describe('links', () => {
    it('keeps setlist song order and duplicates, and skips missing or invalid songs', () => {
      assert.deepEqual(
        plan.rows.setlist_songs.filter(({ setlistId }) => setlistId === SETLIST_1),
        [
          { setlistId: SETLIST_1, position: 0, songId: SONG_2 },
          { setlistId: SETLIST_1, position: 1, songId: SONG_1 },
          { setlistId: SETLIST_1, position: 2, songId: SONG_DELETED },
          { setlistId: SETLIST_1, position: 3, songId: SONG_2 },
        ]
      );
    });

    it('keeps the last key per song in last-occurrence order and skips invalid keys', () => {
      assert.deepEqual(plan.rows.setlist_song_keys, [
        { setlistId: SETLIST_1, songId: SONG_1, key: 'A', position: 0 },
        { setlistId: SETLIST_1, songId: SONG_2, key: 'D', position: 1 },
      ]);
    });

    it('unions folder.setlistIds and setlist.groupIds with the folder order first', () => {
      assert.deepEqual(plan.rows.group_setlists, [
        { groupId: GROUP_1, setlistId: SETLIST_1, position: 0 },
        { groupId: GROUP_1, setlistId: SETLIST_DELETED, position: 1 },
        { groupId: GROUP_3, setlistId: SETLIST_BACKFILL, position: 0 },
        { groupId: GROUP_3, setlistId: SETLIST_1, position: 1 },
      ]);
    });

    it('reports every skipped link by table and reason with ids only', () => {
      assert.deepEqual(plan.skippedLinks, [
        { table: 'ownership_setlists', reason: 'invalid entry', fromId: OWNERSHIP_A, toId: null },
        { table: 'setlist_songs', reason: 'missing document', fromId: SETLIST_1, toId: MISSING_ID },
        { table: 'setlist_songs', reason: 'invalid id', fromId: SETLIST_1, toId: null },
        { table: 'setlist_song_keys', reason: 'invalid key', fromId: SETLIST_1, toId: SONG_1 },
        {
          table: 'setlist_song_keys',
          reason: 'missing document',
          fromId: SETLIST_1,
          toId: MISSING_ID,
        },
        { table: 'group_setlists', reason: 'missing document', fromId: GROUP_1, toId: MISSING_ID },
        {
          table: 'group_setlists',
          reason: 'soft-deleted folder',
          fromId: GROUP_DELETED,
          toId: SETLIST_BACKFILL,
        },
        {
          table: 'group_setlists',
          reason: 'missing document',
          fromId: SETLIST_1,
          toId: MISSING_ID,
        },
        {
          table: 'group_setlists',
          reason: 'soft-deleted folder',
          fromId: SETLIST_BACKFILL,
          toId: GROUP_DELETED,
        },
      ]);
    });

    it('keeps ownership entries in order with their stored strings and no foreign key check', () => {
      assert.deepEqual(plan.rows.ownership_groups, [
        {
          ownershipId: OWNERSHIP_A,
          position: 0,
          groupId: GROUP_1,
          entryName: 'Fixture Folder',
          entryCreatedAt: '2026-01-05T00:00:00.000Z',
        },
      ]);
      assert.deepEqual(
        plan.rows.ownership_setlists.map(({ ownershipId, position, setlistId, entryName }) => [
          ownershipId,
          position,
          setlistId,
          entryName,
        ]),
        [
          [OWNERSHIP_A, 0, SETLIST_BACKFILL, 'Fixture Backfill'],
          [OWNERSHIP_A, 1, SETLIST_AMBIGUOUS, 'Fixture Ambiguous'],
          [OWNERSHIP_A, 2, MISSING_ID, null],
          [OWNERSHIP_B, 0, SETLIST_AMBIGUOUS, 'Fixture Ambiguous'],
        ]
      );
    });
  });

  describe('legacy backfill', () => {
    it('fills createdBy from the only live ownership holding the setlist or folder', () => {
      assert.equal(rowsOf(plan.rows.setlists, SETLIST_BACKFILL).createdBy, USER_A);
      assert.equal(rowsOf(plan.rows.groups, GROUP_1).createdBy, USER_A);
      assert.deepEqual(plan.backfill, {
        setlists: 1,
        groups: 1,
        ambiguous: { setlists: [SETLIST_AMBIGUOUS], groups: [] },
      });
    });

    it('leaves ambiguous and soft-deleted documents without a creator', () => {
      assert.equal(rowsOf(plan.rows.setlists, SETLIST_AMBIGUOUS).createdBy, null);
      assert.equal(rowsOf(plan.rows.setlists, SETLIST_DELETED).createdBy, null);
    });
  });

  it('counts unknown fields by name per collection, ignoring __v', () => {
    assert.deepEqual(plan.unknownFields, {
      songs: { legacyRating: 2 },
      setlists: { 'songKeys[]._id': 1 },
      groups: {},
      ownerships: { 'setlistIds[].shared': 1 },
    });
  });

  it('returns empty rows for an empty export', () => {
    const result = planImport(emptyExport());
    assert.ok(Object.values(result.rows).every((rows) => rows.length === 0));
  });
});
