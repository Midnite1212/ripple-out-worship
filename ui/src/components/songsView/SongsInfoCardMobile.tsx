import { Box, CardContent, Drawer, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';
import SongInfoDetails from './SongInfoDetails';
import { MOBILE_NAVBAR_HEIGHT } from '../../constants';
import { SongViewSchema } from '../../types/song.types';

type SongsInfoCardMobileProps = {
  song: SongViewSchema | undefined;
  open: boolean;
  onClose: () => void;
  isSetlistView?: boolean;
};

const SongsInfoCardMobile = ({ song, open, onClose, isSetlistView }: SongsInfoCardMobileProps) => {
  if (!song) return null;

  const bottomOffset = isSetlistView ? 0 : MOBILE_NAVBAR_HEIGHT;

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      sx={{ bottom: bottomOffset, '& .MuiBackdrop-root': { bottom: bottomOffset } }}
      PaperProps={{
        sx: {
          borderRadius: '20px 20px 0 0',
          bgcolor: 'primary.darkest',
          maxWidth: '100vw',
          bottom: bottomOffset,
        },
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} p={1}>
          <Box display="flex" alignItems="center">
            <InfoIcon sx={{ mr: 1, color: 'secondary.main' }} />
            <Typography variant="subtitle1" color="onSurface.secondary" fontWeight="bold">
              About The Song
            </Typography>
          </Box>
          <IconButton
            aria-label="Close"
            onClick={onClose}
            size="small"
            sx={{ color: 'onSurface.secondary' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <SongInfoDetails song={song} />
      </CardContent>
    </Drawer>
  );
};

export default SongsInfoCardMobile;
