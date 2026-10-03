import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import { groupRepository } from '../db/repositories/group.repository';
import { CallerAccess, ownershipRepository } from '../db/repositories/ownership.repository';
import { setlistRepository } from '../db/repositories/setlist.repository';
import { MUSIC_KEYS } from '../db/schema';
import { FakeRequestInit, callHandler, createRequest, createResponse } from '../testing/http';
import { GroupAccess } from '../types/group.types';
import { SetlistAccess } from '../types/setlist.types';
import { TokenUser } from '../utils/verify-jwt';
import {
  createSetlist,
  deleteSetlist,
  getSetlist,
  keepSetlistSongKeys,
  parseSongKeys,
  resolveGroupLinks,
  updateSetlist,
} from './setlist.controllers';

const USER: TokenUser = { accessType: 'ministry', id: '507f1f77bcf86cd799439011' };
const ADMIN: TokenUser = { accessType: 'admin', id: '507f1f77bcf86cd799439019' };
const OTHER_USER_ID = '507f1f77bcf86cd799439012';
const SETLIST_ID = '507f1f77bcf86cd799439021';
const OTHER_SETLIST_ID = '507f1f77bcf86cd799439022';
const SONG_A = '507f1f77bcf86cd799439031';
const SONG_B = '507f1f77bcf86cd799439032';
const SONG_C = '507f1f77bcf86cd799439033';
const GROUP_ID = '507f1f77bcf86cd799439041';
const OTHER_GROUP_ID = '507f1f77bcf86cd799439042';
const FORBIDDEN = { error: 'Access denied', message: 'Forbidden' };
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

const call = async (handler: Parameters<typeof callHandler>[0], init: FakeRequestInit) => {
  const res = createResponse();
  await callHandler(handler, createRequest(init), res);
  return res;
};

const entry = (id: string) => ({ createdAt: '2026-01-01T00:00:00.000Z', id, name: 'Entry' });

const mockOwnership = (ownership: CallerAccess | null) =>
  mock.method(ownershipRepository, 'findCallerAccess', async () => ownership);

const storedSetlist = (fields: Partial<SetlistAccess>): SetlistAccess => ({
  _id: SETLIST_ID,
  groupIds: [],
  songs: [],
  ...fields,
});

const mockStored = (setlist: SetlistAccess | null) =>
  mock.method(setlistRepository, 'findLiveAccess', async () => setlist);

const folder = (id: string, createdBy?: string): GroupAccess => ({
  _id: id,
  createdAt: CREATED_AT,
  groupName: 'Team',
  ...(createdBy ? { createdBy } : {}),
});

const mockFolders = (...groups: GroupAccess[]) =>
  mock.method(groupRepository, 'findLiveAccessByIds', async (ids: string[]) =>
    groups.filter(({ _id }) => ids.includes(_id))
  );

