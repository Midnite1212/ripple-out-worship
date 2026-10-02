import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Chip,
  FormControlLabel,
  FormGroup,
  IconButton,
  Stack,
  Switch,
  Typography,
  useMediaQuery,
} from '@mui/material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';
import SongsLyrics from '../songsView/SongsLyrics';
import SongsTitleCard from '../songsView/SongsTitleCard';
import { SongViewSchema } from '../../types/song.types';
import {
  flatMusicKeysOptions,
  sharpMusicKeysOptions,
  specificSongsDesktopWidth,
} from '../../constants';
import { getSetlistStartingKey } from '../../helpers/song/chords';

const keyStepButtonStyles = {
  borderRadius: '4px',
  width: ['24px', 'auto'],
  height: ['24px', 'auto'],
};

type KeyControlsProps = {
  currentKey: string;
  onDecrease: () => void;
  onIncrease: () => void;
};

const KeyControls = ({ currentKey, onDecrease, onIncrease }: KeyControlsProps) => (
  <Stack
    direction="row"
    gap={{ xs: 1, md: 2 }}
    alignItems="center"
    sx={{
      display: 'flex',
      justifyContent: 'center',
      background: (theme) => theme.palette.surface.containerHighest,
      padding: '5px 15px',
      borderRadius: '30px',
      minHeight: '56px',
    }}
  >
    <Box sx={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', p: '6px' }}>
      <Typography color="primary.lighter">Key</Typography>
    </Box>

    <Box bgcolor="primary.dark" sx={keyStepButtonStyles}>
      <IconButton aria-label="decrease key" onClick={onDecrease} sx={{ padding: '0px' }}>
        <KeyboardArrowDown sx={{ color: 'primary.lightest' }} />
      </IconButton>
    </Box>

    <Chip label={currentKey} sx={{ background: (theme) => theme.palette.outline.variant }} />

    <Box bgcolor="primary.dark" sx={keyStepButtonStyles}>
      <IconButton aria-label="increase key" onClick={onIncrease} sx={{ padding: '0px' }}>
        <KeyboardArrowUp sx={{ color: 'primary.lightest' }} />
      </IconButton>
    </Box>
  </Stack>
);

type FlatToggleProps = {
  isFlat: boolean;
  onToggle: () => void;
};

const FlatToggle = ({ isFlat, onToggle }: FlatToggleProps) => (
  <Box
    fontSize={{ sm: '14px', md: '26px' }}
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: (theme) => theme.palette.surface.containerHighest,
      padding: '5px 20px',
      borderRadius: '30px',
      minHeight: '56px',
    }}
  >
    <FormGroup sx={{ justifyContent: 'center' }}>
      <FormControlLabel
        labelPlacement="start"
        sx={{ margin: 0, color: 'primary.lighter' }}
        control={
          <Switch
            checked={isFlat}
            onChange={onToggle}
            sx={{
              '& .Mui-checked': { color: 'secondary.main' },
              '& .Mui-checked + .MuiSwitch-track': { backgroundColor: 'switchTrack.checked' },
            }}
            name="flat"
          />
        }
        label="Flat"
      />
    </FormGroup>
  </Box>
);

interface SetlistViewSongDisplayProps {
  song: SongViewSchema | undefined;
  splitColumns: number;
  showChords: boolean;
}

const SetlistViewSongDisplay = ({
  song,
  splitColumns,
  showChords,
}: SetlistViewSongDisplayProps) => {
  const [keyIndex, setKeyIndex] = useState(0);
  const [useFlat, setUseFlat] = useState(false);

  const isDesktop = useMediaQuery(`(min-width:${specificSongsDesktopWidth})`);
  const startingKey = song?.key || song?.originalKey;

  useEffect(() => {
    if (!startingKey) return;

    const { isFlat, keyIndex: startingKeyIndex } = getSetlistStartingKey(startingKey);
    setUseFlat(isFlat);
    setKeyIndex(startingKeyIndex);
  }, [startingKey]);

  const handleKeyDecrease = useCallback(() => {
    setKeyIndex((prev) => (prev + 11) % 12);
  }, []);

  const handleKeyIncrease = useCallback(() => {
    setKeyIndex((prev) => (prev + 1) % 12);
  }, []);

  const handleFlatToggle = useCallback(() => {
    setUseFlat((prev) => !prev);
  }, []);

  const currentKey = (useFlat ? flatMusicKeysOptions : sharpMusicKeysOptions)[keyIndex];

  return (
    <Box
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', width: '100%', gap: '1rem' }}
    >
      <Box sx={{ width: '100%', alignItems: 'flex-start' }}>
        <SongsTitleCard song={song} isSetlistView={true} />
      </Box>

      {showChords && (
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: isDesktop ? 2 : 1,
            pr: isDesktop ? 2 : 0,
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            scrollbarWidth: isDesktop ? 'thin' : 'none',
            '&::-webkit-scrollbar': isDesktop ? { height: 6 } : { display: 'none' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'scrollbar.thumb', borderRadius: 4 },
          }}
        >
          <KeyControls
            currentKey={currentKey}
            onDecrease={handleKeyDecrease}
            onIncrease={handleKeyIncrease}
          />
          <FlatToggle isFlat={useFlat} onToggle={handleFlatToggle} />
        </Box>
      )}

      <Box
        sx={{
          maxWidth: '100%',
          height: '100%',
          display: 'flex',
          padding: ['10px', '14px'],
          backgroundColor: 'primary.darkest',
          borderRadius: '12px',
          mb: '5vh',
        }}
      >
        <SongsLyrics
          useFlat={useFlat}
          chordStatus={showChords}
          changeKey={keyIndex}
          song={song}
          split={splitColumns}
        />
      </Box>
    </Box>
  );
};

export default SetlistViewSongDisplay;
