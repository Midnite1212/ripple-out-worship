import { FC, useState } from 'react';
import { Divider, Menu } from '@mui/material';
import Delete from '@mui/icons-material/Delete';
import Edit from '@mui/icons-material/Edit';
import Folder from '@mui/icons-material/Folder';
import LinkRounded from '@mui/icons-material/LinkRounded';
import SetlistDeleteDialog from './SetlistDeleteDialog';
import SetlistFolderActionsDialog from './SetlistFolderActionsDialog';
import SetlistMenuActionItem from './SetlistMenuActionItem';
import useFolderManagement from './hooks/useFolderManagement';
import useFolders from './hooks/useFolders';
import useSetlistActions from './hooks/useSetlistActions';
import { useOwnership } from '../../helpers/customHooks';
import { Setlist } from '../../types/setlist.types';

interface SetlistActionsMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  setlist: Setlist;
  handleSnackbarOpen: (message: string) => void;
  onSetlistDeleted?: (setlistId: string) => void;
  onFolderAssignmentChanged?: (type?: 'folders' | 'setlists' | 'all') => Promise<void>;
}

const SetlistActionsMenu: FC<SetlistActionsMenuProps> = ({
  anchorEl,
  open,
  onClose,
  setlist,
  handleSnackbarOpen,
  onSetlistDeleted,
  onFolderAssignmentChanged,
}) => {
  const ownership = useOwnership();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const {
    ownedFolders,
    isLoading: isLoadingFolders,
    refetchFolders,
  } = useFolders(ownership, handleSnackbarOpen, isFolderDialogOpen);
  const { handleEdit, handleCopyLink, handleDelete } = useSetlistActions(
    setlist,
    handleSnackbarOpen,
    onSetlistDeleted
  );
  const { updatedFolderIds, toggleFolder, saveFolderChanges, resetFolderChanges } =
    useFolderManagement(setlist, handleSnackbarOpen, onFolderAssignmentChanged, refetchFolders);

  const handleEditClick = () => {
    handleEdit();
    onClose();
  };

  const handleCopyLinkClick = async () => {
    await handleCopyLink();
    onClose();
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
    onClose();
  };

  const handleFolderActionsClick = () => {
    setIsFolderDialogOpen(true);
    onClose();
  };

  const handleConfirmDelete = async () => {
    const isDeleted = await handleDelete();
    if (isDeleted) setIsDeleteDialogOpen(false);
    return isDeleted;
  };

  return (
    <>
      <Menu
        id={`setlist-menu-${setlist._id}`}
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        MenuListProps={{ 'aria-labelledby': `setlist-menu-button-${setlist._id}` }}
      >
        <SetlistMenuActionItem icon={Edit} text="Edit Setlist" onClick={handleEditClick} />
        <SetlistMenuActionItem icon={LinkRounded} text="Copy Link" onClick={handleCopyLinkClick} />
        <SetlistMenuActionItem
          icon={Folder}
          text="Folder Actions"
          onClick={handleFolderActionsClick}
        />

        <Divider sx={{ bgcolor: 'outline.variant' }} />

        <SetlistMenuActionItem
          icon={Delete}
          text="Delete Setlist"
          onClick={handleDeleteClick}
          iconColor="error.main"
          color="error.main"
          hoverBgColor="rgba(239, 184, 200, 0.2)"
        />
      </Menu>

      <SetlistDeleteDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        setlistName={setlist.name}
      />

      <SetlistFolderActionsDialog
        open={isFolderDialogOpen}
        onClose={() => setIsFolderDialogOpen(false)}
        folders={ownedFolders}
        isLoading={isLoadingFolders}
        updatedFolderIds={updatedFolderIds}
        onToggleFolder={toggleFolder}
        onSave={saveFolderChanges}
        onReset={resetFolderChanges}
        setlistName={setlist.name}
      />
    </>
  );
};

export default SetlistActionsMenu;
