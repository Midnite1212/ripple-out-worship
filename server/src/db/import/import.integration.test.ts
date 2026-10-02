import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { lockTestDatabase } from '../../testing/databaseLock';
import {
  GROUP_1,
  GROUP_3,
  MISSING_ID,
  OWNERSHIP_A,
  SETLIST_1,
  SETLIST_AMBIGUOUS,
  SETLIST_BACKFILL,
  SETLIST_DELETED,
  SONG_1,
  SONG_2,
  SONG_DELETED,
  USER_A,
  USER_B,
  mongoExport,
} from '../../testing/mongoExport';
import { closeDatabase, getDb } from '../connect';
import { groupRepository } from '../repositories/group.repository';
import { ownershipRepository } from '../repositories/ownership.repository';
import { setlistRepository } from '../repositories/setlist.repository';
import { songRepository } from '../repositories/song.repository';
import { ImportRefusedError, applyImport, countTargetRows, plannedCounts } from './apply';
import { planImport } from './plan';

const TEST_DATABASE_URL = process.env.DATABASE_URL_TEST;

const json = (value: unknown) => JSON.parse(JSON.stringify(value));

const PUBLIC_SONG_1_RECORD = {
  _id: SONG_1,
  title: 'Fixture Song One',
  tempo: ['Slow'],
  originalKey: 'G',
  themes: ['Hope', 'Grace'],
  artist: 'Fixture Artist',
  year: '1999',
  code: 'F1',
  timeSignature: ['3/4'],
  isVerified: true,
  simplifiedChordLyrics: '[G]1',
  isDeleted: false,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  recommendedKeys: ['A', 'Bb'],
  chordLyrics: '[G]One',
};

const SONG_1_RECORD = { ...PUBLIC_SONG_1_RECORD, createdBy: USER_A };

const SONG_2_RECORD = {
  _id: SONG_2,
  title: 'Fixture Song Two',
  tempo: ['Fast'],
  originalKey: 'C',
  themes: [],
  artist: 'Fixture Artist',
  year: '2020',
  timeSignature: [],
  isVerified: false,
  isDeleted: false,
  createdAt: new Date(0x65000000 * 1000).toISOString(),
  updatedAt: new Date(0x65000000 * 1000).toISOString(),
  recommendedKeys: [],
  chordLyrics: '[C]Two',
};

const SONG_DELETED_RECORD = {
  _id: SONG_DELETED,
  title: 'Fixture Song Deleted',
  tempo: [],
  originalKey: 'D',
  themes: ['Hope'],
  artist: 'Fixture Artist',
  timeSignature: [],
  isVerified: false,
  isDeleted: true,
  createdAt: '2026-01-03T10:00:00.000Z',
  updatedAt: '2026-01-04T10:00:00.000Z',
  recommendedKeys: [],
  chordLyrics: '[D]Gone',
};

const entry = (id: string, name: string) => ({ id, name, createdAt: '2026-01-05T00:00:00.000Z' });