describe('setlist songKeys helpers', () => {
  describe('parseSongKeys', () => {
    it('returns null for non-array input', () => {
      for (const value of [undefined, null, 'C', { songId: SONG_A, key: 'C' }, 1]) {
        assert.equal(parseSongKeys(value), null);
      }
    });

    it('returns an empty array for an empty array', () => {
      assert.deepEqual(parseSongKeys([]), []);
    });

    it('keeps only songId and key from each valid entry', () => {
      assert.deepEqual(
        parseSongKeys([
          { extra: true, key: 'C', songId: SONG_A },
          { key: 'F#', songId: SONG_B },
        ]),
        [
          { key: 'C', songId: SONG_A },
          { key: 'F#', songId: SONG_B },
        ]
      );
    });

    it('accepts every music key', () => {
      const parsed = parseSongKeys(MUSIC_KEYS.map((key) => ({ key, songId: SONG_A })));
      assert.equal(parsed?.length, MUSIC_KEYS.length);
    });

    it('rejects the whole list when any entry is invalid', () => {
      const valid = { key: 'C', songId: SONG_A };
      for (const invalid of [
        null,
        'C',
        { key: 'H', songId: SONG_A },
        { key: 'c', songId: SONG_A },
        { key: 'Cm', songId: SONG_A },
        { key: 'C' },
        { songId: SONG_A },
        { key: 'C', songId: 'bad' },
        { key: 'C', songId: { toString: () => SONG_A } },
      ]) {
        assert.equal(parseSongKeys([valid, invalid]), null, JSON.stringify(invalid));
      }
    });

    it('rejects a 12-character songId and accepts a 24-hex one', () => {
      assert.equal(parseSongKeys([{ key: 'C', songId: 'aaaaaaaaaaaa' }]), null);
      assert.deepEqual(parseSongKeys([{ key: 'C', songId: SONG_A.toUpperCase() }]), [
        { key: 'C', songId: SONG_A.toUpperCase() },
      ]);
    });
  });

  describe('keepSetlistSongKeys', () => {
    it('drops keys for songs that are not in the setlist', () => {
      assert.deepEqual(
        keepSetlistSongKeys(
          [
            { key: 'C', songId: SONG_A },
            { key: 'D', songId: SONG_C },
          ],
          [SONG_A, SONG_B]
        ),
        [{ key: 'C', songId: SONG_A }]
      );
    });

    it('keeps the last key per song in the position of its last entry', () => {
      assert.deepEqual(
        keepSetlistSongKeys(
          [
            { key: 'C', songId: SONG_A },
            { key: 'D', songId: SONG_B },
            { key: 'E', songId: SONG_A },
          ],
          [SONG_A, SONG_B]
        ),
        [
          { key: 'D', songId: SONG_B },
          { key: 'E', songId: SONG_A },
        ]
      );
    });

    it('matches song ids by their string form', () => {
      assert.deepEqual(
        keepSetlistSongKeys([{ key: 'G', songId: SONG_A }], [{ toString: () => SONG_A }]),
        [{ key: 'G', songId: SONG_A }]
      );
    });

    it('treats a single song id string as a one-song list', () => {
      assert.deepEqual(
        keepSetlistSongKeys(
          [
            { key: 'C', songId: SONG_A },
            { key: 'D', songId: SONG_B },
          ],
          SONG_A
        ),
        [{ key: 'C', songId: SONG_A }]
      );
    });

    it('drops every key when songIds is neither an array nor a string', () => {
      for (const songIds of [undefined, null, 1, { 0: SONG_A }]) {
        assert.deepEqual(keepSetlistSongKeys([{ key: 'C', songId: SONG_A }], songIds), []);
      }
    });
  });
});

describe('resolveGroupLinks', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('skips the lookup when the folder links are unchanged', async () => {
    const lookup = mockFolders();
    assert.deepEqual(await resolveGroupLinks(USER, null, [GROUP_ID], [GROUP_ID]), [GROUP_ID]);
    assert.equal(lookup.mock.callCount(), 0);
  });

  it('allows linking folders the caller created, is a member of, or any folder for an admin', async () => {
    mockFolders(folder(GROUP_ID, USER.id), folder(OTHER_GROUP_ID, OTHER_USER_ID));
    assert.deepEqual(await resolveGroupLinks(USER, null, [GROUP_ID], []), [GROUP_ID]);
    assert.deepEqual(
      await resolveGroupLinks(
        USER,
        { groupIds: [entry(OTHER_GROUP_ID)], setlistIds: [] },
        [OTHER_GROUP_ID],
        []
      ),
      [OTHER_GROUP_ID]
    );
    assert.deepEqual(await resolveGroupLinks(ADMIN, null, [OTHER_GROUP_ID], []), [OTHER_GROUP_ID]);
  });

  it('refuses to link a folder the caller cannot edit, or one that does not exist', async () => {
    mockFolders(folder(OTHER_GROUP_ID, OTHER_USER_ID));
    assert.equal(await resolveGroupLinks(USER, null, [OTHER_GROUP_ID], []), null);
    assert.equal(await resolveGroupLinks(ADMIN, null, [GROUP_ID], []), null);
  });

  it('keeps links to live folders the caller cannot edit and drops the rest', async () => {
    mockFolders(folder(GROUP_ID, USER.id), folder(OTHER_GROUP_ID, OTHER_USER_ID));
    const missingGroupId = '507f1f77bcf86cd799439043';
    assert.deepEqual(
      await resolveGroupLinks(USER, null, [], [GROUP_ID, OTHER_GROUP_ID, missingGroupId]),
      [OTHER_GROUP_ID]
    );
  });
});

