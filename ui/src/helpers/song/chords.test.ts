import {
  getColor,
  getInitialSongKey,
  getNoteIndex,
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
    ['', 0, 0],
    ['', 4, 4],
    ['H', 0, 0],
    ['H', 11, 11],
    ['Cb', 0, 0],
    ['am', 0, 0],
    ['Amaj', 2, 2],
  ])('treats unknown key %p as C (changeKey %i gives %i)', (originalKey, changeKey, offset) => {
    expect(getTransposeOffset(originalKey, changeKey)).toBe(offset);
  });

  it.each([
    ['Am', 9, 0],
    ['Am', 0, 3],
    ['Am', 11, 2],
    ['Bbm', 10, 0],
    ['F#m', 6, 0],
    ['Ebm', 5, 2],
  ])('reads minor key %p by its root (changeKey %i gives %i)', (originalKey, changeKey, offset) => {
    expect(getTransposeOffset(originalKey, changeKey)).toBe(offset);
  });

  it('starts every key-init result at offset 0', () => {
    ['C', 'G', 'Bb', 'Am', 'Bbm', '', 'H', 'b'].forEach((key) => {
      expect(getTransposeOffset(key, getInitialSongKey(key).keyIndex)).toBe(0);
      expect(getTransposeOffset(key, getSetlistStartingKey(key).keyIndex)).toBe(0);
    });
  });
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
    ['Am7/G', 2, false, 'Bm7/A'],
    ['Bbmaj7/D', 2, true, 'Cmaj7/E'],
    ['Gsus4/Bb', 0, false, 'Gsus4/A#'],
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
    ['Cmin7', 2, false, 'Dmin7'],
    ['Cdim7', 1, true, 'Dbdim7'],
    ['C°', 2, false, 'D°'],
    ['Bø7', 1, false, 'Cø7'],
    ['C+', 2, false, 'D+'],
    ['Caug', 2, false, 'Daug'],
    ['Cm7b5', 2, false, 'Dm7b5'],
    ['G7b9', 2, false, 'A7b9'],
    ['G7#9', 2, true, 'A7#9'],
    ['Cmmaj7', 2, false, 'Dmmaj7'],
    ['A7sus4', 2, false, 'B7sus4'],
    ['Csus', 2, false, 'Dsus'],
    ['C13', 2, false, 'D13'],
    ['Dadd', 2, false, 'Eadd'],
    ['CM7', 2, false, 'DM7'],
    ['CM9', 1, true, 'DbM9'],
    ['FmM7', 2, false, 'GmM7'],
    ['C6/9', 2, false, 'D6/9'],
    ['C69', 2, false, 'D69'],
    ['Bb6/9', 2, true, 'C6/9'],
    ['C7(b9)', 2, false, 'D7(b9)'],
    ['Cm(maj7)', 1, true, 'Dbm(maj7)'],
    ['C(add9)', 2, false, 'D(add9)'],
    ['G7(b9,#11)', 2, false, 'A7(b9,#11)'],
  ])('keeps the suffix of %s when shifting by %i (flat %p)', (chord, offset, useFlat, expected) => {
    expect(transposeChord(chord, offset, useFlat)).toBe(expected);
  });

  it.each([
    ['C6/9/E', 2, false, 'D6/9/F#'],
    ['C7(b9)/E', 2, true, 'D7(b9)/Gb'],
  ])('transposes %s with a bass after the extension', (chord, offset, useFlat, expected) => {
    expect(transposeChord(chord, offset, useFlat)).toBe(expected);
  });

  it.each([
    ['G ', 2, 'A '],
    [' Am', 2, ' Bm'],
    ['  C/E ', 2, '  D/F# '],
    ['\tF#m7', 1, '\tGm7'],
  ])('transposes %p and keeps its spacing', (chord, offset, expected) => {
    expect(transposeChord(chord, offset, false)).toBe(expected);
  });

  it.each([
    ['am', 0, false, 'Am'],
    ['am', 2, false, 'Bm'],
    ['c', 2, false, 'D'],
    ['c#m7', 1, false, 'Dm7'],
    ['bb', 0, true, 'Bb'],
    ['eb', 2, false, 'F'],
    ['gsus4', 2, false, 'Asus4'],
    ['C/e', 2, false, 'D/F#'],
    ['d/f#', 0, true, 'D/Gb'],
    [' em7 ', 2, false, ' F#m7 '],
  ])('uppercases the root of lowercase chord %p', (chord, offset, useFlat, expected) => {
    expect(transposeChord(chord, offset, useFlat)).toBe(expected);
  });

  it.each([
    'N.C.',
    'x2',
    '',
    '/E',
    ' ',
    'H7',
    'Cb',
    'cb',
    'E#',
    'B#m',
    'Fb7',
    '1/2',
    'C/x',
    'C/Cb',
    'C/E/G',
    'C/',
    'C 7',
    'C()',
    'C7(b9',
    'Cm(maj7))',
    'C6/',
    'Chorus',
    'chorus',
    'bridge',
    'Bridge',
    'Bass',
    'bass',
    'Ending',
    'Gm7x',
    'Amazing',
    'add',
    'a capella',
    'be',
    'dad',
  ])('returns %p unchanged', (chord) => {
    expect(transposeChord(chord, 5, false)).toBe(chord);
    expect(transposeChord(chord, 5, true)).toBe(chord);
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
    ['Bbmaj7', '#992E00'],
    ['Abmin7', '#840000'],
    ['CM7', '#874F00'],
    ['C7(b9)', '#874F00'],
    ['Bb6/9', '#992E00'],
    [' G ', '#471383'],
    ['c', '#874F00'],
    ['am', '#840000'],
    ['bb', '#992E00'],
  ])('colours %p as %s', (chord, colour) => {
    expect(getColor(chord)).toBe(colour);
  });

  it.each([
    'N.C.',
    'x2',
    '',
    ' ',
    'H',
    'E#',
    'Cb',
    '/E',
    'Chorus',
    'Bridge',
    'bridge',
    'Ending',
    'Amazing',
    'add',
    'C/E/G',
    'C/x',
  ])('returns undefined for %p', (chord) => {
    expect(getColor(chord)).toBeUndefined();
  });

  describe('with distinct major and minor colours', () => {
    let isolatedGetColor: typeof getColor;

    beforeAll(() => {
      jest.isolateModules(() => {
        jest.doMock('../../constants', () => ({
          ...jest.requireActual('../../constants'),
          ChordColors: { C: 'major', Cm: 'minor', Bb: 'flat major', Bbm: 'flat minor' },
        }));
        ({ getColor: isolatedGetColor } = jest.requireActual('./chords'));
      });
    });

    it.each([
      ['C', 'major'],
      ['Cmaj7', 'major'],
      ['Cmaj', 'major'],
      ['CM7', 'major'],
      ['C/E', 'major'],
      ['Cm', 'minor'],
      ['Cm7', 'minor'],
      ['Cmin7', 'minor'],
      ['Cmmaj7', 'minor'],
      ['Cm(maj7)', 'minor'],
      ['CmM7', 'minor'],
      ['C(add9)', 'major'],
      ['cm7', 'minor'],
      ['Bbmaj7', 'flat major'],
      ['Bbm7b5', 'flat minor'],
    ])('reads %s as %s', (chord, colour) => {
      expect(isolatedGetColor(chord)).toBe(colour);
    });
  });
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
    ['b', false],
    ['am', false],
    ['Cb', true],
  ])('falls back to index 0 for unknown key %p (isFlat %p)', (originalKey, isFlat) => {
    expect(getInitialSongKey(originalKey)).toEqual({ isFlat, keyIndex: 0 });
  });

  it.each([
    ['Am', false, 9],
    ['Bbm', true, 10],
    ['F#m', false, 6],
    ['Ebm', true, 3],
  ])('starts a song in minor key %s at its root (isFlat %p, index %i)', (key, isFlat, keyIndex) => {
    expect(getInitialSongKey(key)).toEqual({ isFlat, keyIndex });
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
    ['', false],
    ['H', false],
    ['b', false],
    ['am', false],
    ['Cb', true],
  ])('falls back to index 0 for unknown key %p (isFlat %p)', (startingKey, isFlat) => {
    expect(getSetlistStartingKey(startingKey)).toEqual({ isFlat, keyIndex: 0 });
  });

  it.each(['C', 'G', 'F#', 'Bb', 'Eb', 'Am', 'Bbm', '', 'H', 'b', 'Cb'])(
    'agrees with getInitialSongKey for %p',
    (key) => {
      expect(getSetlistStartingKey(key)).toEqual(getInitialSongKey(key));
    }
  );
});
