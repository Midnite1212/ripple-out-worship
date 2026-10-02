import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

type SetlistDeleteDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
  setlistName: string;
};

const SetlistDeleteDialog = ({
  open,
  onClose,
  onConfirm,
  setlistName,
}: SetlistDeleteDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open) setIsDeleting(false);
  }, [open]);

  const handleConfirm = async () => {
    setIsDeleting(true);
    const isDeleted = await onConfirm();
    if (!isDeleted) {
      setIsDeleting(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Delete Setlist</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete the setlist "{setlistName}"?
        </DialogContentText>
        <DialogContentText sx={{ mt: 1 }}>This action cannot be undone.</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} color="error" disabled={isDeleting}>
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SetlistDeleteDialog;
