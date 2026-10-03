import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { Song } from '../models/song.model';
import {
  FakeRequestInit,
  callHandler,
  createRequest,
  createResponse,
  execResult,
  rejectedExec,
} from '../testing/http';
import {
  createSong,
  deleteSong,
  getSong,
  getSongView,
  searchSongs,
  updateSong,
} from './song.controllers';

const SONG_ID = '507f1f77bcf86cd799439031';
const OTHER_SONG_ID = '507f1f77bcf86cd799439032';

const call = async (handler: Parameters<typeof callHandler>[0], init: FakeRequestInit) => {
  const res = createResponse();
  await callHandler(handler, createRequest(init), res);
  return res;
};

const stubSearch = (songs: unknown[] = [], totalCount = 0) => {
  const exec = mock.fn(async () => songs);
  const limit = mock.fn(() => ({ exec }));
  const skip = mock.fn(() => ({ limit }));
  const sort = mock.fn(() => ({ skip }));
  const find = mock.method(Song, 'find', () => ({ sort }));
  const countDocuments = mock.method(Song, 'countDocuments', () => execResult(totalCount));
  return { countDocuments, find, limit, skip, sort };
};

describe('song controllers', () => {
  beforeEach(() => {
    mock.method(console, 'error', () => undefined);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('createSong', () => {
    it('rejects a body with no allowed fields', async () => {
      const create = mock.method(Song, 'create', async () => ({}));
      for (const body of [undefined, {}, { createdBy: 'x', isVerified: true }]) {
        const res = await call(createSong, { body });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(create.mock.callCount(), 0);
    });

    it('creates the song from the allowed fields only', async () => {
      const song = { _id: SONG_ID };
      const create = mock.method(Song, 'create', async () => song);
      const allowed = {
        artist: 'Artist',
        chordLyrics: '[C]La',
        code: 'S1',
        originalKey: 'C',
        recommendedKeys: ['D'],
        simplifiedChordLyrics: 'La',
        tempo: ['Fast'],
        themes: ['Joy'],
        timeSignature: ['4/4'],
        title: 'Title',
        year: '2020',
      };
      const res = await call(createSong, {
        body: { ...allowed, createdBy: 'x', isDeleted: true, isVerified: true, lastUpdatedBy: 'y' },
      });
      assert.deepEqual(create.mock.calls[0]?.arguments, [allowed]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, song);
    });
  });

  describe('getSong', () => {
    it('rejects an invalid id before querying', async () => {
      const findOne = mock.method(Song, 'findOne', () => execResult(null));
      for (const id of ['bad', '', [SONG_ID], { $gt: '' }]) {
        const res = await call(getSong, { query: { id } });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Invalid song id');
      }
      assert.equal(findOne.mock.callCount(), 0);
    });

    it('returns 404 when the song is missing', async () => {
      const findOne = mock.method(Song, 'findOne', () => execResult(null));
      const res = await call(getSong, { query: { id: SONG_ID } });
      assert.deepEqual(findOne.mock.calls[0]?.arguments, [{ _id: SONG_ID, isDeleted: false }]);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Song not found');
    });

    it('returns the song', async () => {
      const song = { _id: SONG_ID };
      mock.method(Song, 'findOne', () => execResult(song));
      const res = await call(getSong, { query: { id: SONG_ID } });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, song);
    });

    it('lists every live song, even when empty', async () => {
      const find = mock.method(Song, 'find', () => execResult([]));
      const res = await call(getSong, {});
      assert.deepEqual(find.mock.calls[0]?.arguments, [{ isDeleted: false }]);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, []);
    });
  });

  describe('searchSongs', () => {
    it('rejects keyword and code that are too long or not strings', async () => {
      const { find } = stubSearch();
      for (const query of [
        { keyword: 'a'.repeat(101) },
        { keyword: ['a'] },
        { keyword: { $ne: '' } },
        { code: 'c'.repeat(101) },
        { code: ['c'] },
      ]) {
        const res = await call(searchSongs, { query });
        assert.equal(res.statusCode, 400, JSON.stringify(query));
        assert.equal(res.body, 'Invalid search parameters');
      }
      assert.equal(find.mock.callCount(), 0);
    });

    it('rejects tempo and themes that are not strings or string arrays', async () => {
      const { find } = stubSearch();
      for (const query of [
        { tempo: ['Fast', 'x'.repeat(101)] },
        { tempo: { $ne: '' } },
        { themes: [1] },
        { themes: 'x'.repeat(101) },
      ]) {
        const res = await call(searchSongs, { query });
        assert.equal(res.statusCode, 400, JSON.stringify(query));
      }
      assert.equal(find.mock.callCount(), 0);
    });

    it('accepts a 100-character keyword', async () => {
      stubSearch();
      const res = await call(searchSongs, { query: { keyword: 'a'.repeat(100) } });
      assert.equal(res.statusCode, 200);
    });

    it('searches only live songs by title with defaults when no filters are sent', async () => {
      const songs = [{ _id: SONG_ID }];
      const { countDocuments, find, limit, skip, sort } = stubSearch(songs, 45);
      const res = await call(searchSongs, { query: { keyword: '', tempo: '', themes: '' } });
      assert.deepEqual(find.mock.calls[0]?.arguments, [{ isDeleted: false }]);
      assert.deepEqual(countDocuments.mock.calls[0]?.arguments, [{ isDeleted: false }]);
      assert.deepEqual(sort.mock.calls[0]?.arguments, ['title']);
      assert.deepEqual(skip.mock.calls[0]?.arguments, [0]);
      assert.deepEqual(limit.mock.calls[0]?.arguments, [20]);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { currentPage: 1, data: songs, totalCount: 45, totalPages: 3 });
    });

    it('builds escaped, case-insensitive title/code matches and $in filters', async () => {
      const { find } = stubSearch();
      await call(searchSongs, {
        query: { code: 'S(1)', keyword: 'a.b*', tempo: 'Fast', themes: ['Joy', 'Hope'] },
      });
      assert.deepEqual(find.mock.calls[0]?.arguments, [
        {
          $or: [
            { title: { $options: 'i', $regex: 'a\\.b\\*' } },
            { code: { $options: 'i', $regex: 'S\\(1\\)' } },
          ],
          isDeleted: false,
          tempo: { $in: ['Fast'] },
          themes: { $in: ['Joy', 'Hope'] },
        },
      ]);
    });

    it('sorts by code only when sortBy is code', async () => {
      const { sort } = stubSearch();
      await call(searchSongs, { query: { sortBy: 'code' } });
      await call(searchSongs, { query: { sortBy: 'artist' } });
      assert.deepEqual(
        sort.mock.calls.map((c) => c.arguments),
        [['code'], ['title']]
      );
    });

    it('parses page and limit into positive integers, defaulting invalid values', async () => {
      const cases: Array<[Record<string, unknown>, number, number, number]> = [
        [{ limit: '10', page: '3' }, 3, 20, 10],
        [{ limit: '100', page: '1' }, 1, 0, 100],
        [{ limit: '500', page: '1' }, 1, 0, 100],
        [{ limit: '0', page: '0' }, 1, 0, 20],
        [{ limit: 'abc', page: 'abc' }, 1, 0, 20],
        [{ limit: '-5', page: '-2' }, 1, 0, 20],
        [{ limit: '0.5', page: '0.5' }, 1, 0, 20],
        [{ limit: '7.9', page: '2.7' }, 2, 7, 7],
        [{ limit: 'Infinity', page: 'Infinity' }, 1, 0, 20],
        [{ limit: '1e400', page: '1e400' }, 1, 0, 20],
        [{ limit: ['5'], page: { $gt: 1 } }, 1, 0, 20],
      ];
      for (const [query, currentPage, skipped, limited] of cases) {
        mock.restoreAll();
        mock.method(console, 'error', () => undefined);
        const { limit, skip } = stubSearch([], 15);
        const res = await call(searchSongs, { query });
        assert.deepEqual(skip.mock.calls[0]?.arguments, [skipped], JSON.stringify(query));
        assert.deepEqual(limit.mock.calls[0]?.arguments, [limited], JSON.stringify(query));
        assert.deepEqual(res.body, {
          currentPage,
          data: [],
          totalCount: 15,
          totalPages: Math.ceil(15 / limited),
        });
      }
    });

    it('maps a query failure to a generic 500', async () => {
      mock.method(Song, 'find', () => ({
        sort: () => ({ skip: () => ({ limit: () => rejectedExec(new Error('db down')) }) }),
      }));
      const res = await call(searchSongs, {});
      assert.equal(res.statusCode, 500);
      assert.equal(res.body, 'Something went wrong');
    });
  });

  describe('getSongView', () => {
    it('lists live songs with the public view projection', async () => {
      const select = mock.fn(() => execResult([]));
      const find = mock.method(Song, 'find', () => ({ select }));
      const res = await call(getSongView, {});
      assert.deepEqual(find.mock.calls[0]?.arguments, [{ isDeleted: false }]);
      assert.deepEqual(select.mock.calls[0]?.arguments, [
        '_id title tempo originalKey themes artist year code isVerified isDeleted createdAt updatedAt simplifiedChordLyrics timeSignature',
      ]);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, []);
    });
  });

  describe('updateSong', () => {
    it('rejects a missing or invalid id, or no allowed fields', async () => {
      const update = mock.method(Song, 'findOneAndUpdate', async () => ({ _id: SONG_ID }));
      for (const body of [
        undefined,
        { title: 'T' },
        { id: 'bad', title: 'T' },
        { id: 'aaaaaaaaaaaa', title: 'T' },
        { id: SONG_ID },
        { id: SONG_ID, isVerified: true },
      ]) {
        const res = await call(updateSong, { body });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(update.mock.callCount(), 0);
    });

    it('updates allowed fields and returns the updated song', async () => {
      const song = { _id: SONG_ID, title: 'T' };
      const update = mock.method(Song, 'findOneAndUpdate', async () => song);
      const res = await call(updateSong, {
        body: { id: SONG_ID, isDeleted: false, isVerified: true, title: 'T' },
      });
      assert.deepEqual(update.mock.calls[0]?.arguments, [
        { _id: SONG_ID, isDeleted: false },
        { $set: { title: 'T' } },
        { new: true, runValidators: true },
      ]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, song);
    });

    it('returns 404 when no live song matches', async () => {
      mock.method(Song, 'findOneAndUpdate', async () => null);
      const res = await call(updateSong, { body: { id: SONG_ID, title: 'T' } });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Song not found');
    });

    it('maps an update failure to a generic 500', async () => {
      mock.method(Song, 'findOneAndUpdate', async () => {
        throw new Error('db down');
      });
      const res = await call(updateSong, { body: { id: SONG_ID, title: 'T' } });
      assert.equal(res.statusCode, 500);
      assert.equal(res.body, 'Something went wrong');
    });
  });

  describe('deleteSong', () => {
    it('rejects bodies without a valid id or params.id', async () => {
      const updateOne = mock.method(Song, 'updateOne', async () => ({ matchedCount: 1 }));
      for (const body of [
        undefined,
        {},
        { params: null },
        { params: {} },
        { id: 'bad' },
        { id: 'aaaaaaaaaaaa' },
        { params: { id: 'bad' } },
        { id: 'bad', params: { id: 'bad' } },
      ]) {
        const res = await call(deleteSong, { body });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(updateOne.mock.callCount(), 0);
    });

    it('soft-deletes the song', async () => {
      const updateOne = mock.method(Song, 'updateOne', async () => ({ matchedCount: 1 }));
      const res = await call(deleteSong, { body: { id: SONG_ID } });
      assert.deepEqual(updateOne.mock.calls[0]?.arguments, [
        { _id: SONG_ID, isDeleted: false },
        { $set: { isDeleted: true } },
      ]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, 'Song successfully deleted');
    });

    it('accepts params.id, preferring whichever of params.id and id is valid', async () => {
      const updateOne = mock.method(Song, 'updateOne', async () => ({ matchedCount: 1 }));
      const bodies = [
        { params: { id: SONG_ID } },
        { id: OTHER_SONG_ID, params: { id: SONG_ID } },
        { id: SONG_ID, params: { id: 'bad' } },
        { id: SONG_ID, params: null },
      ];
      for (const body of bodies) {
        const res = await call(deleteSong, { body });
        assert.equal(res.statusCode, 200, JSON.stringify(body));
      }
      assert.deepEqual(
        updateOne.mock.calls.map((c) => c.arguments[0]),
        bodies.map(() => ({ _id: SONG_ID, isDeleted: false }))
      );
    });

    it('returns 404 when no live song matches', async () => {
      mock.method(Song, 'updateOne', async () => ({ matchedCount: 0 }));
      const res = await call(deleteSong, { body: { id: SONG_ID } });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Song not found');
    });
  });
});
