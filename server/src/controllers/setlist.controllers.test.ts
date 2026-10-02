import { Types } from 'mongoose';
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
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
const SETLIST_ID = '507f1f77bcf86cd799439021';
const OTHER_SETLIST_ID = '507f1f77bcf86cd799439022';
const SONG_A = '507f1f77bcf86cd799439031';
const SONG_B = '507f1f77bcf86cd799439032';
const SONG_C = '507f1f77bcf86cd799439033';

const call = async (handler: Parameters<typeof callHandler>[0], init: FakeRequestInit) => {
  const res = createResponse();
  await callHandler(handler, createRequest(init), res);
  return res;
};

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

    it('accepts any 12-character string as a songId', () => {
      assert.deepEqual(parseSongKeys([{ key: 'C', songId: 'aaaaaaaaaaaa' }]), [
        { key: 'C', songId: 'aaaaaaaaaaaa' },
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

    it('keeps the last key per song in first-seen order', () => {
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
          { key: 'E', songId: SONG_A },
          { key: 'D', songId: SONG_B },
        ]
      );
    });

    it('matches ObjectId song ids by their string form', () => {
      assert.deepEqual(
        keepSetlistSongKeys([{ key: 'G', songId: SONG_A }], [new Types.ObjectId(SONG_A)]),
        [{ key: 'G', songId: SONG_A }]
      );
    });

    it('drops every key when songIds is not an array', () => {
      for (const songIds of [undefined, null, SONG_A, { 0: SONG_A }]) {
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

    it('drops every song key when songs is not sent', async () => {
      const create = mock.method(Setlist, 'create', async () => ({}));
      await call(createSetlist, {
        body: { name: 'Sunday', songKeys: [{ key: 'D', songId: SONG_A }] },
        user: USER,
      });
      const arg = create.mock.calls[0]?.arguments[0] as Record<string, unknown>;
      assert.deepEqual(arg.songKeys, []);
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

    it('lists every live setlist for any authenticated caller', async () => {
      const { chain, populate } = populatedExec([]);
      const find = mock.method(Setlist, 'find', () => chain);
      const res = await call(getSetlist, { user: USER });
      assert.deepEqual(find.mock.calls[0]?.arguments, [{ isDeleted: false }]);
      assert.deepEqual(populate.mock.calls[0]?.arguments, ['songs']);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, []);
    });
  });

  describe('updateSetlist', () => {
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

    it('filters songKeys against the songs in the body', async () => {
      const findOne = mock.method(Setlist, 'findOne', () => execResult(null));
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
      assert.equal(findOne.mock.callCount(), 0);
      assert.deepEqual(update.mock.calls[0]?.arguments, [
        { _id: SETLIST_ID, isDeleted: false },
        { $set: { songKeys: [{ key: 'A', songId: SONG_A }], songs: [SONG_A] } },
        { new: true, runValidators: true },
      ]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, setlist);
    });

    it('filters songKeys against the stored songs when songs is not sent', async () => {
      const findOne = mock.method(Setlist, 'findOne', () =>
        execResult({ songs: [new Types.ObjectId(SONG_B)] })
      );
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
      assert.deepEqual(findOne.mock.calls[0]?.arguments, [
        { _id: SETLIST_ID, isDeleted: false },
        'songs',
      ]);
      assert.deepEqual(update.mock.calls[0]?.arguments[1], {
        $set: { songKeys: [{ key: 'Bb', songId: SONG_B }] },
      });
    });

    it('returns 404 when the stored setlist for songKeys is missing', async () => {
      mock.method(Setlist, 'findOne', () => execResult(null));
      const update = mock.method(Setlist, 'findOneAndUpdate', async () => ({}));
      const res = await call(updateSetlist, {
        body: { id: SETLIST_ID, songKeys: [] },
        user: USER,
      });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Setlist not found');
      assert.equal(update.mock.callCount(), 0);
    });

    it('returns 404 when no live setlist matches, without an owner check', async () => {
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
    it('rejects bodies without a valid id', async () => {
      const updateOne = mock.method(Setlist, 'updateOne', async () => ({ matchedCount: 1 }));
      for (const body of [undefined, {}, { params: null }, { params: { id: 'bad' } }]) {
        const res = await call(deleteSetlist, { body, user: USER });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(updateOne.mock.callCount(), 0);
    });

    it('soft-deletes by params.id or id', async () => {
      const updateOne = mock.method(Setlist, 'updateOne', async () => ({ matchedCount: 1 }));
      const byParams = await call(deleteSetlist, {
        body: { params: { id: SETLIST_ID } },
        user: USER,
      });
      const byId = await call(deleteSetlist, { body: { id: OTHER_SETLIST_ID }, user: USER });
      assert.deepEqual(updateOne.mock.calls[0]?.arguments, [
        { _id: SETLIST_ID, isDeleted: false },
        { $set: { isDeleted: true } },
      ]);
      assert.deepEqual(updateOne.mock.calls[1]?.arguments[0], {
        _id: OTHER_SETLIST_ID,
        isDeleted: false,
      });
      for (const res of [byParams, byId]) {
        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'Setlist deleted');
      }
    });

    it('returns 404 when no live setlist matches', async () => {
      mock.method(Setlist, 'updateOne', async () => ({ matchedCount: 0 }));
      const res = await call(deleteSetlist, { body: { id: SETLIST_ID }, user: USER });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Setlist not found');
    });
  });
});
