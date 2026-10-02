import { findFirstLetterLyrics, formatDate, isChordLyricsBlockEmpty } from './common';

describe('formatDate', () => {
  it('formats a Date as DD-MM-YYYY in local time', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('05-01-2026');
    expect(formatDate(new Date(2026, 11, 31, 23, 59))).toBe('31-12-2026');
  });

  it('parses a local date-time string', () => {
    expect(formatDate('2026-10-02T12:00:00')).toBe('02-10-2026');
  });

  it('returns NaN parts for an invalid date', () => {
    expect(formatDate('not a date')).toBe('NaN-NaN-NaN');
  });
});

describe('findFirstLetterLyrics', () => {
  it.each([
    ['{Verse 1}\n[G]Amazing grace', 'A'],
    ['[Am]amazing', 'a'],
    ['123 go', 'g'],
    ['{a[b]c}d', 'd'],
    ['你好 hi', 'h'],
    ['Élan', 'l'],
    ['[G] (x2) Hello', 'x'],
    ['}{ hi', 'h'],
  ])('finds the first letter of %p as %p', (text, letter) => {
    expect(findFirstLetterLyrics(text)).toBe(letter);
  });

  it.each(['', '[Am]', '{Intro}\n[G] [C]', '123 !!', ']abc', '[G Hello'])(
    'returns null for %p',
    (text) => {
      expect(findFirstLetterLyrics(text)).toBeNull();
    }
  );

  it('throws for null lyrics at runtime', () => {
    expect(() => findFirstLetterLyrics(null as unknown as string)).toThrow(TypeError);
  });
});

describe('isChordLyricsBlockEmpty', () => {
  it.each(['', '{Intro}', '{Intro}\n[G] [C]', '[G]\n\n[D/F#]  ', '123 !!', ']abc'])(
    'treats %p as chords only',
    (text) => {
      expect(isChordLyricsBlockEmpty(text)).toBe(true);
    }
  );

  it.each(['{Verse}\n[G]Hello', 'Hello', '[G] x2', '[G] (repeat)', '{Intro}\n[G] é a'])(
    'treats %p as having lyrics',
    (text) => {
      expect(isChordLyricsBlockEmpty(text)).toBe(false);
    }
  );
});
