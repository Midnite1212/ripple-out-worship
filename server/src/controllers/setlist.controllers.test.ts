import { Types } from 'mongoose';
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import { Ownership } from '../models/ownership.model';
import { MUSIC_KEYS, Setlist } from '../models/setlist.model';
import {
  FakeRequestInit,
  callHandler,
  createRequest,
  createResponse,
  execResult,
} from '../testing/http';
import { TokenUser } from '../utils/verify-jwt';
import {
  createSetlist,
  deleteSetlist,
  getSetlist,
  keepSetlistSongKeys,
  parseSongKeys,
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

const call = async (handler: Parameters<typeof callHandler>[0], init: FakeRequestInit) => {
  const res = createResponse();
  await callHandler(handler, createRequest(init), res);
  return res;
};

const entry = (id: string) => ({ createdAt: '2026-01-01T00:00:00.000Z', id, name: 'Entry' });

const mockOwnership = (ownership: unknown) =>
  mock.method(Ownership, 'findOne', () => execResult(ownership));

const storedSetlist = (fields: Record<string, unknown>) => ({
  _id: new Types.ObjectId(SETLIST_ID),
  groupIds: [],
  songs: [],
  ...fields,
});

const populatedExec = (value: unknown) => {
  const populate = mock.fn(() => execResult(value));
  return { chain: { populate }, populate };
};

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
        { key: 'C', songId: new Types.ObjectId(SONG_A) },
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

    it('matches ObjectId song ids by their string form', () => {
      assert.deepEqual(
        keepSetlistSongKeys([{ key: 'G', songId: SONG_A }], [new Types.ObjectId(SONG_A)]),
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
      const create = mock.method(Setlist, 'create', async () => ({}));
      const res = await call(createSetlist, { body: { name: 'Sunday' } });
      assert.equal(res.statusCode, 401);
      assert.equal(res.body, 'Unauthorized');
      assert.equal(create.mock.callCount(), 0);
    });

    it('rejects a body with no allowed fields', async () => {
      const create = mock.method(Setlist, 'create', async () => ({}));
      for (const body of [undefined, {}, { createdBy: USER.id, publicLink: 'x' }]) {
        const res = await call(createSetlist, { body, user: USER });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(create.mock.callCount(), 0);
    });

    it('rejects invalid songKeys', async () => {
      const create = mock.method(Setlist, 'create', async () => ({}));
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
      const create = mock.method(Setlist, 'create', async () => created);
      const res = await call(createSetlist, {
        body: {
          createdBy: 'someone-else',
          date: '2026-10-04',
          groupIds: [OTHER_SETLIST_ID],
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
      const arg = create.mock.calls[0]?.arguments[0] as Record<string, unknown>;
      const { _id, ...rest } = arg;
      assert.ok(_id instanceof Types.ObjectId);
      assert.deepEqual(rest, {
        createdBy: USER.id,
        date: '2026-10-04',
        groupIds: [OTHER_SETLIST_ID],
        name: 'Sunday',
        publicLink: `https://worship.example/setlist/view/${String(_id)}`,
        songKeys: [{ key: 'D', songId: SONG_A }],
        songs: [SONG_A, SONG_B],
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, created);
    });

    it('rejects songKeys sent without a songs list', async () => {
      const create = mock.method(Setlist, 'create', async () => ({}));
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
      const create = mock.method(Setlist, 'create', async () => ({}));
      await call(createSetlist, {
        body: { name: 'Sunday', songKeys: [{ key: 'D', songId: SONG_A }], songs: SONG_A },
        user: USER,
      });
      const arg = create.mock.calls[0]?.arguments[0] as Record<string, unknown>;
      assert.deepEqual(arg.songKeys, [{ key: 'D', songId: SONG_A }]);
    });

    it('builds publicLink from the request when BASE_URL is unset', async () => {
      const create = mock.method(Setlist, 'create', async () => ({}));
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
      const arg = create.mock.calls[0]?.arguments[0] as Record<string, unknown>;
      assert.equal(arg.publicLink, `http://localhost:8080/setlist/view/${String(arg._id)}`);
    });
  });

  describe('getSetlist', () => {
    it('rejects an id list containing an invalid id', async () => {
      const find = mock.method(Setlist, 'find', () => populatedExec([]).chain);
      const res = await call(getSetlist, { query: { id: [SETLIST_ID, 'bad'] } });
      assert.equal(res.statusCode, 400);
      assert.equal(res.body, 'Invalid setlist id');
      assert.equal(find.mock.callCount(), 0);
    });

    it('reads an id list with the public projection for anonymous callers', async () => {
      const setlists = [{ _id: SETLIST_ID }];
      const { chain, populate } = populatedExec(setlists);
      const find = mock.method(Setlist, 'find', () => chain);
      const res = await call(getSetlist, { query: { id: [SETLIST_ID, OTHER_SETLIST_ID] } });
      assert.deepEqual(find.mock.calls[0]?.arguments, [
        { _id: { $in: [SETLIST_ID, OTHER_SETLIST_ID] }, isDeleted: false },
        '-createdBy -lastUpdatedBy -groupIds',
      ]);
      assert.deepEqual(populate.mock.calls[0]?.arguments, [
        { path: 'songs', select: '-createdBy -lastUpdatedBy' },
      ]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, setlists);
    });

    it('reads an id list with full fields for authenticated callers', async () => {
      const { chain, populate } = populatedExec([{ _id: SETLIST_ID }]);
      const find = mock.method(Setlist, 'find', () => chain);
      await call(getSetlist, { query: { id: [SETLIST_ID] }, user: USER });
      assert.deepEqual((find.mock.calls[0]?.arguments as unknown[] | undefined)?.[1], {});
      assert.deepEqual(populate.mock.calls[0]?.arguments, [{ path: 'songs' }]);
    });

    it('returns 404 for an id list with no matches, including an empty list', async () => {
      mock.method(Setlist, 'find', () => populatedExec([]).chain);
      for (const id of [[SETLIST_ID], []]) {
        const res = await call(getSetlist, { query: { id } });
        assert.equal(res.statusCode, 404);
        assert.equal(res.body, 'No setlists found with the provided IDs');
      }
    });

    it('rejects an invalid single id', async () => {
      const findOne = mock.method(Setlist, 'findOne', () => populatedExec(null).chain);
      for (const id of ['bad', '', { $ne: null }]) {
        const res = await call(getSetlist, { query: { id } });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Invalid setlist id');
      }
      assert.equal(findOne.mock.callCount(), 0);
    });

    it('reads a single id with the projection for the caller', async () => {
      const setlist = { _id: SETLIST_ID };
      const { chain, populate } = populatedExec(setlist);
      const findOne = mock.method(Setlist, 'findOne', () => chain);
      const res = await call(getSetlist, { query: { id: SETLIST_ID } });
      assert.deepEqual(findOne.mock.calls[0]?.arguments, [
        { _id: SETLIST_ID, isDeleted: false },
        '-createdBy -lastUpdatedBy -groupIds',
      ]);
      assert.deepEqual(populate.mock.calls[0]?.arguments, [
        { path: 'songs', select: '-createdBy -lastUpdatedBy' },
      ]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, setlist);
    });

    it('returns 404 for a missing single setlist', async () => {
      mock.method(Setlist, 'findOne', () => populatedExec(null).chain);
      const res = await call(getSetlist, { query: { id: SETLIST_ID }, user: USER });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Setlist not found');
    });

    it('rejects listing every setlist without req.user', async () => {
      const find = mock.method(Setlist, 'find', () => populatedExec([]).chain);
      const res = await call(getSetlist, {});
      assert.equal(res.statusCode, 401);
      assert.equal(res.body, 'Unauthorized');
      assert.equal(find.mock.callCount(), 0);
    });

    it('lists every live setlist for an admin without reading ownership', async () => {
      const ownershipFindOne = mockOwnership(null);
      const { chain, populate } = populatedExec([]);
      const find = mock.method(Setlist, 'find', () => chain);
      const res = await call(getSetlist, { user: ADMIN });
      assert.deepEqual(find.mock.calls[0]?.arguments, [{ isDeleted: false }]);
      assert.deepEqual(populate.mock.calls[0]?.arguments, ['songs']);
      assert.equal(ownershipFindOne.mock.callCount(), 0);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, []);
    });

    it('lists only setlists the caller created, owns, or reaches through a folder', async () => {
      const ownershipFindOne = mockOwnership({
        groupIds: [entry(GROUP_ID), entry('legacy-group')],
        setlistIds: [entry(SETLIST_ID)],
      });
      const setlists = [{ _id: SETLIST_ID }];
      const find = mock.method(Setlist, 'find', () => populatedExec(setlists).chain);
      const res = await call(getSetlist, { user: USER });
      assert.deepEqual(ownershipFindOne.mock.calls[0]?.arguments, [
        { isDeleted: false, userId: USER.id },
        'groupIds setlistIds',
      ]);
      assert.deepEqual(find.mock.calls[0]?.arguments, [
        {
          $or: [
            { _id: { $in: [SETLIST_ID] } },
            { groupIds: { $in: [GROUP_ID] } },
            { createdBy: USER.id },
          ],
          isDeleted: false,
        },
      ]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, setlists);
    });

    it('lists only created setlists for a caller with no ownership record', async () => {
      mockOwnership(null);
      const find = mock.method(Setlist, 'find', () => populatedExec([]).chain);
      await call(getSetlist, { user: USER });
      assert.deepEqual(find.mock.calls[0]?.arguments, [
        {
          $or: [{ _id: { $in: [] } }, { groupIds: { $in: [] } }, { createdBy: USER.id }],
          isDeleted: false,
        },
      ]);
    });
  });

  describe('updateSetlist', () => {
    it('rejects a request without req.user', async () => {
      const findOne = mock.method(Setlist, 'findOne', () => execResult(null));
      const res = await call(updateSetlist, { body: { id: SETLIST_ID, name: 'Sunday' } });
      assert.equal(res.statusCode, 401);
      assert.equal(findOne.mock.callCount(), 0);
    });

    it('rejects a missing or invalid id, or no allowed fields', async () => {
      const update = mock.method(Setlist, 'findOneAndUpdate', async () => null);
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
      const findOne = mock.method(Setlist, 'findOne', () => execResult(null));
      const update = mock.method(Setlist, 'findOneAndUpdate', async () => null);
      for (const songKeys of [null, {}, [{ key: 'C', songId: 'bad' }]]) {
        const res = await call(updateSetlist, { body: { id: SETLIST_ID, songKeys }, user: USER });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Invalid song keys');
      }
      assert.equal(findOne.mock.callCount(), 0);
      assert.equal(update.mock.callCount(), 0);
    });

    it('returns 404 before any write when no live setlist matches', async () => {
      const findOne = mock.method(Setlist, 'findOne', () => execResult(null));
      const update = mock.method(Setlist, 'findOneAndUpdate', async () => ({}));
      const res = await call(updateSetlist, {
        body: { id: SETLIST_ID, name: 'Sunday' },
        user: USER,
      });
      assert.deepEqual(findOne.mock.calls[0]?.arguments, [
        { _id: SETLIST_ID, isDeleted: false },
        'createdBy groupIds songs',
      ]);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Setlist not found');
      assert.equal(update.mock.callCount(), 0);
    });

    it('forbids a caller who is not the creator, an owner, or a folder member', async () => {
      mock.method(Setlist, 'findOne', () =>
        execResult(storedSetlist({ createdBy: OTHER_USER_ID, groupIds: [OTHER_GROUP_ID] }))
      );
      mockOwnership({ groupIds: [entry(GROUP_ID)], setlistIds: [entry(OTHER_SETLIST_ID)] });
      const update = mock.method(Setlist, 'findOneAndUpdate', async () => ({}));
      const res = await call(updateSetlist, {
        body: { id: SETLIST_ID, name: 'Sunday' },
        user: USER,
      });
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, FORBIDDEN);
      assert.equal(update.mock.callCount(), 0);
    });

    it('forbids a non-admin on a legacy setlist with no createdBy or shared access', async () => {
      mock.method(Setlist, 'findOne', () => execResult(storedSetlist({})));
      mockOwnership(null);
      const res = await call(updateSetlist, {
        body: { id: SETLIST_ID, name: 'Sunday' },
        user: USER,
      });
      assert.equal(res.statusCode, 403);
    });

    it('allows the creator, an owner, a folder member, and an admin', async () => {
      const cases: [TokenUser, Record<string, unknown>, unknown][] = [
        [USER, { createdBy: new Types.ObjectId(USER.id) }, null],
        [USER, { createdBy: OTHER_USER_ID }, { setlistIds: [entry(SETLIST_ID)] }],
        [
          USER,
          { createdBy: OTHER_USER_ID, groupIds: [new Types.ObjectId(GROUP_ID)] },
          { groupIds: [entry(GROUP_ID)] },
        ],
        [ADMIN, {}, null],
      ];
      for (const [user, stored, ownership] of cases) {
        mock.method(Setlist, 'findOne', () => execResult(storedSetlist(stored)));
        mockOwnership(ownership);
        const updated = { _id: SETLIST_ID, name: 'Sunday' };
        const update = mock.method(Setlist, 'findOneAndUpdate', async () => updated);
        const res = await call(updateSetlist, { body: { id: SETLIST_ID, name: 'Sunday' }, user });
        assert.equal(res.statusCode, 200, JSON.stringify(stored));
        assert.equal(res.body, updated);
        assert.deepEqual(update.mock.calls[0]?.arguments, [
          { _id: SETLIST_ID, isDeleted: false },
          { $set: { name: 'Sunday' } },
          { new: true, runValidators: true },
        ]);
        mock.restoreAll();
      }
    });

    it('filters songKeys against the songs in the body', async () => {
      mock.method(Setlist, 'findOne', () =>
        execResult(storedSetlist({ createdBy: USER.id, songs: [new Types.ObjectId(SONG_C)] }))
      );
      mockOwnership(null);
      const setlist = { _id: SETLIST_ID };
      const update = mock.method(Setlist, 'findOneAndUpdate', async () => setlist);
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
        { _id: SETLIST_ID, isDeleted: false },
        { $set: { songKeys: [{ key: 'A', songId: SONG_A }], songs: [SONG_A] } },
        { new: true, runValidators: true },
      ]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, setlist);
    });

    it('filters songKeys against the stored songs when songs is not sent', async () => {
      mock.method(Setlist, 'findOne', () =>
        execResult(storedSetlist({ createdBy: USER.id, songs: [new Types.ObjectId(SONG_B)] }))
      );
      mockOwnership(null);
      const update = mock.method(Setlist, 'findOneAndUpdate', async () => ({}));
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
        $set: { songKeys: [{ key: 'Bb', songId: SONG_B }] },
      });
    });

    it('returns 404 when the setlist disappears before the write', async () => {
      mock.method(Setlist, 'findOne', () => execResult(storedSetlist({ createdBy: USER.id })));
      mockOwnership(null);
      mock.method(Setlist, 'findOneAndUpdate', async () => null);
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
      const findOne = mock.method(Setlist, 'findOne', () => execResult(null));
      for (const body of [undefined, {}, { params: null }, { params: { id: 'bad' } }]) {
        const res = await call(deleteSetlist, { body, user: USER });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(findOne.mock.callCount(), 0);
    });

    it('uses whichever of params.id and id is a valid id, preferring params.id', async () => {
      mock.method(Setlist, 'findOne', () => execResult(storedSetlist({ createdBy: USER.id })));
      const updateOne = mock.method(Setlist, 'updateOne', async () => ({ matchedCount: 1 }));
      const responses = [];
      for (const body of [
        { id: OTHER_SETLIST_ID, params: { id: SETLIST_ID } },
        { id: OTHER_SETLIST_ID },
        { id: OTHER_SETLIST_ID, params: { id: 'bad' } },
      ]) {
        responses.push(await call(deleteSetlist, { body, user: USER }));
      }
      assert.deepEqual(updateOne.mock.calls[0]?.arguments, [
        { _id: SETLIST_ID, isDeleted: false },
        { $set: { isDeleted: true } },
      ]);
      for (const index of [1, 2]) {
        assert.deepEqual(updateOne.mock.calls[index]?.arguments[0], {
          _id: OTHER_SETLIST_ID,
          isDeleted: false,
        });
      }
      for (const res of responses) {
        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'Setlist deleted');
      }
    });

    it('returns 404 when no live setlist matches', async () => {
      mock.method(Setlist, 'findOne', () => execResult(null));
      const updateOne = mock.method(Setlist, 'updateOne', async () => ({ matchedCount: 1 }));
      const res = await call(deleteSetlist, { body: { id: SETLIST_ID }, user: USER });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Setlist not found');
      assert.equal(updateOne.mock.callCount(), 0);
    });

    it('forbids owners, folder members, and non-admins on legacy setlists', async () => {
      const ownershipFindOne = mockOwnership({
        groupIds: [entry(GROUP_ID)],
        setlistIds: [entry(SETLIST_ID)],
      });
      const updateOne = mock.method(Setlist, 'updateOne', async () => ({ matchedCount: 1 }));
      for (const stored of [
        { createdBy: OTHER_USER_ID, groupIds: [GROUP_ID] },
        { groupIds: [GROUP_ID] },
      ]) {
        mock.method(Setlist, 'findOne', () => execResult(storedSetlist(stored)));
        const res = await call(deleteSetlist, { body: { id: SETLIST_ID }, user: USER });
        assert.equal(res.statusCode, 403, JSON.stringify(stored));
        assert.deepEqual(res.body, FORBIDDEN);
      }
      assert.equal(updateOne.mock.callCount(), 0);
      assert.equal(ownershipFindOne.mock.callCount(), 0);
    });

    it('lets the creator and an admin delete, including an admin on a legacy setlist', async () => {
      const cases: [TokenUser, Record<string, unknown>][] = [
        [USER, { createdBy: new Types.ObjectId(USER.id) }],
        [ADMIN, { createdBy: OTHER_USER_ID }],
        [ADMIN, {}],
      ];
      for (const [user, stored] of cases) {
        mock.method(Setlist, 'findOne', () => execResult(storedSetlist(stored)));
        mock.method(Setlist, 'updateOne', async () => ({ matchedCount: 1 }));
        const res = await call(deleteSetlist, { body: { id: SETLIST_ID }, user });
        assert.equal(res.statusCode, 200, JSON.stringify(stored));
        mock.restoreAll();
      }
    });
  });
});
