import { ChordColors, flatMusicKeysOptions, sharpMusicKeysOptions } from '../../constants';

export const searchChordColor = (chord: string): string | undefined => {
  const chordKey = Object.keys(ChordColors).find(
    (key) => key.toLowerCase() === chord.toLowerCase()
  );
  return chordKey ? ChordColors[chordKey] : undefined;
};

export const getColor = (chord: string) => {
  const chordPattern = /^([A-G][#b]?)(m)?/;
  const match = chord.match(chordPattern);

  if (!match) return undefined;

  const rootNote = match[1];
  const isMinor = match[2] === 'm';

  const baseChord = isMinor ? `${rootNote}m` : rootNote;

  return searchChordColor(baseChord);
};

export const getNoteIndex = (note: string) =>
  flatMusicKeysOptions.indexOf(note) === -1
    ? sharpMusicKeysOptions.indexOf(note)
    : flatMusicKeysOptions.indexOf(note);

export const getRootNote = (note: string): string | undefined => {
  if (!/^[A-Ga-g]/.test(note)) return undefined;
  const root = note.length > 1 && ['#', 'b'].includes(note[1]) ? note.slice(0, 2) : note[0];
  const normalisedRoot = root[0].toUpperCase() + root.slice(1);
  return getNoteIndex(normalisedRoot) === -1 ? undefined : normalisedRoot;
};

export const getTransposeOffset = (originalKey: string | undefined, changeKey: number) => {
  const originalChordIndex =
    sharpMusicKeysOptions.indexOf(originalKey ?? 'C') === -1
      ? flatMusicKeysOptions.indexOf(originalKey ?? 'C')
      : sharpMusicKeysOptions.indexOf(originalKey ?? 'C');
  const chordDifference = changeKey - originalChordIndex;
  return chordDifference < 0 ? chordDifference + 12 : chordDifference;
};

export const transposeChord = (chord: string, transpossedChordIndex: number, useFlat: boolean) => {
  const transposeRoot = (root: string) =>
    (useFlat ? flatMusicKeysOptions : sharpMusicKeysOptions)[
      (getNoteIndex(root) + transpossedChordIndex) % 12
    ];

  const chordParts = chord.split('/');
  const baseChord = chordParts[0];
  const bassNote = chordParts[1];

  let transpossedChord = chord;
  const baseRoot = getRootNote(baseChord);
  if (baseRoot) {
    transpossedChord = transposeRoot(baseRoot) + baseChord.slice(baseRoot.length);
    if (bassNote) {
      const bassRoot = getRootNote(bassNote);
      transpossedChord += '/' + (bassRoot ? transposeRoot(bassRoot) : bassNote);
    }
  }
  return transpossedChord;
};

export const getInitialSongKey = (originalKey: string | undefined) => {
  const key = originalKey ?? 'C';
  const isFlat = key[1] === 'b';
  return {
    isFlat,
    keyIndex: Math.max(0, (isFlat ? flatMusicKeysOptions : sharpMusicKeysOptions).indexOf(key)),
  };
};

export const getSetlistStartingKey = (startingKey: string) => {
  const isFlat = startingKey.endsWith('b');
  const keyOptions = isFlat ? flatMusicKeysOptions : sharpMusicKeysOptions;
  return { isFlat, keyIndex: Math.max(0, keyOptions.indexOf(startingKey)) };
};
