import { Popover, Typography } from '@mui/material';
import SongInfoDetails from './SongInfoDetails';
import { SongViewSchema } from '../../types/song.types';

type SongInfoPopoverProps = {
  song: SongViewSchema | undefined;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
};

const SongInfoPopover = ({ song, anchorEl, open, onClose }: SongInfoPopoverProps) => {
  if (!song) return null;

  return (
    <Popover
      id="song-info-popover"
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      sx={{ pointerEvents: 'none' }}
      slotProps={{
        paper: {
          sx: {
            p: 2,
            background: '#201F25',
            color: 'onSurface.secondary',
            borderRadius: 2,
            minWidth: 140,
            maxWidth: 340,
            border: '1px solid #717171',
            mt: 0.5,
          },
        },
      }}
      disableRestoreFocus
    >
      <Typography variant="h5" fontWeight={700} mb={1} color="onSurface.secondary">
        About The Song
      </Typography>
      <SongInfoDetails song={song} />
    </Popover>
  );
};

export default SongInfoPopover;
