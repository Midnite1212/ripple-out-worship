import { useState } from 'react';
import { Box, IconButton, Snackbar, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import ConfirmationDialog from '../custom/ConfirmationDialog';
import { customAxios as axios } from '../custom/customAxios';
import { useNavigate } from 'react-router-dom';
import { logRequestError } from '../../helpers/global';

const SNACKBAR_AUTO_HIDE_DURATION = 5000;

type SongDeleteDialogProps = {
  open: boolean;
  onClose: () => void;
  songId?: string;
};
const SongDeleteDialog = ({ open, onClose, songId }: SongDeleteDialogProps) => {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const handleDelete = async () => {
    if (!songId || isDeleting) return;
    setIsDeleting(true);
    try {
      await axios.put('/api/songs/delete', { id: songId });
      onClose();
      navigate('/song', { state: { snackbarMessage: 'Song deleted.' } });
    } catch (error: unknown) {
      logRequestError('Error deleting song:', error);
      setSnackbarMessage('Could not delete this song. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSnackbarClose = (_: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackbarMessage('');
  };

  return (
    <>
      <ConfirmationDialog
        open={open}
        onClose={onClose}
        onConfirm={handleDelete}
        title={
          <Box display="flex" flexDirection="row" alignItems="center" gap={1}>
            <DeleteIcon color="error" fontSize="large" />
            <Typography variant="h3" component="span" color="error">
              Delete Song
            </Typography>
          </Box>
        }
        confirmText={isDeleting ? 'Deleting...' : 'Confirm Delete Song'}
        confirmColor="error"
        showCloseIcon
      >
        <Stack spacing={2} alignItems="center" textAlign="center" paddingY={2}>
          <Typography variant="h5">Are you sure you want to delete this song?</Typography>
          <Typography>This action cannot be undone</Typography>
        </Stack>
      </ConfirmationDialog>
      <Snackbar
        open={snackbarMessage !== ''}
        autoHideDuration={SNACKBAR_AUTO_HIDE_DURATION}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
        action={
          <IconButton
            size="small"
            color="inherit"
            onClick={() => setSnackbarMessage('')}
            aria-label="close"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </>
  );
};

export default SongDeleteDialog;