describe('setlist controllers', () => {
  const originalBaseUrl = process.env.BASE_URL;

  before(() => {
    process.env.BASE_URL = 'https://worship.example';
  });

  after(() => {
    if (originalBaseUrl === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = originalBaseUrl;
  });

  beforeEach(() => {
    mock.method(console, 'error', () => undefined);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('createSetlist', () => {
    it('rejects a request without req.user', async () => {
      const create = mock.method(setlistRepository, 'create', async () => ({}));
      const res = await call(createSetlist, { body: { name: 'Sunday' } });
      assert.equal(res.statusCode, 401);
      assert.equal(res.body, 'Unauthorized');
      assert.equal(create.mock.callCount(), 0);
    });

    it('rejects a body with no allowed fields', async () => {
      const create = mock.method(setlistRepository, 'create', async () => ({}));
      for (const body of [undefined, {}, { createdBy: USER.id, publicLink: 'x' }]) {
        const res = await call(createSetlist, { body, user: USER });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(create.mock.callCount(), 0);
    });

    it('rejects invalid songKeys', async () => {
      const create = mock.method(setlistRepository, 'create', async () => ({}));
      for (const songKeys of [null, 'C', [{ key: 'H', songId: SONG_A }]]) {
        const res = await call(createSetlist, {
          body: { name: 'Sunday', songKeys, songs: [SONG_A] },
          user: USER,
        });
        assert.equal(res.statusCode, 400, JSON.stringify(songKeys));
        assert.equal(res.body, 'Invalid song keys');
      }
      assert.equal(create.mock.callCount(), 0);
    });

    it('creates from allowed fields with server-set _id, createdBy and publicLink', async () => {
      const created = { name: 'Sunday' };
      mockOwnership(null);
      mockFolders(folder(GROUP_ID, USER.id));
      const create = mock.method(setlistRepository, 'create', async () => created);
      const res = await call(createSetlist, {
        body: {
          createdBy: 'someone-else',
          date: '2026-10-04',
          groupIds: [GROUP_ID],
          isDeleted: true,
          name: 'Sunday',
          publicLink: 'https://evil.example',
          songKeys: [
            { key: 'D', songId: SONG_A },
            { key: 'E', songId: SONG_C },
          ],
          songs: [SONG_A, SONG_B],
        },
        user: USER,
      });
      const arg = create.mock.calls[0]?.arguments[0];
      assert.ok(arg);
      const { _id, ...rest } = arg;
      assert.match(_id, /^[0-9a-f]{24}$/);
      assert.deepEqual(rest, {
        createdBy: USER.id,
        date: '2026-10-04',
        groupIds: [GROUP_ID],
        name: 'Sunday',
        publicLink: `https://worship.example/setlist/view/${_id}`,
        songKeys: [{ key: 'D', songId: SONG_A }],
        songs: [SONG_A, SONG_B],
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, created);
    });

    it('forbids creating a setlist inside a folder the caller cannot edit', async () => {
      mockOwnership({ groupIds: [entry(OTHER_GROUP_ID)], setlistIds: [] });
      mockFolders(folder(GROUP_ID, OTHER_USER_ID));
      const create = mock.method(setlistRepository, 'create', async () => ({}));
      const res = await call(createSetlist, {
        body: { groupIds: [GROUP_ID], name: 'Sunday' },
        user: USER,
      });
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, FORBIDDEN);
      assert.equal(create.mock.callCount(), 0);
    });

    it('rejects groupIds that are not object ids', async () => {
      const create = mock.method(setlistRepository, 'create', async () => ({}));
      const res = await call(createSetlist, {
        body: { groupIds: ['bad'], name: 'Sunday' },
        user: USER,
      });
      assert.equal(res.statusCode, 400);
      assert.equal(res.body, 'Invalid request');
      assert.equal(create.mock.callCount(), 0);
    });

    it('rejects songKeys sent without a songs list', async () => {
      const create = mock.method(setlistRepository, 'create', async () => ({}));
      for (const songs of [undefined, null, { 0: SONG_A }]) {
        const res = await call(createSetlist, {
          body: { name: 'Sunday', songKeys: [{ key: 'D', songId: SONG_A }], songs },
          user: USER,
        });
        assert.equal(res.statusCode, 400, JSON.stringify(songs));
        assert.equal(res.body, 'Invalid song keys');
      }
      assert.equal(create.mock.callCount(), 0);
    });

    it('keeps the song key when songs is a single id string', async () => {
      const create = mock.method(setlistRepository, 'create', async () => ({}));
      await call(createSetlist, {
        body: { name: 'Sunday', songKeys: [{ key: 'D', songId: SONG_A }], songs: SONG_A },
        user: USER,
      });
      assert.deepEqual(create.mock.calls[0]?.arguments[0]?.songKeys, [
        { key: 'D', songId: SONG_A },
      ]);
    });

    it('builds publicLink from the request when BASE_URL is unset', async () => {
      const create = mock.method(setlistRepository, 'create', async () => ({}));
      delete process.env.BASE_URL;
      try {
        await call(createSetlist, {
          body: { name: 'Sunday' },
          host: 'localhost:8080',
          protocol: 'http',
          user: USER,
        });
      } finally {
        process.env.BASE_URL = 'https://worship.example';
      }
      const arg = create.mock.calls[0]?.arguments[0];
      assert.equal(arg?.publicLink, `http://localhost:8080/setlist/view/${arg?._id}`);
    });
  });

  describe('getSetlist', () => {
    it('rejects an id list containing an invalid id', async () => {
      const findLiveByIds = mock.method(setlistRepository, 'findLiveByIds', async () => []);
      const res = await call(getSetlist, { query: { id: [SETLIST_ID, 'bad'] } });
      assert.equal(res.statusCode, 400);
      assert.equal(res.body, 'Invalid setlist id');
      assert.equal(findLiveByIds.mock.callCount(), 0);
    });

    it('reads an id list with the public view for anonymous callers', async () => {
      const setlists = [{ _id: SETLIST_ID }];
      const findLiveByIds = mock.method(setlistRepository, 'findLiveByIds', async () => setlists);
      const res = await call(getSetlist, { query: { id: [SETLIST_ID, OTHER_SETLIST_ID] } });
      assert.deepEqual(findLiveByIds.mock.calls[0]?.arguments, [
        [SETLIST_ID, OTHER_SETLIST_ID],
        'public',
      ]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, setlists);
    });

    it('reads an id list with the full view for authenticated callers', async () => {
      const findLiveByIds = mock.method(setlistRepository, 'findLiveByIds', async () => [
        { _id: SETLIST_ID },
      ]);
      await call(getSetlist, { query: { id: [SETLIST_ID] }, user: USER });
      assert.deepEqual(findLiveByIds.mock.calls[0]?.arguments, [[SETLIST_ID], 'full']);
    });

    it('returns 404 for an id list with no matches, including an empty list', async () => {
      mock.method(setlistRepository, 'findLiveByIds', async () => []);
      for (const id of [[SETLIST_ID], []]) {
        const res = await call(getSetlist, { query: { id } });
        assert.equal(res.statusCode, 404);
        assert.equal(res.body, 'No setlists found with the provided IDs');
      }
    });

    it('rejects an invalid single id', async () => {
      const findLiveById = mock.method(setlistRepository, 'findLiveById', async () => null);
      for (const id of ['bad', '', { $ne: null }]) {
        const res = await call(getSetlist, { query: { id } });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Invalid setlist id');
      }
      assert.equal(findLiveById.mock.callCount(), 0);
    });

    it('reads a single id with the view for the caller', async () => {
      const setlist = { _id: SETLIST_ID };
      const findLiveById = mock.method(setlistRepository, 'findLiveById', async () => setlist);
      const res = await call(getSetlist, { query: { id: SETLIST_ID } });
      await call(getSetlist, { query: { id: SETLIST_ID }, user: USER });
      assert.deepEqual(
        findLiveById.mock.calls.map((c) => c.arguments),
        [
          [SETLIST_ID, 'public'],
          [SETLIST_ID, 'full'],
        ]
      );
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, setlist);
    });

    it('returns 404 for a missing single setlist', async () => {
      mock.method(setlistRepository, 'findLiveById', async () => null);
      const res = await call(getSetlist, { query: { id: SETLIST_ID }, user: USER });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Setlist not found');
    });

    it('rejects listing every setlist without req.user', async () => {
      const list = mock.method(setlistRepository, 'listLiveReachable', async () => []);
      const res = await call(getSetlist, {});
      assert.equal(res.statusCode, 401);
      assert.equal(res.body, 'Unauthorized');
      assert.equal(list.mock.callCount(), 0);
    });

    it('lists every live setlist for an admin without reading ownership', async () => {
      const findCallerAccess = mockOwnership(null);
      const list = mock.method(setlistRepository, 'listLiveReachable', async () => []);
      const res = await call(getSetlist, { user: ADMIN });
      assert.deepEqual(list.mock.calls[0]?.arguments, [{ all: true }]);
      assert.equal(findCallerAccess.mock.callCount(), 0);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, []);
    });

    it('lists only setlists the caller created, owns, or reaches through a folder', async () => {
      const findCallerAccess = mockOwnership({
        groupIds: [entry(GROUP_ID), entry('legacy-group')],
        setlistIds: [entry(SETLIST_ID)],
      });
      const setlists = [{ _id: SETLIST_ID }];
      const list = mock.method(setlistRepository, 'listLiveReachable', async () => setlists);
      const res = await call(getSetlist, { user: USER });
      assert.deepEqual(findCallerAccess.mock.calls[0]?.arguments, [USER.id]);
      assert.deepEqual(list.mock.calls[0]?.arguments, [
        { createdBy: USER.id, groupIds: [GROUP_ID], setlistIds: [SETLIST_ID] },
      ]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, setlists);
    });

    it('lists only created setlists for a caller with no ownership record', async () => {
      mockOwnership(null);
      const list = mock.method(setlistRepository, 'listLiveReachable', async () => []);
      await call(getSetlist, { user: USER });
      assert.deepEqual(list.mock.calls[0]?.arguments, [
        { createdBy: USER.id, groupIds: [], setlistIds: [] },
      ]);
    });
  });

  describe('updateSetlist', () => {
    it('rejects a request without req.user', async () => {
      const findLiveAccess = mockStored(null);
      const res = await call(updateSetlist, { body: { id: SETLIST_ID, name: 'Sunday' } });
      assert.equal(res.statusCode, 401);
      assert.equal(findLiveAccess.mock.callCount(), 0);
    });

    it('rejects a missing or invalid id, or no allowed fields', async () => {
      const update = mock.method(setlistRepository, 'updateLive', async () => null);
      for (const body of [
        undefined,
        { name: 'Sunday' },
        { id: 'bad', name: 'Sunday' },
        { id: SETLIST_ID },
        { createdBy: USER.id, id: SETLIST_ID },
      ]) {
        const res = await call(updateSetlist, { body, user: USER });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(update.mock.callCount(), 0);
    });

    it('rejects invalid songKeys before querying', async () => {
      const findLiveAccess = mockStored(null);
      const update = mock.method(setlistRepository, 'updateLive', async () => null);
      for (const songKeys of [null, {}, [{ key: 'C', songId: 'bad' }]]) {
        const res = await call(updateSetlist, { body: { id: SETLIST_ID, songKeys }, user: USER });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Invalid song keys');
      }
      assert.equal(findLiveAccess.mock.callCount(), 0);
      assert.equal(update.mock.callCount(), 0);
    });

    it('returns 404 before any write when no live setlist matches', async () => {
      const findLiveAccess = mockStored(null);
      const update = mock.method(setlistRepository, 'updateLive', async () => ({}));
      const res = await call(updateSetlist, {
        body: { id: SETLIST_ID, name: 'Sunday' },
        user: USER,
      });
      assert.deepEqual(findLiveAccess.mock.calls[0]?.arguments, [SETLIST_ID]);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Setlist not found');
      assert.equal(update.mock.callCount(), 0);
    });

    it('forbids a caller who is not the creator, an owner, or a folder member', async () => {
      mockStored(storedSetlist({ createdBy: OTHER_USER_ID, groupIds: [OTHER_GROUP_ID] }));
      mockOwnership({ groupIds: [entry(GROUP_ID)], setlistIds: [entry(OTHER_SETLIST_ID)] });
      const update = mock.method(setlistRepository, 'updateLive', async () => ({}));
      const res = await call(updateSetlist, {
        body: { id: SETLIST_ID, name: 'Sunday' },
        user: USER,
      });
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, FORBIDDEN);
      assert.equal(update.mock.callCount(), 0);
    });

    it('forbids a non-admin on a legacy setlist with no createdBy or shared access', async () => {
      mockStored(storedSetlist({}));
      mockOwnership(null);
      const res = await call(updateSetlist, {
        body: { id: SETLIST_ID, name: 'Sunday' },
        user: USER,
      });
      assert.equal(res.statusCode, 403);
    });

    it('allows the creator, an owner, a folder member, and an admin', async () => {
      const cases: [TokenUser, Partial<SetlistAccess>, CallerAccess | null][] = [
        [USER, { createdBy: USER.id }, null],
        [USER, { createdBy: OTHER_USER_ID }, { groupIds: [], setlistIds: [entry(SETLIST_ID)] }],
        [
          USER,
          { createdBy: OTHER_USER_ID, groupIds: [GROUP_ID] },
          { groupIds: [entry(GROUP_ID)], setlistIds: [] },
        ],
        [ADMIN, {}, null],
      ];
      for (const [user, stored, ownership] of cases) {
        mockStored(storedSetlist(stored));
        mockOwnership(ownership);
        const updated = { _id: SETLIST_ID, name: 'Sunday' };
        const update = mock.method(setlistRepository, 'updateLive', async () => updated);
        const res = await call(updateSetlist, { body: { id: SETLIST_ID, name: 'Sunday' }, user });
        assert.equal(res.statusCode, 200, JSON.stringify(stored));
        assert.equal(res.body, updated);
        assert.deepEqual(update.mock.calls[0]?.arguments, [SETLIST_ID, { name: 'Sunday' }]);
        mock.restoreAll();
      }
    });

    it('filters songKeys against the songs in the body', async () => {
      mockStored(storedSetlist({ createdBy: USER.id, songs: [SONG_C] }));
      mockOwnership(null);
      const setlist = { _id: SETLIST_ID };
      const update = mock.method(setlistRepository, 'updateLive', async () => setlist);
      const res = await call(updateSetlist, {
        body: {
          createdBy: 'x',
          id: SETLIST_ID,
          songKeys: [
            { key: 'A', songId: SONG_A },
            { key: 'B', songId: SONG_C },
          ],
          songs: [SONG_A],
        },
        user: USER,
      });
      assert.deepEqual(update.mock.calls[0]?.arguments, [
        SETLIST_ID,
        { songKeys: [{ key: 'A', songId: SONG_A }], songs: [SONG_A] },
      ]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, setlist);
    });

    it('filters songKeys against the stored songs when songs is not sent', async () => {
      mockStored(storedSetlist({ createdBy: USER.id, songs: [SONG_B] }));
      mockOwnership(null);
      const update = mock.method(setlistRepository, 'updateLive', async () => ({}));
      await call(updateSetlist, {
        body: {
          id: SETLIST_ID,
          songKeys: [
            { key: 'A', songId: SONG_A },
            { key: 'Bb', songId: SONG_B },
          ],
        },
        user: USER,
      });
      assert.deepEqual(update.mock.calls[0]?.arguments[1], {
        songKeys: [{ key: 'Bb', songId: SONG_B }],
      });
    });

    it('links new folders the caller can edit and keeps folders the caller cannot edit', async () => {
      mockStored(storedSetlist({ createdBy: USER.id, groupIds: [OTHER_GROUP_ID] }));
      mockOwnership({ groupIds: [entry(GROUP_ID)], setlistIds: [] });
      mockFolders(folder(GROUP_ID, OTHER_USER_ID), folder(OTHER_GROUP_ID, OTHER_USER_ID));
      const update = mock.method(setlistRepository, 'updateLive', async () => ({}));
      const res = await call(updateSetlist, {
        body: { groupIds: [GROUP_ID.toUpperCase()], id: SETLIST_ID },
        user: USER,
      });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(update.mock.calls[0]?.arguments[1], {
        groupIds: [GROUP_ID, OTHER_GROUP_ID],
      });
    });

    it('forbids linking a folder the caller cannot edit', async () => {
      mockStored(storedSetlist({ createdBy: USER.id }));
      mockOwnership(null);
      mockFolders(folder(GROUP_ID, OTHER_USER_ID));
      const update = mock.method(setlistRepository, 'updateLive', async () => ({}));
      const res = await call(updateSetlist, {
        body: { groupIds: [GROUP_ID], id: SETLIST_ID },
        user: USER,
      });
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, FORBIDDEN);
      assert.equal(update.mock.callCount(), 0);
    });

    it('returns 404 when the setlist disappears before the write', async () => {
      mockStored(storedSetlist({ createdBy: USER.id }));
      mockOwnership(null);
      mock.method(setlistRepository, 'updateLive', async () => null);
      const res = await call(updateSetlist, {
        body: { id: SETLIST_ID, name: 'Sunday' },
        user: USER,
      });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Setlist not found');
    });
  });

  describe('deleteSetlist', () => {
    it('rejects a request without req.user', async () => {
      const res = await call(deleteSetlist, { body: { id: SETLIST_ID } });
      assert.equal(res.statusCode, 401);
    });

    it('rejects bodies without a valid id', async () => {
      const findLiveAccess = mockStored(null);
      for (const body of [undefined, {}, { params: null }, { params: { id: 'bad' } }]) {
        const res = await call(deleteSetlist, { body, user: USER });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(findLiveAccess.mock.callCount(), 0);
    });

    it('uses whichever of params.id and id is a valid id, preferring params.id', async () => {
      mockStored(storedSetlist({ createdBy: USER.id }));
      const softDelete = mock.method(setlistRepository, 'softDelete', async () => true);
      const responses = [];
      for (const body of [
        { id: OTHER_SETLIST_ID, params: { id: SETLIST_ID } },
        { id: OTHER_SETLIST_ID },
        { id: OTHER_SETLIST_ID, params: { id: 'bad' } },
      ]) {
        responses.push(await call(deleteSetlist, { body, user: USER }));
      }
      assert.deepEqual(
        softDelete.mock.calls.map((c) => c.arguments[0]),
        [SETLIST_ID, OTHER_SETLIST_ID, OTHER_SETLIST_ID]
      );
      for (const res of responses) {
        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'Setlist deleted');
      }
    });

    it('returns 404 when no live setlist matches', async () => {
      mockStored(null);
      const softDelete = mock.method(setlistRepository, 'softDelete', async () => true);
      const res = await call(deleteSetlist, { body: { id: SETLIST_ID }, user: USER });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Setlist not found');
      assert.equal(softDelete.mock.callCount(), 0);
    });

    it('forbids owners, folder members, and non-admins on legacy setlists', async () => {
      const findCallerAccess = mockOwnership({
        groupIds: [entry(GROUP_ID)],
        setlistIds: [entry(SETLIST_ID)],
      });
      const softDelete = mock.method(setlistRepository, 'softDelete', async () => true);
      for (const stored of [
        { createdBy: OTHER_USER_ID, groupIds: [GROUP_ID] },
        { groupIds: [GROUP_ID] },
      ]) {
        mockStored(storedSetlist(stored));
        const res = await call(deleteSetlist, { body: { id: SETLIST_ID }, user: USER });
        assert.equal(res.statusCode, 403, JSON.stringify(stored));
        assert.deepEqual(res.body, FORBIDDEN);
      }
      assert.equal(softDelete.mock.callCount(), 0);
      assert.equal(findCallerAccess.mock.callCount(), 0);
    });

    it('lets the creator and an admin delete, including an admin on a legacy setlist', async () => {
      const cases: [TokenUser, Partial<SetlistAccess>][] = [
        [USER, { createdBy: USER.id }],
        [ADMIN, { createdBy: OTHER_USER_ID }],
        [ADMIN, {}],
      ];
      for (const [user, stored] of cases) {
        mockStored(storedSetlist(stored));
        mock.method(setlistRepository, 'softDelete', async () => true);
        const res = await call(deleteSetlist, { body: { id: SETLIST_ID }, user });
        assert.equal(res.statusCode, 200, JSON.stringify(stored));
        mock.restoreAll();
      }
    });
  });
});
