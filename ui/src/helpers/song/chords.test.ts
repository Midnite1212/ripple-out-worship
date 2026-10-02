import {
  getColor,
  getInitialSongKey,
  getNoteIndex,
  getRootNote,
  getSetlistStartingKey,
  getTransposeOffset,
  searchChordColor,
  transposeChord,
} from './chords';

const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const transposeTo = (chord: string, songKey: string, changeKey: number, useFlat: boolean) =>
  transposeChord(chord, getTransposeOffset(songKey, changeKey), useFlat);

describe('getNoteIndex', () => {
  it.each([
    ['C', 0],
    ['C#', 1],
    ['Db', 1],
    ['D#', 3],
    ['Eb', 3],
    ['F#', 6],
    ['Gb', 6],
    ['A#', 10],
    ['Bb', 10],
    ['B', 11],
  ])('maps %s to %i', (note, index) => {
    expect(getNoteIndex(note)).toBe(index);
  });

  it.each(['H', 'c', 'Cb', 'E#', 'B#', 'Fb', ''])('returns -1 for %p', (note) => {
    expect(getNoteIndex(note)).toBe(-1);
  });
});

describe('getRootNote', () => {
  it.each([
    ['C', 'C'],
    ['Cmaj7', 'C'],
    ['F#m7', 'F#'],
    ['Bbadd9', 'Bb'],
    ['Gsus4', 'G'],
    ['Ebm', 'Eb'],
    ['e', 'E'],
    ['bb', 'Bb'],
    ['c#m', 'C#'],
    ['bm', 'B'],
    ['Chorus', 'C'],
    ['Bass', 'B'],
  ])('reads the root of %p as %p', (chord, root) => {
    expect(getRootNote(chord)).toBe(root);
  });

  it.each(['N.C.', 'x2', '', ' ', ' C', '/E', 'H7', 'Cb', 'E#', 'B#m', 'Fb'])(
    'returns undefined for %p',
    (chord) => {
      expect(getRootNote(chord)).toBeUndefined();
    }
  );
});

describe('getTransposeOffset', () => {
  it.each([
    ['C', 0, 0],
    ['C', 2, 2],
    ['G', 7, 0],
    ['G', 0, 5],
    ['G', 9, 2],
    ['Bb', 10, 0],
    ['Bb', 0, 2],
    ['A#', 10, 0],
    ['Eb', 3, 0],
    ['Eb', 1, 10],
    ['F#', 6, 0],
    ['Gb', 6, 0],
    ['F#', 11, 5],
  ])('song in %s viewed at index %i shifts by %i', (originalKey, changeKey, offset) => {
    expect(getTransposeOffset(originalKey, changeKey)).toBe(offset);
  });

  it('treats an undefined key as C', () => {
    expect(getTransposeOffset(undefined, 4)).toBe(4);
  });

  it.each([
    ['', 0, 1],
    ['H', 0, 1],
    ['Am', 0, 1],
    ['Am', 11, 12],
  ])(
    'treats unknown key %p as index -1 (changeKey %i gives %i)',
    (originalKey, changeKey, offset) => {
      expect(getTransposeOffset(originalKey, changeKey)).toBe(offset);
    }
  );
});

