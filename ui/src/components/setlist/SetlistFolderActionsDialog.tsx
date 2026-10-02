import { useMemo, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputBase,
  List,
  ListItem,
  Typography,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';
import Folder from '@mui/icons-material/Folder';
import HeaderWithIcon from '../custom/HeaderWithIcon';
import { SetlistFolder } from '../../types/setlist.types';

const DIALOG_STYLES = {
  paper: {
    width: '30rem',
    height: '70vh',
    borderRadius: '1.75rem',
    padding: '0.5rem',
  },
  searchInput: {
    alignSelf: 'center',
    width: '90%',
    px: '1.25rem',
    py: '0.5rem',
    color: 'secondary.light',
    backgroundColor: 'secondary.lighter',
    borderRadius: '1.75rem',
    fontWeight: 400,
    fontSize: '1rem',
  },
};

type SetlistFolderActionsDialogProps = {
  open: boolean;
  onClose: () => void;
  folders: SetlistFolder[];
  isLoading: boolean;
  updatedFolderIds: string[];
  onToggleFolder: (folderId: string) => void;
  onSave: () => Promise<boolean>;
  onReset: () => void;
  setlistName: string;
};

const SetlistFolderActionsDialog = ({
  open,
  onClose,
  folders,
  isLoading,
  updatedFolderIds,
  onToggleFolder,
  onSave,
  onReset,
  setlistName,
}: SetlistFolderActionsDialogProps) => {
  const [searchString, setSearchString] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filteredFolders = useMemo(() => {
    const keyword = searchString.trim().toLowerCase();
    if (!keyword || keyword.length < 2) return folders;
    return folders.filter((folder) => folder.groupName.toLowerCase().includes(keyword));
  }, [folders, searchString]);

  const handleClose = () => {
    setSearchString('');
    onReset();
    onClose();
  };

  const handleSave = async () => {
    setIsSaving(true);
    const success = await onSave();
    setIsSaving(false);
    if (success) {
      setSearchString('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} PaperProps={{ sx: DIALOG_STYLES.paper }}>
      <DialogTitle
        display="flex"
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <HeaderWithIcon
          Icon={Folder}
          headerText={`Folder Actions for ${setlistName}`}
          headerVariant="h4"
          iconColor="secondary.main"
        />
        <IconButton onClick={handleClose} sx={{ color: 'grey.500' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <InputBase
        placeholder="Search by folder name"
        sx={DIALOG_STYLES.searchInput}
        value={searchString}
        onChange={(e) => setSearchString(e.target.value)}
        autoFocus
      />

      <DialogContent sx={{ pt: 0 }}>
        <List>
          {filteredFolders.length > 0 ? (
            filteredFolders.map((folder) => (
              <FolderListItem
                key={folder._id}
                folder={folder}
                isSelected={updatedFolderIds.includes(folder._id)}
                onToggle={onToggleFolder}
              />
            ))
          ) : isLoading ? (
            <ListItem sx={{ justifyContent: 'center' }}>
              <CircularProgress size={24} />
            </ListItem>
          ) : (
            <ListItem>
              <Typography variant="subtitle1" color="primary.lighter">
                No folders found
              </Typography>
            </ListItem>
          )}
        </List>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} color="primary" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const FolderListItem = ({
  folder,
  isSelected,
  onToggle,
}: {
  folder: SetlistFolder;
  isSelected: boolean;
  onToggle: (folderId: string) => void;
}) => (
  <ListItem
    sx={{ borderBottom: (theme) => `1px solid ${theme.palette.outline.variant}`, p: '1rem' }}
    secondaryAction={
      <IconButton
        edge="end"
        onClick={() => onToggle(folder._id)}
        sx={{
          width: '30px',
          height: '30px',
          border: 1,
          borderRadius: '50%',
          borderWidth: '2px',
          color: 'primary.lighter',
          '&:hover': { color: 'secondary.main' },
          '&.Mui-selected': {
            backgroundColor: 'secondary.main',
            color: 'primary.darkest',
          },
        }}
        className={isSelected ? 'Mui-selected' : ''}
      >
        {isSelected ? <Check /> : <Add />}
      </IconButton>
    }
  >
    <Typography sx={{ paddingRight: '32px' }} variant="subtitle1">
      {folder.groupName}
    </Typography>
  </ListItem>
);

export default SetlistFolderActionsDialog;
