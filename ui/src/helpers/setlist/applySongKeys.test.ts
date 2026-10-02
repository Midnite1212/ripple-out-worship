import { Setlist } from '../../types/setlist.types';
import { SongSetlistSchema } from '../../types/song.types';
import { User } from '../../types/user.types';
import { applySongKeys } from './applySongKeys';

const testUser: User = {
  fullName: 'Test User',
  email: 'test@example.com',
  id: 'u1',
  isDeleted: false,
  emailStatus: '',
  countryOfOrigin: '',
  address: '',
  birthday: '',
  campus: '',
  lifestage: '',
  lifeGroup: '',
  isMember: false,
  isBaptised: false,
  ministryTeam: '',
  phoneNumber: 0,
  hasFilledProfileForm: false,
};

const makeSong = (id: string, originalKey: string, key = ''): SongSetlistSchema => ({
  _id: id,
  title: `Song ${id}`,
  timeSignature: ['4/4'],
  tempo: ['Fast'],
  originalKey,
  themes: [],
  artist: 'Artist',
  year: '2020',
  code: `A${id}`,
  createdBy: testUser,
  lastUpdatedBy: testUser,
  isVerified: true,
  chordLyrics: '[C]Hello',
  isDeleted: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  simplifiedChordLyrics: '',
  recommendedKeys: [],
  key,
  sequence: 0,
});

const makeSetlist = (overrides: Partial<Setlist>): Setlist => ({
  _id: 'setlist-1',
  name: 'Sunday',
  date: '2026-10-04',
  songs: [],
  groupIds: ['g1'],
  publicLink: 'abc',
  createdAt: '2026-10-01',
  lastUpdatedBy: 'u1',
  isDeleted: false,
  ...overrides,
});

const keysOf = (setlist: Setlist) => setlist.songs.map(({ _id, key }) => [_id, key]);

describe('applySongKeys', () => {
  it('uses the matching songKeys entry for each song', () => {
    const setlist = makeSetlist({
      songs: [makeSong('1', 'C'), makeSong('2', 'G')],
      songKeys: [
        { songId: '2', key: 'A' },
        { songId: '1', key: 'Eb' },
      ],
    });
    expect(keysOf(applySongKeys(setlist))).toEqual([
      ['1', 'Eb'],
      ['2', 'A'],
    ]);
  });

  it('falls back to originalKey for songs without an entry', () => {
    const setlist = makeSetlist({
      songs: [makeSong('1', 'C'), makeSong('2', 'Bb')],
      songKeys: [{ songId: '1', key: 'D' }],
    });
    expect(keysOf(applySongKeys(setlist))).toEqual([
      ['1', 'D'],
      ['2', 'Bb'],
    ]);
  });

  it('falls back to originalKey when songKeys is missing', () => {
    const setlist = makeSetlist({ songs: [makeSong('1', 'F#')] });
    expect(keysOf(applySongKeys(setlist))).toEqual([['1', 'F#']]);
  });

  it('ignores entries for songs that are not in the setlist', () => {
    const setlist = makeSetlist({
      songs: [makeSong('1', 'C')],
      songKeys: [
        { songId: '9', key: 'E' },
        { songId: '1', key: 'G' },
      ],
    });
    const result = applySongKeys(setlist);
    expect(keysOf(result)).toEqual([['1', 'G']]);
    expect(result.songKeys).toBe(setlist.songKeys);
  });

  it('uses the first entry when a song has duplicates', () => {
    const setlist = makeSetlist({
      songs: [makeSong('1', 'C')],
      songKeys: [
        { songId: '1', key: 'D' },
        { songId: '1', key: 'E' },
      ],
    });
    expect(keysOf(applySongKeys(setlist))).toEqual([['1', 'D']]);
  });

  it('applies the same entry to a song that appears twice', () => {
    const setlist = makeSetlist({
      songs: [makeSong('1', 'C'), makeSong('1', 'C')],
      songKeys: [{ songId: '1', key: 'A' }],
    });
    expect(keysOf(applySongKeys(setlist))).toEqual([
      ['1', 'A'],
      ['1', 'A'],
    ]);
  });

  it('keeps an empty-string key from songKeys', () => {
    const setlist = makeSetlist({
      songs: [makeSong('1', 'C')],
      songKeys: [{ songId: '1', key: '' }],
    });
    expect(keysOf(applySongKeys(setlist))).toEqual([['1', '']]);
  });

  it('replaces an existing song.key with originalKey when there is no entry', () => {
    const setlist = makeSetlist({ songs: [makeSong('1', 'C', 'G')], songKeys: [] });
    expect(keysOf(applySongKeys(setlist))).toEqual([['1', 'C']]);
  });

  it.each([null, undefined, 'not-an-array'])('turns non-array songs (%p) into []', (songs) => {
    const setlist = makeSetlist({ songs: songs as unknown as SongSetlistSchema[] });
    expect(applySongKeys(setlist).songs).toEqual([]);
  });

  it('keeps every other field and does not mutate the input', () => {
    const song = makeSong('1', 'C');
    const setlist = makeSetlist({ songs: [song], songKeys: [{ songId: '1', key: 'D' }] });
    const snapshot = JSON.parse(JSON.stringify(setlist));

    const result = applySongKeys(setlist);

    expect(result).toEqual({ ...setlist, songs: [{ ...song, key: 'D' }] });
    expect(result).not.toBe(setlist);
    expect(result.songs[0]).not.toBe(song);
    expect(JSON.parse(JSON.stringify(setlist))).toEqual(snapshot);
  });
});
