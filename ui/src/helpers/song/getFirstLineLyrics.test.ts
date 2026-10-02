import getFirstLineLyrics from './getFirstLineLyrics';

describe('getFirstLineLyrics', () => {
  it('returns an empty string for empty lyrics', () => {
    expect(getFirstLineLyrics('')).toBe('');
  });

  it.each([null, undefined])('returns an empty string for %p at runtime', (lyrics) => {
    expect(getFirstLineLyrics(lyrics as unknown as string)).toBe('');
  });

  it('returns the first lyric line after a leading section header', () => {
    expect(getFirstLineLyrics('{Verse 1}\n[G]Amazing [C]grace\n[G]how sweet')).toBe(
      'Amazing grace'
    );
  });

  it('returns the first line when there is no section header', () => {
    expect(getFirstLineLyrics('[G]Amazing grace\n{Chorus}\nMy chains')).toBe('Amazing grace');
  });

  it('skips a chords-only first block', () => {
    expect(getFirstLineLyrics('{Intro}\n[G] [C]\n{Verse}\n[G]Hello')).toBe('Hello');
  });

  it('trims whitespace left behind by removed chords', () => {
    expect(getFirstLineLyrics('{Intro}\n[G] [C]\n\n[D] Hi')).toBe('Hi');
    expect(getFirstLineLyrics('{V}\n \n[G]  Hi')).toBe('Hi');
    expect(getFirstLineLyrics('Line one\n[D]  Line two')).toBe('Line one');
  });

  it('removes inline section headers', () => {
    expect(getFirstLineLyrics('Hello {x} world')).toBe('Hello  world');
  });

  it('keeps empty brackets and braces', () => {
    expect(getFirstLineLyrics('[]Hello{}')).toBe('[]Hello{}');
  });

  it('returns an empty string when there are only chords and headers', () => {
    expect(getFirstLineLyrics('{Intro}\n[G] [C]')).toBe('');
  });
});
