import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import {
  createGroup,
  deleteGroup,
  getGroup,
  updateGroup,
  updateGroupMembers,
} from '../controllers/group.controllers';
import {
  createOwnership,
  getOwnership,
  updateOwnership,
} from '../controllers/ownership.controllers';
import {
  createSetlist,
  deleteSetlist,
  getSetlist,
  updateSetlist,
} from '../controllers/setlist.controllers';
import { createSong, deleteSong, searchSongs, updateSong } from '../controllers/song.controllers';
import { FakeRequestInit, callHandler, createRequest, createResponse } from '../testing/http';
import { TokenUser } from '../utils/verify-jwt';
import { closeDatabase, getDb } from './connect';
import { insertSongs, mapSongDocuments } from './importSongs';
import { songRepository } from './repositories/song.repository';

const TEST_DATABASE_URL = process.env.DATABASE_URL_TEST;

const ADMIN: TokenUser = { accessType: 'admin', id: '64b000000000000000000001' };
const MEMBER: TokenUser = { accessType: 'ministry', id: '64b000000000000000000002' };
const OUTSIDER: TokenUser = { accessType: 'ministry', id: '64b000000000000000000003' };
const MISSING_ID = '64b0000000000000000000ee';
const FORBIDDEN = { error: 'Access denied', message: 'Forbidden' };

type Body = Record<string, unknown>;

const call = async (handler: Parameters<typeof callHandler>[0], init: FakeRequestInit) => {
  const res = createResponse();
  await callHandler(handler, createRequest({ host: 'localhost', ...init }), res);
  return { status: res.statusCode, body: JSON.parse(JSON.stringify(res.body ?? null)) };
};

const ok = async (handler: Parameters<typeof callHandler>[0], init: FakeRequestInit) => {
  const res = await call(handler, init);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
};

const song = (title: string, fields: Body = {}): Body => ({
  artist: 'Test Artist',
  chordLyrics: '[C]La',
  originalKey: 'C',
  themes: ['Hope'],
  title,
  ...fields,
});

const ownershipOf = (user: TokenUser) =>
  ok(getOwnership, { query: { userId: user.id }, user: ADMIN });

const listIds = async (user: TokenUser): Promise<string[]> =>
  (await ok(getSetlist, { user })).map((setlist: Body) => setlist._id);

