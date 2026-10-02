import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { InvalidInputError } from '../db/cast';
import { SongSearch, songRepository } from '../db/repositories/song.repository';
import { FakeRequestInit, callHandler, createRequest, createResponse } from '../testing/http';
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

const stubSearch = (songs: unknown[] = [], totalCount = 0) =>
  mock.method(songRepository, 'search', async () => ({ songs, totalCount }));

const searchArgs = (search: ReturnType<typeof stubSearch>, index = 0): SongSearch | undefined =>
  search.mock.calls[index]?.arguments[0];

describe('song controllers', () => {
  beforeEach(() => {
    mock.method(console, 'error', () => undefined);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('createSong', () => {
    it('rejects a body with no allowed fields', async () => {
      const create = mock.method(songRepository, 'create', async () => ({}));
      for (const body of [undefined, {}, { createdBy: 'x', isVerified: true }]) {
        const res = await call(createSong, { body });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(create.mock.callCount(), 0);
    });

    it('creates the song from the allowed fields only', async () => {
      const song = { _id: SONG_ID };
      const create = mock.method(songRepository, 'create', async () => song);
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

    it('maps invalid field values to 400', async () => {
      mock.method(songRepository, 'create', async () => {
        throw new InvalidInputError('title');
      });
      const res = await call(createSong, { body: { title: '' } });
      assert.equal(res.statusCode, 400);
      assert.equal(res.body, 'Invalid request');
    });
  });

  describe('getSong', () => {
    it('rejects an invalid id before querying', async () => {
      const findLiveById = mock.method(songRepository, 'findLiveById', async () => null);
      for (const id of ['bad', '', [SONG_ID], { $gt: '' }]) {
        const res = await call(getSong, { query: { id } });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Invalid song id');
      }
      assert.equal(findLiveById.mock.callCount(), 0);
    });

    it('returns 404 when the song is missing', async () => {
      const findLiveById = mock.method(songRepository, 'findLiveById', async () => null);
      const res = await call(getSong, { query: { id: SONG_ID } });
      assert.deepEqual(findLiveById.mock.calls[0]?.arguments, [SONG_ID]);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Song not found');
    });

    it('returns the song', async () => {
      const song = { _id: SONG_ID };
      mock.method(songRepository, 'findLiveById', async () => song);
      const res = await call(getSong, { query: { id: SONG_ID } });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, song);
    });

    it('lists every live song, even when empty', async () => {
      const listLive = mock.method(songRepository, 'listLive', async () => []);
      const res = await call(getSong, {});
      assert.equal(listLive.mock.callCount(), 1);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, []);
    });
  });

  describe('searchSongs', () => {
    it('rejects keyword and code that are too long or not strings', async () => {
      const search = stubSearch();
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
      assert.equal(search.mock.callCount(), 0);
    });

    it('rejects tempo and themes that are not strings or string arrays', async () => {
      const search = stubSearch();
      for (const query of [
        { tempo: ['Fast', 'x'.repeat(101)] },
        { tempo: { $ne: '' } },
        { themes: [1] },
        { themes: 'x'.repeat(101) },
      ]) {
        const res = await call(searchSongs, { query });
        assert.equal(res.statusCode, 400, JSON.stringify(query));
      }
      assert.equal(search.mock.callCount(), 0);
    });

    it('accepts a 100-character keyword', async () => {
      stubSearch();
      const res = await call(searchSongs, { query: { keyword: 'a'.repeat(100) } });
      assert.equal(res.statusCode, 200);
    });

    it('searches only live songs by title with defaults when no filters are sent', async () => {
      const songs = [{ _id: SONG_ID }];
      const search = stubSearch(songs, 45);
      const res = await call(searchSongs, { query: { keyword: '', tempo: '', themes: '' } });
      assert.deepEqual(searchArgs(search), {
        code: '',
        keyword: '',
        limit: 20,
        offset: 0,
        sortBy: 'title',
        tempo: [],
        themes: [],
      });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { currentPage: 1, data: songs, totalCount: 45, totalPages: 3 });
    });

    it('passes the raw keyword and code with tempo and themes lists to the search', async () => {
      const search = stubSearch();
      await call(searchSongs, {
        query: { code: 'S(1)', keyword: 'a.b*%_', tempo: 'Fast', themes: ['Joy', 'Hope'] },
      });
      assert.deepEqual(searchArgs(search), {
        code: 'S(1)',
        keyword: 'a.b*%_',
        limit: 20,
        offset: 0,
        sortBy: 'title',
        tempo: ['Fast'],
        themes: ['Joy', 'Hope'],
      });
    });

    it('sorts by code only when sortBy is code', async () => {
      const search = stubSearch();
      await call(searchSongs, { query: { sortBy: 'code' } });
      await call(searchSongs, { query: { sortBy: 'artist' } });
      assert.deepEqual(
        search.mock.calls.map((c) => c.arguments[0]?.sortBy),
        ['code', 'title']
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
        const search = stubSearch([], 15);
        const res = await call(searchSongs, { query });
        assert.equal(searchArgs(search)?.offset, skipped, JSON.stringify(query));
        assert.equal(searchArgs(search)?.limit, limited, JSON.stringify(query));
        assert.deepEqual(res.body, {
          currentPage,
          data: [],
          totalCount: 15,
          totalPages: Math.ceil(15 / limited),
        });
      }
    });

    it('maps a query failure to a generic 500', async () => {
      mock.method(songRepository, 'search', async () => {
        throw new Error('db down');
      });
      const res = await call(searchSongs, {});
      assert.equal(res.statusCode, 500);
      assert.equal(res.body, 'Something went wrong');
    });
  });

  describe('getSongView', () => {
    it('lists live songs through the public view', async () => {
      const listLiveView = mock.method(songRepository, 'listLiveView', async () => []);
      const res = await call(getSongView, {});
      assert.equal(listLiveView.mock.callCount(), 1);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, []);
    });
  });

  describe('updateSong', () => {
    it('rejects a missing or invalid id, or no allowed fields', async () => {
      const update = mock.method(songRepository, 'updateLive', async () => ({ _id: SONG_ID }));
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
      const update = mock.method(songRepository, 'updateLive', async () => song);
      const res = await call(updateSong, {
        body: { id: SONG_ID, isDeleted: false, isVerified: true, title: 'T' },
      });
      assert.deepEqual(update.mock.calls[0]?.arguments, [SONG_ID, { title: 'T' }]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, song);
    });

    it('returns 404 when no live song matches', async () => {
      mock.method(songRepository, 'updateLive', async () => null);
      const res = await call(updateSong, { body: { id: SONG_ID, title: 'T' } });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Song not found');
    });

    it('maps an update failure to a generic 500', async () => {
      mock.method(songRepository, 'updateLive', async () => {
        throw new Error('db down');
      });
      const res = await call(updateSong, { body: { id: SONG_ID, title: 'T' } });
      assert.equal(res.statusCode, 500);
      assert.equal(res.body, 'Something went wrong');
    });
  });

  describe('deleteSong', () => {
    it('rejects bodies without a valid id or params.id', async () => {
      const softDelete = mock.method(songRepository, 'softDelete', async () => true);
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
      assert.equal(softDelete.mock.callCount(), 0);
    });

    it('soft-deletes the song', async () => {
      const softDelete = mock.method(songRepository, 'softDelete', async () => true);
      const res = await call(deleteSong, { body: { id: SONG_ID } });
      assert.deepEqual(softDelete.mock.calls[0]?.arguments, [SONG_ID]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, 'Song successfully deleted');
    });

    it('accepts params.id, preferring whichever of params.id and id is valid', async () => {
      const softDelete = mock.method(songRepository, 'softDelete', async () => true);
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
        softDelete.mock.calls.map((c) => c.arguments[0]),
        bodies.map(() => SONG_ID)
      );
    });

    it('returns 404 when no live song matches', async () => {
      mock.method(songRepository, 'softDelete', async () => false);
      const res = await call(deleteSong, { body: { id: SONG_ID } });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Song not found');
    });
  });
});
