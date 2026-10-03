import { findFirstLetterLyrics, formatDate, isChordLyricsBlockEmpty } from './common';

describe('formatDate', () => {
  it('formats a Date as DD-MM-YYYY in local time', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('05-01-2026');
    expect(formatDate(new Date(2026, 11, 31, 23, 59))).toBe('31-12-2026');
  });

  it('parses a local date-time string', () => {
    expect(formatDate('2026-10-02T12:00:00')).toBe('02-10-2026');
  });

  it.each(['not a date', '', new Date(NaN)])(
    'returns an empty string for invalid date %p',
    (date) => {
      expect(formatDate(date)).toBe('');
    }
  );
});

describe('findFirstLetterLyrics', () => {
  it.each([
    ['{Verse 1}\n[G]Amazing grace', 'A'],
    ['[Am]amazing', 'A'],
    ['123 go', 'G'],
    ['{a[b]c}d', 'D'],
    ['你好 hi', 'H'],
    ['Élan', 'L'],
    ['[G] (x2) Hello', 'X'],
    [']abc', 'A'],
    ['}}hi', 'H'],
    ['[G]]] [C]hello', 'H'],
    ['{V}}\n[G]]Amazing', 'A'],
  ])('finds the first letter of %p as %p', (text, letter) => {
    expect(findFirstLetterLyrics(text)).toBe(letter);
  });

  it.each(['', '[Am]', '{Intro}\n[G] [C]', '123 !!', '[G Hello', '}{ hi'])(
    'returns null for %p',
    (text) => {
      expect(findFirstLetterLyrics(text)).toBeNull();
    }
  );

  it.each([null, undefined])('returns null for %p lyrics', (text) => {
    expect(findFirstLetterLyrics(text)).toBeNull();
  });
});

describe('isChordLyricsBlockEmpty', () => {
  it.each([
    '',
    '{Intro}',
    '{Intro}\n[G] [C]',
    '[G]\n\n[D/F#]  ',
    '123 !!',
    '[G]] [C]',
    '}{Intro}',
    '[G Hello',
  ])('treats %p as chords only', (text) => {
    expect(isChordLyricsBlockEmpty(text)).toBe(true);
  });

  it.each([
    '{Verse}\n[G]Hello',
    'Hello',
    '[G] x2',
    '[G] (repeat)',
    '{Intro}\n[G] é a',
    ']abc',
    '[G]]Hello',
    '}}\nHello',
    '{V}}\n[G]] [C]world',
  ])('treats %p as having lyrics', (text) => {
    expect(isChordLyricsBlockEmpty(text)).toBe(false);
  });
});
