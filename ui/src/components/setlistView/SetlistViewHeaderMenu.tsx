import { IconButton, Snackbar, Stack } from '@mui/material';
import { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { Edit, Link } from '@mui/icons-material';

interface SetlistViewHeaderMenuProps {
  setlistId: string;
}

const SetlistViewHeaderMenu = ({ setlistId }: SetlistViewHeaderMenuProps) => {
  const [open, setOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const navigate = useNavigate();

  const handleCloseSnackbar = (event: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/setlist/view/${setlistId}`);
      setSnackbarMessage('Setlist public link copied to clipboard');
    } catch (error) {
      console.error('Failed to copy link:', error);
      setSnackbarMessage('Failed to copy link to clipboard');
    }
    setOpen(true);
  };

  const handleEdit = () => {
    navigate(`/setlist/edit/${setlistId}`);
  };

  return (
    <>
      <Stack direction={'row'} alignItems={'center'} justifyContent={'flex-end'} gap={'1.25rem'}>
        <IconButton sx={{ p: 0.5 }} onClick={handleShare} edge="end">
          <Link color="secondary" fontSize="medium" />
        </IconButton>
        <IconButton sx={{ p: 0.5 }} onClick={handleEdit}>
          <Edit color="secondary" fontSize="medium" />
        </IconButton>
      </Stack>
      <Snackbar
        open={open}
        autoHideDuration={5000}
        onClose={handleCloseSnackbar}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        action={
          <IconButton size="small" aria-label="close" color="inherit" onClick={handleCloseSnackbar}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </>
  );
};

export default SetlistViewHeaderMenu;
