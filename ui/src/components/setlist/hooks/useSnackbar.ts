import { SyntheticEvent, useCallback, useState } from 'react';
import { SnackbarCloseReason } from '@mui/material';

export type SnackbarState = {
  open: boolean;
  message: string;
};

const useSnackbar = () => {
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
  });

  const handleOpen = useCallback((message: string) => {
    setSnackbar({ open: true, message });
  }, []);

  const handleClose = useCallback((_?: SyntheticEvent | Event, reason?: SnackbarCloseReason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    snackbar,
    handleOpen,
    handleClose,
  };
};

export default useSnackbar;
