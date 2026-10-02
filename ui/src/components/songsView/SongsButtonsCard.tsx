import { Box, Container, Divider, IconButton, Typography, useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ScreenRotationIcon from '@mui/icons-material/ScreenRotation';
import Snackbar from '@mui/material/Snackbar';
import SongKeyControls from './SongKeyControls';
import SongsLyrics from './SongsLyrics';
import { SongViewSchema } from '../../types/song.types';
import {
  flatMusicKeysOptions,
  sharpMusicKeysOptions,
  specificSongsDesktopWidth,
  specificSongsMobileWidth,
} from '../../constants';
import { getInitialSongKey } from '../../helpers/song/chords';

type SongsButtonCardProps = {
  song: SongViewSchema | undefined;
  userHeader?: boolean;
  songsSelectionRow?: React.ReactNode;
};

const SongsButtonsCard = ({
  song,
  userHeader = false,
  songsSelectionRow,
}: SongsButtonCardProps) => {
  const [chordStatus, setChordStatus] = useState(false);
  const [count, setCount] = useState(0);
  const [useFlat, setUseFlat] = useState(false);
  const [split, setSplit] = useState(2);
  const [showSplitSnackbar, setShowSplitSnackbar] = useState(false);
  const isSmallScreen = useMediaQuery(`(max-width:${specificSongsMobileWidth})`);
  const isDesktop = useMediaQuery(`(min-width:${specificSongsDesktopWidth})`);
  const keyLabel = (useFlat && flatMusicKeysOptions[count]) || sharpMusicKeysOptions[count];

  const handleIncrement = () => {
    if (count < 11) setCount(count + 1);
    else setCount(0);
  };

  const handleDecrement = () => {
    if (count > 0) setCount(count - 1);
    else setCount(11);
  };

  const handleSplit = () => {
    if (isSmallScreen) {
      setShowSplitSnackbar(true);
      return;
    }
    if (split < 3) setSplit(split + 1);
    else setSplit(1);
  };

  useEffect(() => {
    const { isFlat, keyIndex } = getInitialSongKey(song?.originalKey);
    setUseFlat(isFlat);
    setCount(keyIndex);
  }, [song]);

  return (
    <Container maxWidth={false} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          width: '100%',
          py: 2,
          pl: ['0px', '4px'],
        }}
      >
        <Box display="flex" gap={2} sx={{ overflowX: 'auto' }}>
          {songsSelectionRow}
          <SongKeyControls
            isDesktop={isDesktop}
            split={split}
            onSplit={handleSplit}
            isChordsShown={chordStatus}
            onChordsShownChange={setChordStatus}
            isFlat={useFlat}
            onFlatChange={setUseFlat}
            keyLabel={keyLabel}
            onTransposeDown={handleDecrement}
            onTransposeUp={handleIncrement}
          />
        </Box>
      </Box>

      {/* render header */}
      {userHeader ? (
        <Box sx={{ width: '100%', padding: '12px 12px 12px 0' }}>
          <Typography variant="h2">{song?.title}</Typography>
          <Typography variant="subtitle2" sx={{ color: 'secondary.main', m: '8px 0' }}>
            {song?.artist}
          </Typography>
          <Divider sx={{ borderColor: 'secondary.dark' }} />
        </Box>
      ) : null}
      {/* render lyrics */}
      <Box
        sx={{
          maxWidth: '100%',
          height: '100%',
          display: 'flex',
          overflow: 'auto',
          padding: ['10px', '14px'],
          backgroundColor: 'primary.darkest',
          borderRadius: '12px',
          mb: '5vh',
        }}
      >
        <SongsLyrics
          useFlat={useFlat}
          chordStatus={chordStatus}
          changeKey={count}
          song={song}
          split={split}
        />
      </Box>

      <Snackbar
        open={showSplitSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowSplitSnackbar(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        ContentProps={{ sx: { background: 'transparent', boxShadow: 'none' } }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 3,
            py: 1,
            backgroundColor: 'secondary.main',
            color: 'primary.main',
            borderRadius: 2,
            boxShadow: 3,
            fontWeight: 500,
            fontSize: 16,
            minWidth: 260,
            position: 'relative',
          }}
        >
          <ScreenRotationIcon sx={{ color: 'primary.main', fontSize: 22, mr: 1 }} />
          <Box sx={{ px: 0.5 }}>Rotate phone to landscape to split</Box>
          <IconButton
            size="small"
            onClick={() => setShowSplitSnackbar(false)}
            sx={{
              color: 'primary.main',
              ml: 2, // margin-left for spacing
            }}
            aria-label="close"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Snackbar>
    </Container>
  );
};
export default SongsButtonsCard;
