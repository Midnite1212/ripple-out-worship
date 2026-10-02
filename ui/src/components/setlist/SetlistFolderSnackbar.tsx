import { Alert, AlertTitle, Fade, Snackbar, Typography } from '@mui/material';

export type SetlistFolderSnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
  showRefreshButton?: boolean;
};

type SetlistFolderSnackbarProps = {
  snackbar: SetlistFolderSnackbarState;
  onClose: () => void;
  onRefreshPage: () => void;
};

const SetlistFolderSnackbar = ({
  snackbar,
  onClose,
  onRefreshPage,
}: SetlistFolderSnackbarProps) => (
  <Snackbar
    open={snackbar.open}
    onClose={onClose}
    autoHideDuration={6000}
    TransitionComponent={Fade}
    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
  >
    <Alert
      severity={snackbar.severity}
      onClose={onClose}
      action={
        snackbar.showRefreshButton ? (
          <Typography
            component="span"
            sx={{
              color: 'inherit',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.875rem',
              '&:hover': {
                textDecoration: 'none',
              },
            }}
            onClick={onRefreshPage}
          >
            Refresh page
          </Typography>
        ) : null
      }
    >
      <AlertTitle>
        {snackbar.severity === 'success'
          ? 'Success'
          : snackbar.severity === 'error'
          ? 'Error'
          : snackbar.severity === 'warning'
          ? 'Warning'
          : 'Info'}
      </AlertTitle>
      {snackbar.message}
    </Alert>
  </Snackbar>
);

export default SetlistFolderSnackbar;
