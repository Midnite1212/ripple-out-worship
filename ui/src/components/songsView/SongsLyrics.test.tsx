import { renderToStaticMarkup } from 'react-dom/server';
import SongsLyrics from './SongsLyrics';
import { SongViewSchema } from '../../types/song.types';

const makeSong = (chordLyrics: string, originalKey: string): SongViewSchema => ({
  _id: 'song-1',
  title: 'Song',
  timeSignature: [],
  tempo: [],
  originalKey,
  themes: [],
  artist: 'Artist',
  year: '2020',
  code: 'A1',
  createdBy: {} as SongViewSchema['createdBy'],
  lastUpdatedBy: {} as SongViewSchema['lastUpdatedBy'],
  isVerified: true,
  chordLyrics,
  isDeleted: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

type RenderOptions = { changeKey: number; chordStatus?: boolean; useFlat?: boolean };

const buildLyricsDom = (song: SongViewSchema | undefined, options: RenderOptions) => {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(
    <SongsLyrics
      song={song}
      changeKey={options.changeKey}
      chordStatus={options.chordStatus ?? true}
      useFlat={options.useFlat ?? false}
      split={1}
    />
  );
  return container;
};

const chipLabels = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.MuiChip-label')).map((label) => label.textContent);

const paragraphCount = (container: HTMLElement) =>
  container.querySelectorAll('.MuiGrid-item > .MuiStack-root > div').length;

describe('SongsLyrics', () => {
  it('renders section chips and transposed chord chips', () => {
    const song = makeSong('{Verse 1}\n[G]Amazing [C/E]grace\n\n[N.C.]how [x2]sweet', 'G');
    const container = buildLyricsDom(song, { changeKey: 9 });

    expect(chipLabels(container)).toEqual(['Verse 1', 'A', 'D/F#', 'N.C.', 'x2']);
    expect(container.querySelectorAll('br')).toHaveLength(1);
  });

  it('spells transposed chords with flats when useFlat is set', () => {
    const song = makeSong('{Verse}\n[C]One [F#m7]two [Bbadd9]three', 'C');
    expect(chipLabels(buildLyricsDom(song, { changeKey: 1, useFlat: true }))).toEqual([
      'Verse',
      'Db',
      'Gm7',
      'Badd9',
    ]);
  });

  it('renders an empty chip for empty brackets and an empty label for text before a chord', () => {
    const song = makeSong('{Verse}\nHello [G]world []end', 'C');
    expect(chipLabels(buildLyricsDom(song, { changeKey: 0 }))).toEqual(['Verse', '', 'G', '']);
  });

  it('hides chords and drops chord-only segments when chordStatus is off', () => {
    const song = makeSong('{Verse}\n[G]Hello [C] [D]world', 'G');
    const container = buildLyricsDom(song, { changeKey: 7, chordStatus: false });

    expect(chipLabels(container)).toEqual(['Verse']);
    expect(container.textContent).toBe('VerseHello world');
  });

  it('splits paragraphs at section headers', () => {
    const song = makeSong('{Verse}\nOne\n{Chorus}\nTwo\n{Bridge}\nThree', 'C');
    expect(paragraphCount(buildLyricsDom(song, { changeKey: 0 }))).toBe(3);
  });

  it('starts a paragraph for lyrics before the first section header', () => {
    const song = makeSong('Hello\n{Chorus}\nWorld', 'C');
    const container = buildLyricsDom(song, { changeKey: 0 });

    expect(paragraphCount(container)).toBe(2);
    expect(chipLabels(container)).toEqual(['', 'Chorus', '']);
  });

  it('merges a chords-only first block into the next paragraph', () => {
    const song = makeSong('{Intro}\n[G] [C]\n{Verse}\n[G]Hello', 'G');
    const container = buildLyricsDom(song, { changeKey: 7 });

    expect(paragraphCount(container)).toBe(1);
    expect(chipLabels(container)).toEqual(['Intro', 'G', 'C', 'Verse', 'G']);
  });

  it('renders nothing for an undefined song', () => {
    expect(paragraphCount(buildLyricsDom(undefined, { changeKey: 0 }))).toBe(0);
  });

  it('shifts every chord one semitone up when the original key is unknown', () => {
    const song = makeSong('{Verse}\n[C]Hello', 'Am');
    expect(chipLabels(buildLyricsDom(song, { changeKey: 0 }))).toEqual(['Verse', 'C#']);
  });
});