describe(
  'MongoDB export import',
  { skip: TEST_DATABASE_URL ? false : 'DATABASE_URL_TEST is not set' },
  () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const plan = planImport(mongoExport());
    let unlock: (() => Promise<void>) | undefined;

    before(async () => {
      unlock = await lockTestDatabase(TEST_DATABASE_URL ?? '');
      process.env.DATABASE_URL = TEST_DATABASE_URL;
      await migrate(getDb(), { migrationsFolder: path.join(__dirname, '../../../drizzle') });
      await getDb().execute(
        sql`truncate songs, setlists, setlist_songs, setlist_song_keys, groups, group_setlists, ownerships, ownership_setlists, ownership_groups`
      );
      const { decision } = await applyImport(getDb(), plan, { replace: false });
      assert.deepEqual(decision, { action: 'insert' });
    });

    after(async () => {
      await closeDatabase();
      await unlock?.();
      process.env.DATABASE_URL = originalDatabaseUrl;
    });

    it('writes exactly the planned rows', async () => {
      assert.deepEqual(await countTargetRows(getDb()), plannedCounts(plan));
    });

    it('reads songs back in the API shape, hiding soft-deleted ones', async () => {
      assert.deepEqual(json(await songRepository.findLiveById(SONG_1)), SONG_1_RECORD);
      assert.deepEqual(json(await songRepository.findLiveById(SONG_2)), SONG_2_RECORD);
      assert.equal(await songRepository.findLiveById(SONG_DELETED), null);
    });

    it('reads a setlist with its ordered songs, keys, and folder links', async () => {
      assert.deepEqual(json(await setlistRepository.findLiveById(SETLIST_1, 'full')), {
        _id: SETLIST_1,
        name: 'Fixture Sunday',
        date: '2026-02-01T00:00:00.000Z',
        createdBy: USER_B,
        songs: [SONG_2_RECORD, SONG_1_RECORD, SONG_DELETED_RECORD, SONG_2_RECORD],
        songKeys: [
          { songId: SONG_1, key: 'A' },
          { songId: SONG_2, key: 'D' },
        ],
        publicLink: `https://worship.example/setlist/view/${SETLIST_1}`,
        groupIds: [GROUP_1, GROUP_3],
        isDeleted: false,
        createdAt: '2026-01-10T00:00:00.000Z',
        updatedAt: '2026-01-11T00:00:00.000Z',
      });
    });

    it('reads the public view of a backfilled setlist without member fields', async () => {
      assert.deepEqual(json(await setlistRepository.findLiveById(SETLIST_BACKFILL, 'public')), {
        _id: SETLIST_BACKFILL,
        name: 'Fixture Backfill',
        date: null,
        songs: [PUBLIC_SONG_1_RECORD],
        songKeys: [],
        publicLink: null,
        isDeleted: false,
        createdAt: '2026-01-12T00:00:00.000Z',
        updatedAt: '2026-01-12T00:00:00.000Z',
      });
      const access = await setlistRepository.findLiveAccess(SETLIST_BACKFILL);
      assert.deepEqual(access, {
        _id: SETLIST_BACKFILL,
        createdBy: USER_A,
        groupIds: [GROUP_3],
        songs: [SONG_1],
      });
      assert.equal(await setlistRepository.findLiveById(SETLIST_DELETED, 'full'), null);
    });

    it('reads folders with the unioned setlist order and the backfilled creator', async () => {
      assert.deepEqual(json(await groupRepository.findLiveById(GROUP_1)), {
        _id: GROUP_1,
        groupName: 'Fixture Folder',
        setlistIds: [SETLIST_1, SETLIST_DELETED],
        createdBy: USER_A,
        isDeleted: false,
        createdAt: '2026-01-20T00:00:00.000Z',
        updatedAt: '2026-01-21T00:00:00.000Z',
      });
      assert.deepEqual(json(await groupRepository.findLiveById(GROUP_3)), {
        _id: GROUP_3,
        groupName: 'Fixture Ordered Folder',
        setlistIds: [SETLIST_BACKFILL, SETLIST_1],
        createdBy: USER_B,
        lastUpdatedBy: USER_A,
        isDeleted: false,
        createdAt: '2026-01-24T00:00:00.000Z',
        updatedAt: '2026-01-25T00:00:00.000Z',
      });
    });

    it('reads ownerships with their entries as stored', async () => {
      assert.deepEqual(json(await ownershipRepository.findLiveByUserId(USER_A)), {
        _id: OWNERSHIP_A,
        userId: USER_A,
        fullName: 'Fixture Owner A',
        accessType: 'admin',
        groupIds: [entry(GROUP_1, 'Fixture Folder')],
        setlistIds: [
          entry(SETLIST_BACKFILL, 'Fixture Backfill'),
          entry(SETLIST_AMBIGUOUS, 'Fixture Ambiguous'),
          { id: MISSING_ID },
        ],
        isDeleted: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-30T00:00:00.000Z',
      });
    });

    it('lists what a member can reach through the imported links', async () => {
      const reachable = await setlistRepository.listLiveReachable({
        setlistIds: [SETLIST_AMBIGUOUS],
        groupIds: [GROUP_1],
        createdBy: USER_A,
      });
      assert.deepEqual(
        reachable.map(({ _id }) => _id),
        [SETLIST_1, SETLIST_BACKFILL, SETLIST_AMBIGUOUS]
      );
    });

    it('refuses a second import and leaves the rows untouched', async () => {
      await assert.rejects(applyImport(getDb(), plan, { replace: false }), ImportRefusedError);
      assert.deepEqual(await countTargetRows(getDb()), plannedCounts(plan));
    });

    it('replaces the rows with --replace without duplicating them', async () => {
      await setlistRepository.updateLive(SETLIST_1, { name: 'Edited after import' });
      const { decision, written } = await applyImport(getDb(), plan, { replace: true });
      assert.equal(decision.action, 'replace');
      assert.deepEqual(written, plannedCounts(plan));
      const setlist = await setlistRepository.findLiveById(SETLIST_1, 'full');
      assert.equal(setlist?.name, 'Fixture Sunday');
    });
  }
);
