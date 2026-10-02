import { ChordColors, flatMusicKeysOptions, sharpMusicKeysOptions } from '../../constants';

const NOTE = '[A-Ga-g][#b]?';
const QUALITY_TOKEN = 'maj|min|dim|aug|sus|add|M|m|°|ø|\\+|6\\/9|[#b]?\\d+';
const QUALITY = `(?:${QUALITY_TOKEN}|\\((?:${QUALITY_TOKEN}|,)+\\))*`;
const CHORD_PATTERN = new RegExp(`^(\\s*)(${NOTE})(${QUALITY})(?:\\/(${NOTE}))?(\\s*)$`);

const KEY_PATTERN = /^([A-G][#b]?)m?$/;

export const getNoteIndex = (note: string) =>
  flatMusicKeysOptions.indexOf(note) === -1
    ? sharpMusicKeysOptions.indexOf(note)
    : flatMusicKeysOptions.indexOf(note);

const normaliseNote = (note: string) => note[0].toUpperCase() + note.slice(1);

const parseChord = (chord: string) => {
  const match = chord.match(CHORD_PATTERN);
  if (!match) return undefined;

  const [, leading, root, quality, bass, trailing] = match;
  const parsed = {
    leading,
    root: normaliseNote(root),
    quality,
    bass: bass ? normaliseNote(bass) : undefined,
    trailing,
  };
  if (getNoteIndex(parsed.root) === -1 || (parsed.bass && getNoteIndex(parsed.bass) === -1)) {
    return undefined;
  }
  return parsed;
};

export const searchChordColor = (chord: string): string | undefined => {
  const chordKey = Object.keys(ChordColors).find(
    (key) => key.toLowerCase() === chord.toLowerCase()
  );
  return chordKey ? ChordColors[chordKey] : undefined;
};

export const getColor = (chord: string) => {
  const parsed = parseChord(chord);
  if (!parsed) return undefined;

  const isMinor = /^m(?!aj)/.test(parsed.quality);
  return searchChordColor(isMinor ? `${parsed.root}m` : parsed.root);
};

const parseSongKey = (key: string | undefined) => {
  const root = key?.match(KEY_PATTERN)?.[1];
  return {
    isFlat: key?.[1] === 'b',
    keyIndex: root ? Math.max(0, getNoteIndex(root)) : 0,
  };
};

export const getTransposeOffset = (originalKey: string | undefined, changeKey: number) => {
  const chordDifference = changeKey - parseSongKey(originalKey).keyIndex;
  return chordDifference < 0 ? chordDifference + 12 : chordDifference;
};

export const transposeChord = (chord: string, transpossedChordIndex: number, useFlat: boolean) => {
  const parsed = parseChord(chord);
  if (!parsed) return chord;

  const { leading, root, quality, bass, trailing } = parsed;
  const transposeNote = (note: string) =>
    (useFlat ? flatMusicKeysOptions : sharpMusicKeysOptions)[
      (getNoteIndex(note) + transpossedChordIndex) % 12
    ];

  return (
    leading + transposeNote(root) + quality + (bass ? `/${transposeNote(bass)}` : '') + trailing
  );
};

export const getInitialSongKey = (originalKey: string | undefined) => parseSongKey(originalKey);

export const getSetlistStartingKey = (startingKey: string) => parseSongKey(startingKey);
