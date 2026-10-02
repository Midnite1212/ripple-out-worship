import { Fragment } from 'react';

const getLyricsPreview = (lyrics?: string | null) => {
  const cleanLyrics = (lyrics ?? '')
    .split(/^\{[^}]*\}\s*$/m)
    .map((block) => block.replace(/\[.*?\]/g, '').trim())
    .find((block) => block !== '');
  if (cleanLyrics) {
    return cleanLyrics.split('\n').map((line, i) => (
      <Fragment key={i}>
        {line}
        <br />
      </Fragment>
    ));
  }

  // If cleanLyrics is undefined, return an empty string
  return '';
};
export default getLyricsPreview;
