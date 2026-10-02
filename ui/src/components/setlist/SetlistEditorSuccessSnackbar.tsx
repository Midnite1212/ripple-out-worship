import { Alert, AlertTitle, Fade, Snackbar } from '@mui/material';

type SetlistEditorSuccessSnackbarProps = {
  open: boolean;
  onClose: () => void;
};

const SetlistEditorSuccessSnackbar = ({ open, onClose }: SetlistEditorSuccessSnackbarProps) => (
  <Snackbar
    open={open}
    onClose={onClose}
    autoHideDuration={6000}
    TransitionComponent={Fade}
    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
  >
    <Alert severity="success" onClose={onClose}>
      <AlertTitle>Success</AlertTitle>
      Setlist successfully saved!
    </Alert>
  </Snackbar>
);

export default SetlistEditorSuccessSnackbar;
