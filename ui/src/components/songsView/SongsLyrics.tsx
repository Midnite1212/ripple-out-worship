import { Box, Chip, Grid, Stack, Typography, useMediaQuery } from '@mui/material';
import { SongViewSchema } from '../../types/song.types';
import { ReactNode, useCallback, useMemo } from 'react';
import { specificSongsMobileWidth } from '../../constants';
import { isChordLyricsBlockEmpty } from '../../helpers/global';
import { getColor, getTransposeOffset, transposeChord } from '../../helpers/song/chords';

interface SongsLyricsProps {
  chordStatus: boolean;
  changeKey: number;
  song: SongViewSchema | undefined;
  split: number;
  useFlat: boolean;
}

const SongsLyrics = ({ chordStatus, changeKey, song, split, useFlat }: SongsLyricsProps) => {
  const isDesktop = useMediaQuery(`(min-width:${specificSongsMobileWidth})`);
  const noSplit = isDesktop ? split : 1;

  const parseLyrics = useCallback(
    (inputSong: SongViewSchema | undefined, songChunk: string[]) => {
      const result: ReactNode[] = [];
      const transpossedChordIndex = getTransposeOffset(inputSong?.originalKey, changeKey);
      const lyricsLine = songChunk;

      // render the lyrics
      lyricsLine &&
        lyricsLine.map((line, j) => {
          if (line.includes('{') && line.includes('}')) {
            // return chip for verse, chorus, bridge
            const chipLabel = line.replace('{', '').replace('}', '');
            return result.push(
              <Chip
                key={j}
                label={chipLabel}
                variant="outlined"
                sx={{
                  height: '30px',
                  borderRadius: '4px',
                  mb: '10px',
                  mt: '3px',
                  borderColor: '#A9A9A9',
                  '& .MuiChip-label': {
                    width: 'inline-flex',
                    alignItems: 'center',
                    whiteSpace: 'none',
                    color: 'secondary.main',
                    borderColor: 'secondary.main',
                    borderRadius: 4,
                    border: '2',
                    fontSize: '14px',
                  },
                }}
              />
            );
          } else if (line === '') {
            // return empty line
            return result.push(<br key={j} />);
          } else {
            // return the lyrics and chords
            // split the lines by chunks of 1 chord and its corresponding lyrics
            const splitChar = '[';
            const escapedSplitChar = splitChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?=${escapedSplitChar})`);
            const lyrics = line.split(regex);
            return result.push(
              <Stack key={j} flexDirection="row" flexWrap="wrap">
                {lyrics.map((lyric, i) => {
                  if (lyric.includes('[') && lyric.includes(']')) {
                    const startChord = lyric.indexOf('[');
                    const endChord = lyric.indexOf(']');
                    const chord = lyric.slice(startChord + 1, endChord);

                    const transpossedChord = transposeChord(chord, transpossedChordIndex, useFlat);

                    const textLyrics = lyric.slice(endChord + 1);
                    const chipColor = getColor(transpossedChord);

                    return chordStatus || textLyrics.trim() ? (
                      <Box key={i}>
                        {chordStatus ? (
                          <Chip
                            label={transpossedChord}
                            size="small"
                            sx={{
                              height: 'fit',
                              borderRadius: '4px',
                              backgroundColor: chipColor,
                              mb: '5px',
                              mt: '3px',
                              '& .MuiChip-label': {
                                alignItems: 'center',
                                whiteSpace: 'none',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                color: 'primary.lightest',
                              },
                            }}
                          />
                        ) : null}
                        <Typography
                          sx={{
                            whiteSpace: 'pre-wrap',
                            color: 'onSurface.secondary',
                            wordBreak: 'break-word',
                          }}
                        >
                          {textLyrics}
                        </Typography>
                      </Box>
                    ) : null;
                  } else {
                    return (
                      <Box key={i}>
                        {chordStatus ? <Chip sx={{ visibility: 'hidden' }} /> : null}
                        <Typography sx={{ whiteSpace: 'pre-wrap', color: 'onSurface.secondary' }}>
                          {lyric}
                        </Typography>
                      </Box>
                    );
                  }
                })}
              </Stack>
            );
          }
        });
      return result;
    },
    [changeKey, chordStatus, useFlat]
  );

  // needs improvement
  const groupLyricsToParagraphs = useCallback(
    (song: SongViewSchema | undefined) => {
      const seperator = '{';
      const result = [];
      const inputSong = song?.chordLyrics?.split('\n') ?? [];
      let currentGroup: string[] = [];

      for (let i = 0; i < inputSong.length; i++) {
        //base case
        if (i === 0 && inputSong[i].includes(seperator)) {
          currentGroup.push(inputSong[i]);
        }

        if (!inputSong[i].includes(seperator)) {
          currentGroup.push(inputSong[i]);
        }

        if (inputSong[i].includes(seperator)) {
          if (i !== 0) {
            const parsedGroup = parseLyrics(song, currentGroup);
            if (isChordLyricsBlockEmpty(currentGroup.join('\n'))) {
              currentGroup.push(inputSong[i]);
              continue;
            } else {
              result.push(parsedGroup);
              currentGroup = [inputSong[i]];
            }
          }
        }
      }

      if (currentGroup.length > 0) {
        result.push(parseLyrics(song, currentGroup));
      }
      return result;
    },
    [parseLyrics]
  );

  const finalLyrics = useMemo(() => groupLyricsToParagraphs(song), [groupLyricsToParagraphs, song]);

  return (
    <>
      <Grid container width={'100%'} spacing={2} marginTop={1} marginBottom={0}>
        {Array.from({ length: noSplit }, (_, columnIndex) => {
          const totalChunks = finalLyrics?.length || 0;
          const baseChunksPerColumn = Math.floor(totalChunks / noSplit);
          const extraChunks = totalChunks % noSplit;

          const chunksInThisColumn =
            columnIndex < extraChunks ? baseChunksPerColumn + 1 : baseChunksPerColumn;

          const startIndex =
            columnIndex < extraChunks
              ? columnIndex * (baseChunksPerColumn + 1)
              : extraChunks * (baseChunksPerColumn + 1) +
                (columnIndex - extraChunks) * baseChunksPerColumn;

          const endIndex = startIndex + chunksInThisColumn;

          return (
            <Grid item xs={12 / noSplit} key={columnIndex}>
              <Stack spacing={2}>
                {finalLyrics &&
                  finalLyrics
                    .slice(startIndex, endIndex)
                    .map((chunk, i) => <Box key={startIndex + i}>{chunk}</Box>)}
              </Stack>
            </Grid>
          );
        })}
      </Grid>
    </>
  );
};
export default SongsLyrics;