describe('transposeChord', () => {
  describe.each(['C', 'G', 'Bb', 'Eb', 'F#'])('song in %s', (songKey) => {
    it.each(SHARP_SCALE.map((_, changeKey) => changeKey))(
      'transposes the tonic to index %i with sharp and flat spelling',
      (changeKey) => {
        expect(transposeTo(songKey, songKey, changeKey, false)).toBe(SHARP_SCALE[changeKey]);
        expect(transposeTo(songKey, songKey, changeKey, true)).toBe(FLAT_SCALE[changeKey]);
      }
    );

    it('moves every semitone up and down from the original key', () => {
      const startIndex = getNoteIndex(songKey);
      for (let step = 1; step <= 11; step++) {
        const upIndex = (startIndex + step) % 12;
        const downIndex = (startIndex - step + 12) % 12;
        expect(transposeTo(songKey, songKey, upIndex, false)).toBe(SHARP_SCALE[upIndex]);
        expect(transposeTo(songKey, songKey, downIndex, false)).toBe(SHARP_SCALE[downIndex]);
        expect(transposeTo(songKey, songKey, upIndex, true)).toBe(FLAT_SCALE[upIndex]);
        expect(transposeTo(songKey, songKey, downIndex, true)).toBe(FLAT_SCALE[downIndex]);
      }
    });
  });

  it('keeps chords in place at offset 0 except for the spelling toggle', () => {
    expect(transposeChord('C#', 0, false)).toBe('C#');
    expect(transposeChord('C#', 0, true)).toBe('Db');
    expect(transposeChord('Db', 0, false)).toBe('C#');
    expect(transposeChord('Bb', 0, false)).toBe('A#');
    expect(transposeChord('Bb', 0, true)).toBe('Bb');
    expect(transposeChord('F#', 0, true)).toBe('Gb');
    expect(transposeChord('Eb', 0, false)).toBe('D#');
  });

  it('wraps an offset of 12 back to the same note', () => {
    expect(transposeChord('A', 12, false)).toBe('A');
  });

  it.each([
    ['C/E', 2, false, 'D/F#'],
    ['C/E', 2, true, 'D/Gb'],
    ['D/F#', 0, false, 'D/F#'],
    ['D/F#', 2, false, 'E/G#'],
    ['D/F#', 2, true, 'E/Ab'],
    ['G/B', 5, false, 'C/E'],
    ['G/B', 3, true, 'Bb/D'],
    ['G/B', 3, false, 'A#/D'],
    ['C/e', 2, false, 'D/F#'],
    ['Am7/G', 2, false, 'Bm7/A'],
  ])('transposes slash chord %s by %i (flat %p) to %s', (chord, offset, useFlat, expected) => {
    expect(transposeChord(chord, offset, useFlat)).toBe(expected);
  });

  it.each([
    ['F#m7', 1, false, 'Gm7'],
    ['F#m7', 0, true, 'Gbm7'],
    ['F#m7', 4, false, 'A#m7'],
    ['F#m7', 4, true, 'Bbm7'],
    ['Cmaj7', 3, false, 'D#maj7'],
    ['Cmaj7', 3, true, 'Ebmaj7'],
    ['Gsus4', 2, false, 'Asus4'],
    ['Gsus4', 11, true, 'Gbsus4'],
    ['Bbadd9', 2, false, 'Cadd9'],
    ['Bbadd9', 0, false, 'A#add9'],
    ['Bbadd9', 1, true, 'Badd9'],
  ])('keeps the suffix of %s when shifting by %i (flat %p)', (chord, offset, useFlat, expected) => {
    expect(transposeChord(chord, offset, useFlat)).toBe(expected);
  });

  it.each(['N.C.', 'x2', '', '/E', ' ', ' C', 'H7', 'Cb', 'E#', '1/2'])(
    'returns %p unchanged',
    (chord) => {
      expect(transposeChord(chord, 5, false)).toBe(chord);
      expect(transposeChord(chord, 5, true)).toBe(chord);
    }
  );

  it('keeps a non-note bass unchanged', () => {
    expect(transposeChord('C/x', 2, false)).toBe('D/x');
    expect(transposeChord('C/Cb', 2, false)).toBe('D/Cb');
  });

  it('uppercases a lowercase root', () => {
    expect(transposeChord('c', 2, false)).toBe('D');
    expect(transposeChord('am', 0, false)).toBe('Am');
  });

  it('drops everything after a second slash', () => {
    expect(transposeChord('C/E/G', 2, false)).toBe('D/F#');
  });

  it('drops a trailing slash with no bass', () => {
    expect(transposeChord('C/', 2, false)).toBe('D');
  });

  it('transposes words that start with a note letter', () => {
    expect(transposeChord('Chorus', 2, false)).toBe('Dhorus');
    expect(transposeChord('bridge', 1, false)).toBe('Cridge');
  });
});

describe('searchChordColor', () => {
  it('matches ChordColors keys case-insensitively', () => {
    expect(searchChordColor('Bb')).toBe('#992E00');
    expect(searchChordColor('bb')).toBe('#992E00');
    expect(searchChordColor('F#M')).toBe('#1D309D');
  });

  it('returns undefined for keys it does not know', () => {
    expect(searchChordColor('Cmaj')).toBeUndefined();
    expect(searchChordColor('')).toBeUndefined();
  });
});

describe('getColor', () => {
  it.each([
    ['C', '#874F00'],
    ['Cm', '#874F00'],
    ['C#', '#874F00'],
    ['Db', '#255C0D'],
    ['Eb', '#045C7A'],
    ['F#m7', '#1D309D'],
    ['Gb', '#471383'],
    ['Gsus4', '#471383'],
    ['Ab', '#840000'],
    ['Bbadd9', '#992E00'],
    ['D/F#', '#255C0D'],
    ['Cmaj7', '#874F00'],
  ])('colours %s as %s', (chord, colour) => {
    expect(getColor(chord)).toBe(colour);
  });

  it.each(['N.C.', 'x2', '', ' ', 'c', 'am', 'H', 'E#', 'Cb', '/E'])(
    'returns undefined for %p',
    (chord) => {
      expect(getColor(chord)).toBeUndefined();
    }
  );
});

describe('getInitialSongKey', () => {
  it.each([
    ['C', false, 0],
    ['G', false, 7],
    ['F#', false, 6],
    ['C#', false, 1],
    ['Bb', true, 10],
    ['Eb', true, 3],
    ['Ab', true, 8],
  ])('starts a song in %s with isFlat %p at index %i', (originalKey, isFlat, keyIndex) => {
    expect(getInitialSongKey(originalKey)).toEqual({ isFlat, keyIndex });
  });

  it('defaults an undefined key to C', () => {
    expect(getInitialSongKey(undefined)).toEqual({ isFlat: false, keyIndex: 0 });
  });

  it.each([
    ['', false],
    ['H', false],
    ['Am', false],
    ['Bbm', true],
    ['b', false],
  ])('falls back to index 0 for unknown key %p (isFlat %p)', (originalKey, isFlat) => {
    expect(getInitialSongKey(originalKey)).toEqual({ isFlat, keyIndex: 0 });
  });
});

describe('getSetlistStartingKey', () => {
  it.each([
    ['C', false, 0],
    ['G', false, 7],
    ['F#', false, 6],
    ['Bb', true, 10],
    ['Eb', true, 3],
    ['Db', true, 1],
  ])('starts a setlist song in %s with isFlat %p at index %i', (startingKey, isFlat, keyIndex) => {
    expect(getSetlistStartingKey(startingKey)).toEqual({ isFlat, keyIndex });
  });

  it.each([
    ['H', false],
    ['Am', false],
    ['Bbm', false],
    ['b', true],
  ])('falls back to index 0 for unknown key %p (isFlat %p)', (startingKey, isFlat) => {
    expect(getSetlistStartingKey(startingKey)).toEqual({ isFlat, keyIndex: 0 });
  });
});
