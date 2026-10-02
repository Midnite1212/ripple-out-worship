import { renderToStaticMarkup } from 'react-dom/server';
import getLyricsPreview from './getLyricsPreview';

const renderPreview = (lyrics?: string | null) =>
  renderToStaticMarkup(<>{getLyricsPreview(lyrics)}</>);

describe('getLyricsPreview', () => {
  it.each([null, undefined, ''])('returns an empty string for %p', (lyrics) => {
    expect(getLyricsPreview(lyrics)).toBe('');
  });

  it('returns the first block after a leading section header without chords', () => {
    const lyrics = '{Verse 1}\n[G]Amazing [C]grace\n[G]how sweet\n{Chorus}\n[C]My chains';
    expect(renderPreview(lyrics)).toBe('Amazing grace<br/>how sweet<br/>');
  });

  it('returns the text before the first section header when there is no leading header', () => {
    expect(renderPreview('[G]Amazing grace\n{Chorus}\n[C]My chains')).toBe('Amazing grace<br/>');
  });

  it('skips a chords-only first block', () => {
    const lyrics = '{Intro}\n[G] [C] [D]\n{Verse}\n[G]Hello there';
    expect(renderPreview(lyrics)).toBe('Hello there<br/>');
  });

  it('treats a header line with trailing whitespace as a header', () => {
    expect(renderPreview('{Verse}   \nHello')).toBe('Hello<br/>');
  });

  it('keeps a header that shares its line with lyrics', () => {
    expect(renderPreview('{Verse} Hello\nWorld')).toBe('{Verse} Hello<br/>World<br/>');
  });

  it('keeps blank lines inside the block', () => {
    expect(renderPreview('{Verse}\nOne\n\nTwo\n{Chorus}\nThree')).toBe('One<br/><br/>Two<br/>');
  });

  it('removes empty brackets', () => {
    expect(renderPreview('[]Hello [x2]world')).toBe('Hello world<br/>');
  });

  it('returns an empty string when every block is chords only', () => {
    expect(getLyricsPreview('{Intro}\n[G] [C]\n{Outro}\n[D]')).toBe('');
  });

  it('returns one fragment per line', () => {
    const preview = getLyricsPreview('{Verse}\nOne\nTwo');
    expect(Array.isArray(preview)).toBe(true);
    expect(preview).toHaveLength(2);
  });
});