describe(
  'Postgres integration',
  { skip: TEST_DATABASE_URL ? false : 'DATABASE_URL_TEST is not set' },
  () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalBaseUrl = process.env.BASE_URL;

    before(async () => {
      process.env.DATABASE_URL = TEST_DATABASE_URL;
      process.env.BASE_URL = 'https://worship.example';
      await migrate(getDb(), { migrationsFolder: path.join(__dirname, '../../drizzle') });
    });

    beforeEach(async () => {
      mock.restoreAll();
      mock.method(console, 'error', () => undefined);
      await getDb().execute(
        sql`truncate songs, setlists, setlist_songs, setlist_song_keys, groups, group_setlists, ownerships, ownership_setlists, ownership_groups`
      );
      for (const [user, fullName] of [
        [ADMIN, 'Harness Admin'],
        [MEMBER, 'Harness Member'],
        [OUTSIDER, 'Harness Outsider'],
      ] as const) {
        await ok(createOwnership, { body: { fullName }, user });
      }
    });

    after(async () => {
      await closeDatabase();
      process.env.DATABASE_URL = originalDatabaseUrl;
      if (originalBaseUrl === undefined) delete process.env.BASE_URL;
      else process.env.BASE_URL = originalBaseUrl;
    });

    describe('songs', () => {
      it('creates with Mongoose-style casting and omits absent optional fields', async () => {
        const created = await ok(createSong, {
          body: { ...song('Cast'), tempo: 'Fast', title: 123, year: 2020 },
          user: ADMIN,
        });
        assert.match(created._id, /^[0-9a-f]{24}$/);
        assert.deepEqual(Object.keys(created).sort(), [
          '_id',
          'artist',
          'chordLyrics',
          'createdAt',
          'isDeleted',
          'isVerified',
          'originalKey',
          'recommendedKeys',
          'tempo',
          'themes',
          'timeSignature',
          'title',
          'updatedAt',
          'year',
        ]);
        assert.equal(created.title, '123');
        assert.deepEqual(created.tempo, ['Fast']);
        assert.equal(created.year, '2020');
        assert.equal(created.createdAt, created.updatedAt);
      });

      it('rejects missing or empty required fields and invalid values with 400', async () => {
        for (const body of [
          { title: 'Only title' },
          song(''),
          song('x', { themes: [''] }),
          song('x', { artist: { a: 1 } }),
        ]) {
          const res = await call(createSong, { body, user: ADMIN });
          assert.equal(res.status, 400, JSON.stringify(body));
          assert.equal(res.body, 'Invalid request');
        }
      });

      it('updates, soft-deletes, and hides deleted songs', async () => {
        const created = await ok(createSong, { body: song('Before'), user: ADMIN });
        const updated = await ok(updateSong, {
          body: { code: 'B1', id: created._id.toUpperCase(), title: 'After' },
          user: ADMIN,
        });
        assert.equal(updated.title, 'After');
        assert.equal(updated.code, 'B1');
        assert.ok(updated.updatedAt >= created.updatedAt);
        assert.equal(
          (await call(updateSong, { body: { id: created._id, title: '' }, user: ADMIN })).status,
          400
        );
        assert.equal(
          await ok(deleteSong, { body: { id: created._id }, user: ADMIN }),
          'Song successfully deleted'
        );
        assert.equal(
          (await call(deleteSong, { body: { id: created._id }, user: ADMIN })).status,
          404
        );
        assert.equal(await songRepository.findLiveById(created._id), null);
        assert.deepEqual(await songRepository.listLive(), []);
      });

      it('searches case-insensitively with literal wildcards, filters, sorting, and paging', async () => {
        for (const [title, fields] of [
          ['amazing love', { code: 'b2', tempo: ['Slow'] }],
          ['Amazing Grace', { code: 'A1', tempo: ['Fast'] }],
          ['100% Yours', { themes: ['Joy'] }],
          ['Under_score', { code: 'C3', themes: ['Joy', 'Hope'] }],
          ['Undersc0re', { code: 'c4' }],
        ] as const) {
          await ok(createSong, { body: song(title, fields), user: ADMIN });
        }
        const deleted = await ok(createSong, { body: song('Amazing Deleted'), user: ADMIN });
        await ok(deleteSong, { body: { id: deleted._id }, user: ADMIN });

        const titles = async (query: Body) =>
          (await ok(searchSongs, { query })).data.map((found: Body) => found.title);

        assert.deepEqual(await titles({ keyword: 'AMAZ' }), ['Amazing Grace', 'amazing love']);
        assert.deepEqual(await titles({ keyword: '%' }), ['100% Yours']);
        assert.deepEqual(await titles({ keyword: '_' }), ['Under_score']);
        assert.deepEqual(await titles({ code: 'C' }), ['Under_score', 'Undersc0re']);
        assert.deepEqual(await titles({ code: 'a1', keyword: 'love' }), [
          'Amazing Grace',
          'amazing love',
        ]);
        assert.deepEqual(await titles({ tempo: ['Fast', 'Slow'] }), [
          'Amazing Grace',
          'amazing love',
        ]);
        assert.deepEqual(await titles({ themes: 'Joy' }), ['100% Yours', 'Under_score']);
        assert.deepEqual(await titles({ sortBy: 'code' }), [
          '100% Yours',
          'Amazing Grace',
          'Under_score',
          'amazing love',
          'Undersc0re',
        ]);

        const page = await ok(searchSongs, { query: { limit: '2', page: '2' } });
        assert.deepEqual(
          page.data.map((found: Body) => found.title),
          ['Under_score', 'Undersc0re']
        );
        assert.deepEqual(
          {
            currentPage: page.currentPage,
            totalCount: page.totalCount,
            totalPages: page.totalPages,
          },
          { currentPage: 2, totalCount: 5, totalPages: 3 }
        );
      });
    });

    describe('setlists', () => {
      it('creates with ordered songs and filtered keys, and reads populated full and public views', async () => {
        const a = await ok(createSong, { body: song('A'), user: ADMIN });
        const b = await ok(createSong, { body: song('B'), user: ADMIN });
        const created = await ok(createSetlist, {
          body: {
            date: '2026-10-04T00:00:00.000Z',
            name: 'Sunday',
            songKeys: [
              { key: 'D', songId: b._id },
              { key: 'E', songId: MISSING_ID },
              { key: 'Bb', songId: b._id },
            ],
            songs: [b._id, a._id, b._id],
          },
          user: MEMBER,
        });
        assert.deepEqual(created.songs, [b._id, a._id, b._id]);
        assert.deepEqual(created.songKeys, [{ key: 'Bb', songId: b._id }]);
        assert.equal(created.publicLink, `https://worship.example/setlist/view/${created._id}`);
        assert.equal(created.createdBy, MEMBER.id);
        assert.equal(created.date, '2026-10-04T00:00:00.000Z');
        assert.deepEqual(created.groupIds, []);

        await ok(deleteSong, { body: { id: a._id }, user: ADMIN });
        const full = await ok(getSetlist, { query: { id: created._id }, user: OUTSIDER });
        assert.deepEqual(
          full.songs.map((found: Body) => found.title),
          ['B', 'A', 'B']
        );
        assert.equal(full.createdBy, MEMBER.id);

        const anonymous = await ok(getSetlist, { query: { id: created._id } });
        assert.deepEqual(Object.keys(anonymous).sort(), [
          '_id',
          'createdAt',
          'date',
          'isDeleted',
          'name',
          'publicLink',
          'songKeys',
          'songs',
          'updatedAt',
        ]);
        assert.equal(anonymous.songs.length, 3);

        const many = await ok(getSetlist, { query: { id: [created._id, MISSING_ID] } });
        assert.deepEqual(
          many.map((found: Body) => found._id),
          [created._id]
        );
      });

      it('replaces songs and keys on update, keeping stale keys when only songs change', async () => {
        const a = await ok(createSong, { body: song('A'), user: ADMIN });
        const b = await ok(createSong, { body: song('B'), user: ADMIN });
        const created = await ok(createSetlist, {
          body: { name: 'Sunday', songKeys: [{ key: 'D', songId: a._id }], songs: [a._id] },
          user: MEMBER,
        });
        const reordered = await ok(updateSetlist, {
          body: { id: created._id, songs: [b._id, a._id] },
          user: MEMBER,
        });
        assert.deepEqual(reordered.songs, [b._id, a._id]);
        assert.deepEqual(reordered.songKeys, [{ key: 'D', songId: a._id }]);
        const rekeyed = await ok(updateSetlist, {
          body: {
            date: null,
            id: created._id,
            name: 'Renamed',
            songKeys: [{ key: 'G', songId: b._id }],
          },
          user: MEMBER,
        });
        assert.deepEqual(rekeyed.songKeys, [{ key: 'G', songId: b._id }]);
        assert.equal(rekeyed.name, 'Renamed');
        assert.equal(rekeyed.date, null);
      });

      it('rejects unknown song ids and bad dates with 400 and writes nothing', async () => {
        for (const body of [
          { name: 'Ghost', songs: [MISSING_ID] },
          { date: 'nope', name: 'Bad date' },
        ]) {
          const res = await call(createSetlist, { body, user: MEMBER });
          assert.equal(res.status, 400, JSON.stringify(body));
          assert.equal(res.body, 'Invalid request');
        }
        assert.deepEqual(await listIds(ADMIN), []);
      });

      it('lets only the creator or an admin delete, and hides deleted setlists', async () => {
        const created = await ok(createSetlist, { body: { name: 'Sunday' }, user: MEMBER });
        assert.equal(
          (await call(deleteSetlist, { body: { id: created._id }, user: OUTSIDER })).status,
          403
        );
        assert.equal(
          await ok(deleteSetlist, { body: { params: { id: created._id } }, user: MEMBER }),
          'Setlist deleted'
        );
        assert.equal((await call(getSetlist, { query: { id: created._id } })).status, 404);
        assert.deepEqual(await listIds(ADMIN), []);
      });
    });

    describe('folders and membership', () => {
      it('shares a setlist through a folder, adds and removes members idempotently, and cascades on delete', async () => {
        const setlist = await ok(createSetlist, { body: { name: 'Admin Sunday' }, user: ADMIN });
        const folder = await ok(createGroup, { body: { groupName: 'Team' }, user: ADMIN });
        assert.equal(folder.createdBy, ADMIN.id);
        assert.deepEqual(folder.setlistIds, []);

        const linked = await ok(updateSetlist, {
          body: { groupIds: [folder._id], id: setlist._id },
          user: ADMIN,
        });
        assert.deepEqual(linked.groupIds, [folder._id]);
        assert.deepEqual(
          (await ok(getGroup, { query: { id: folder._id }, user: ADMIN })).setlistIds,
          [setlist._id]
        );

        assert.deepEqual(
          (await call(updateSetlist, { body: { id: setlist._id, name: 'x' }, user: MEMBER })).body,
          FORBIDDEN
        );
        const add = { add: [MEMBER.id], groupId: folder._id };
        assert.deepEqual(await ok(updateGroupMembers, { body: add, user: ADMIN }), {
          added: 1,
          groupId: folder._id,
          removed: 0,
        });
        assert.equal((await ok(updateGroupMembers, { body: add, user: ADMIN })).added, 0);
        const entries = (await ownershipOf(MEMBER)).groupIds;
        assert.deepEqual(entries, [{ createdAt: folder.createdAt, id: folder._id, name: 'Team' }]);

        await ok(updateSetlist, { body: { id: setlist._id, name: 'Shared' }, user: MEMBER });
        assert.ok((await listIds(MEMBER)).includes(setlist._id));
        assert.equal(
          (await call(deleteSetlist, { body: { id: setlist._id }, user: MEMBER })).status,
          403
        );

        assert.deepEqual(
          await ok(updateGroupMembers, {
            body: { add: [OUTSIDER.id], groupId: folder._id, remove: [OUTSIDER.id, MISSING_ID] },
            user: MEMBER,
          }),
          { added: 1, groupId: folder._id, removed: 1 }
        );
        assert.deepEqual((await ownershipOf(OUTSIDER)).groupIds, []);
        assert.equal(
          (
            await call(updateGroupMembers, {
              body: { groupId: folder._id, remove: [MEMBER.id] },
              user: OUTSIDER,
            })
          ).status,
          403
        );
        assert.equal(
          (await call(deleteGroup, { body: { id: folder._id }, user: MEMBER })).status,
          403
        );

        assert.equal(
          await ok(deleteGroup, { body: { params: { id: folder._id } }, user: ADMIN }),
          'Group deleted'
        );
        assert.deepEqual((await ownershipOf(MEMBER)).groupIds, []);
        const after = await ok(getSetlist, { query: { id: setlist._id }, user: ADMIN });
        assert.deepEqual(after.groupIds, []);
        assert.equal(
          (await call(getGroup, { query: { id: folder._id }, user: ADMIN })).status,
          404
        );
        assert.equal(
          (await call(updateSetlist, { body: { id: setlist._id, name: 'x' }, user: MEMBER }))
            .status,
          403
        );
      });

      it('requires edit rights on each setlist a folder update newly adds', async () => {
        const folder = await ok(createGroup, { body: { groupName: 'Team' }, user: MEMBER });
        const outsiderSetlist = await ok(createSetlist, {
          body: { name: 'Private' },
          user: OUTSIDER,
        });
        const memberSetlist = await ok(createSetlist, { body: { name: 'Mine' }, user: MEMBER });

        const pull = await call(updateGroup, {
          body: { id: folder._id, setlistIds: [outsiderSetlist._id] },
          user: MEMBER,
        });
        assert.equal(pull.status, 403);
        assert.deepEqual(pull.body, FORBIDDEN);
        assert.equal(
          (
            await call(updateGroup, {
              body: { id: folder._id, setlistIds: [MISSING_ID] },
              user: MEMBER,
            })
          ).status,
          403
        );

        const updated = await ok(updateGroup, {
          body: { id: folder._id, setlistIds: [memberSetlist._id] },
          user: MEMBER,
        });
        assert.deepEqual(updated.setlistIds, [memberSetlist._id]);
        assert.deepEqual(
          (await ok(getSetlist, { query: { id: memberSetlist._id }, user: MEMBER })).groupIds,
          [folder._id]
        );

        const outsiderShared = await ok(updateGroup, {
          body: { id: folder._id, setlistIds: [outsiderSetlist._id, memberSetlist._id] },
          user: ADMIN,
        });
        assert.deepEqual(outsiderShared.setlistIds, [outsiderSetlist._id, memberSetlist._id]);
        await ok(updateGroupMembers, {
          body: { add: [MEMBER.id], groupId: folder._id },
          user: MEMBER,
        });
        await ok(updateSetlist, {
          body: { id: outsiderSetlist._id, name: 'Now shared' },
          user: MEMBER,
        });
        await ok(updateGroup, {
          body: { id: folder._id, setlistIds: [memberSetlist._id, outsiderSetlist._id] },
          user: MEMBER,
        });
        assert.deepEqual(
          (await ok(getGroup, { query: { id: folder._id }, user: MEMBER })).setlistIds,
          [memberSetlist._id, outsiderSetlist._id]
        );
      });

      it('links a setlist only to folders the caller can edit and keeps links it cannot change', async () => {
        const adminFolder = await ok(createGroup, {
          body: { groupName: 'Admin team' },
          user: ADMIN,
        });
        const memberFolder = await ok(createGroup, {
          body: { groupName: 'Member team' },
          user: MEMBER,
        });
        const setlist = await ok(createSetlist, {
          body: { groupIds: [memberFolder._id], name: 'Mine' },
          user: MEMBER,
        });
        assert.deepEqual(setlist.groupIds, [memberFolder._id]);
        assert.equal(
          (
            await call(createSetlist, {
              body: { groupIds: [adminFolder._id], name: 'x' },
              user: MEMBER,
            })
          ).status,
          403
        );

        await ok(updateSetlist, {
          body: { groupIds: [memberFolder._id, adminFolder._id], id: setlist._id },
          user: ADMIN,
        });
        const kept = await ok(updateSetlist, {
          body: { groupIds: [], id: setlist._id },
          user: MEMBER,
        });
        assert.deepEqual(kept.groupIds, [adminFolder._id]);
        assert.deepEqual(
          (await ok(getGroup, { query: { id: adminFolder._id }, user: ADMIN })).setlistIds,
          [setlist._id]
        );
        assert.deepEqual(
          (await ok(getGroup, { query: { id: memberFolder._id }, user: MEMBER })).setlistIds,
          []
        );
      });
    });

    describe('ownership', () => {
      it('creates once per user, keeping the original record and refreshing updatedAt', async () => {
        const first = await ownershipOf(MEMBER);
        const again = await ok(createOwnership, {
          body: { accessType: 'admin', fullName: 'Renamed', userId: OUTSIDER.id },
          user: MEMBER,
        });
        assert.equal(again._id, first._id);
        assert.equal(again.fullName, 'Harness Member');
        assert.equal(again.accessType, 'ministry');
        assert.ok(again.updatedAt >= first.updatedAt);
        assert.deepEqual(
          (await ok(getOwnership, { user: MEMBER })).map((summary: Body) =>
            Object.keys(summary).sort()
          ),
          Array(3).fill(['_id', 'fullName', 'groupIds', 'userId'])
        );
      });

      it('stores setlist entries verbatim and in order, allowing only editable additions on the own record', async () => {
        const mine = await ok(createSetlist, { body: { name: 'Mine' }, user: MEMBER });
        const other = await ok(createSetlist, { body: { name: 'Other' }, user: OUTSIDER });
        const ownership = await ownershipOf(MEMBER);
        const entries = [
          { id: mine._id, name: 'Mine' },
          { createdAt: mine.createdAt, id: mine._id, name: 'Mine again' },
        ];
        const updated = await ok(updateOwnership, {
          body: { ...ownership, setlistIds: entries },
          user: MEMBER,
        });
        assert.deepEqual(updated.setlistIds, entries);
        assert.deepEqual((await ownershipOf(MEMBER)).setlistIds, entries);

        const grab = await call(updateOwnership, {
          body: { _id: ownership._id, setlistIds: [...entries, { id: other._id }] },
          user: MEMBER,
        });
        assert.equal(grab.status, 403);
        assert.equal(
          (
            await call(updateOwnership, {
              body: { _id: ownership._id, setlistIds: [] },
              user: OUTSIDER,
            })
          ).status,
          403
        );
        assert.equal(
          (await call(updateOwnership, { body: { _id: MISSING_ID, setlistIds: [] }, user: MEMBER }))
            .status,
          404
        );
      });
    });

    describe('list filtering', () => {
      it('lists created, owned, and folder-reachable setlists for a user, and every live one for an admin', async () => {
        const created = await ok(createSetlist, { body: { name: 'Created' }, user: MEMBER });
        const owned = await ok(createSetlist, { body: { name: 'Owned' }, user: OUTSIDER });
        const shared = await ok(createSetlist, { body: { name: 'Shared' }, user: ADMIN });
        const hidden = await ok(createSetlist, { body: { name: 'Hidden' }, user: ADMIN });
        const removed = await ok(createSetlist, { body: { name: 'Removed' }, user: MEMBER });
        await ok(deleteSetlist, { body: { id: removed._id }, user: MEMBER });

        await ok(updateOwnership, {
          body: { _id: (await ownershipOf(OUTSIDER))._id, setlistIds: [{ id: owned._id }] },
          user: OUTSIDER,
        });
        await ok(updateOwnership, {
          body: { _id: (await ownershipOf(MEMBER))._id, setlistIds: [] },
          user: MEMBER,
        });
        const folder = await ok(createGroup, { body: { groupName: 'Team' }, user: ADMIN });
        await ok(updateGroup, { body: { id: folder._id, setlistIds: [shared._id] }, user: ADMIN });
        await ok(updateGroupMembers, {
          body: { add: [MEMBER.id], groupId: folder._id },
          user: ADMIN,
        });

        const sorted = (ids: string[]) => [...ids].sort();
        assert.deepEqual(sorted(await listIds(MEMBER)), sorted([created._id, shared._id]));
        assert.deepEqual(await listIds(OUTSIDER), [owned._id]);
        assert.deepEqual(
          sorted(await listIds(ADMIN)),
          sorted([created._id, owned._id, shared._id, hidden._id])
        );
        assert.equal((await call(getSetlist, {})).status, 401);
      });
    });

    describe('song import', () => {
      const ids = [
        '64b0000000000000000000c1',
        '64b0000000000000000000c2',
        '64b0000000000000000000c3',
      ];
      const exported = [
        {
          ...song('Imported', { code: 'I1', tempo: ['Fast'] }),
          _id: { $oid: ids[0] },
          createdAt: { $date: '2024-01-01T00:00:00Z' },
          createdBy: { $oid: ADMIN.id },
          updatedAt: { $date: { $numberLong: '1717200000000' } },
        },
        { ...song('No Dates'), _id: { $oid: ids[1] } },
        { ...song('Removed'), _id: { $oid: ids[2] }, isDeleted: true },
      ];

      it('imports exported songs readable through the repository, then re-runs as a no-op', async () => {
        const { rows, skipped } = mapSongDocuments(exported);
        assert.deepEqual(skipped, []);
        assert.equal(await insertSongs(rows), 3);

        const imported = await songRepository.findLiveById(ids[0]);
        assert.equal(imported?.code, 'I1');
        assert.equal(imported?.createdBy, ADMIN.id);
        assert.deepEqual(imported?.tempo, ['Fast']);
        assert.equal(imported?.createdAt.toISOString(), '2024-01-01T00:00:00.000Z');
        assert.equal(imported?.updatedAt.getTime(), 1717200000000);
        const undated = await songRepository.findLiveById(ids[1]);
        assert.equal(undated?.createdAt.getTime(), parseInt(ids[1].slice(0, 8), 16) * 1000);
        assert.equal(await songRepository.findLiveById(ids[2]), null);
        assert.deepEqual(
          (await songRepository.listLive()).map((record) => record._id),
          ids.slice(0, 2)
        );

        assert.equal(await insertSongs(rows), 0);
        assert.equal((await songRepository.listLive()).length, 2);
      });
    });
  }
);
