import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import Folder from '@mui/icons-material/Folder';
import { AxiosResponse } from 'axios';
import dayjs from 'dayjs';
import { customAxios as axios } from '../custom/customAxios';
import ConfirmationDialog from '../custom/ConfirmationDialog';
import HeaderWithIcon from '../custom/HeaderWithIcon';
import SetlistFolderAddPeopleDialog from './SetlistFolderAddPeopleDialog';
import SetlistFolderDrawerFooter from './SetlistFolderDrawerFooter';
import SetlistFolderMembersSection from './SetlistFolderMembersSection';
import SetlistFolderSnackbar, { SetlistFolderSnackbarState } from './SetlistFolderSnackbar';
import useFolderMembers from './hooks/useFolderMembers';
import { useOwnership } from '../../helpers/customHooks';
import { GroupOwnership } from '../../types/ownership.types';
import { SetlistFolder } from '../../types/setlist.types';
import { logRequestError } from '../../helpers/global';

interface SetlistFolderDrawerProps {
  openDrawer: boolean;
  toggleFolderDrawer: (newOpen: boolean) => void;
  setFolderId: Dispatch<SetStateAction<string>>;
  setFolderName: Dispatch<SetStateAction<string>>;
  setFolderCreated: Dispatch<SetStateAction<string>>;
  folderId?: string;
  folderName?: string;
  folderCreated?: string;
  mode: 'edit' | 'create';
  onFolderDeleted?: () => void;
}

const SetlistFolderDrawer = (props: SetlistFolderDrawerProps) => {
  const {
    openDrawer,
    toggleFolderDrawer,
    setFolderId,
    setFolderName,
    setFolderCreated,
    folderId,
    folderName,
    folderCreated,
    mode,
    onFolderDeleted,
  } = props;

  const ownership = useOwnership();
  const theme = useTheme();
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobileAndSmallTablet = !isTablet && !isDesktop;

  const [createdDateString, setCreatedDateString] = useState<string>('');
  const [isSavingFolder, setIsSavingFolder] = useState<boolean>(false);
  const isFolderNameEmpty = !folderName?.trim();
  const [openDeleteFolderModal, setOpenDeleteFolderModal] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<SetlistFolderSnackbarState>({
    open: false,
    message: '',
    severity: 'success',
    showRefreshButton: false,
  });

  const showSnackbar = useCallback(
    (
      message: string,
      severity: 'success' | 'error' | 'warning' | 'info' = 'success',
      showRefreshButton: boolean = false
    ) => {
      setSnackbar({
        open: true,
        message,
        severity,
        showRefreshButton,
      });
    },
    []
  );

  const members = useFolderMembers({
    mode,
    openDrawer,
    folderId,
    folderName,
    folderCreated,
    ownership,
    showSnackbar,
  });
  const { addMembersToGroup, getPeople, resetMembers } = members;

  const handleSaveFolder = async () => {
    if (isSavingFolder || isFolderNameEmpty) return;
    setIsSavingFolder(true);
    try {
      let payload: AxiosResponse<SetlistFolder>;

      if (folderId) {
        payload = await axios.put('/api/groups/update', {
          id: folderId,
          groupName: folderName,
        });
      } else {
        payload = await axios.post('/api/groups/create', {
          groupName: folderName,
        });
      }

      if (payload.status === 200) {
        setFolderId(payload.data._id);
        setFolderName(payload.data.groupName);
        setFolderCreated(payload.data.createdAt);

        const currentGroup: GroupOwnership = {
          id: payload.data._id,
          name: payload.data.groupName,
          createdAt: payload.data.createdAt,
        };
        await addMembersToGroup(currentGroup);

        cancelFolderDrawer();

        if (mode === 'create') {
          showSnackbar(
            `Folder "${folderName}" created successfully! Refresh to see changes `,
            'success',
            true
          );
        } else {
          showSnackbar(`Folder "${folderName}" updated successfully!`);
        }
      }
    } catch (error) {
      const action = folderId ? 'update' : 'create';
      showSnackbar(`Failed to ${action} folder`, 'error');
      logRequestError('Error saving folder:', error);
    } finally {
      setIsSavingFolder(false);
    }
  };

  const fetchFolderDetails = useCallback(async () => {
    if (mode === 'create' || !folderId) return;
    try {
      const { data } = await axios.get<SetlistFolder>(`/api/groups/get?id=${folderId}`);
      if (data) {
        setFolderName(data.groupName);
        setFolderCreated(data.createdAt);
      }
    } catch (err: unknown) {
      showSnackbar('Failed to load folder details', 'error');
      logRequestError('Error fetching folder:', err);
    }
  }, [mode, folderId, setFolderName, setFolderCreated, showSnackbar]);

  const deleteGroup = useCallback(async () => {
    try {
      const { status } = await axios.put(`/api/groups/delete`, {
        params: {
          id: folderId,
        },
      });
      if (status === 200) {
        await axios.put('/api/ownerships/update', {
          ...ownership,
          groupIds: (ownership?.groupIds ?? []).filter((group) => group.id !== folderId),
        });
        if (onFolderDeleted) {
          onFolderDeleted();
        } else {
          showSnackbar(`Folder "${folderName}" deleted successfully!`);
        }
        toggleFolderDrawer(false);
      }
    } catch (error) {
      showSnackbar('Failed to delete folder', 'error');
      logRequestError('Error deleting folder:', error);
    }
  }, [folderId, ownership, onFolderDeleted, toggleFolderDrawer, folderName, showSnackbar]);

  const handleOpenDeleteFolderModal = useCallback(() => {
    setOpenDeleteFolderModal(true);
  }, []);

  const handleCloseDeleteFolderModal = useCallback(() => {
    setOpenDeleteFolderModal(false);
  }, []);

  const handleConfirmDeleteFolder = useCallback(() => {
    deleteGroup();
    handleCloseDeleteFolderModal();
  }, [deleteGroup, handleCloseDeleteFolderModal]);

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const handleRefreshPage = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    fetchFolderDetails();
  }, [fetchFolderDetails]);

  useEffect(() => {
    if (openDrawer) getPeople();
  }, [getPeople, openDrawer]);

  useEffect(() => {
    const createdDate = dayjs(folderCreated);
    setCreatedDateString(
      mode !== 'create' && folderCreated && createdDate.isValid()
        ? `Created at ${createdDate.format('YYYY-MM-DD')}`
        : ''
    );
  }, [folderCreated, mode]);

  const cancelFolderDrawer = () => {
    setFolderName('');
    setFolderId('');
    setFolderCreated('');
    resetMembers();
    setOpenDeleteFolderModal(false);
    toggleFolderDrawer(false);
  };

  return (
    <>
      <SetlistFolderSnackbar
        snackbar={snackbar}
        onClose={handleCloseSnackbar}
        onRefreshPage={handleRefreshPage}
      />

      <ConfirmationDialog
        open={members.openRemoveModal}
        onClose={members.handleCloseRemoveModal}
        onConfirm={members.handleConfirmRemove}
        title="Remove Person"
        message={`Are you sure you want to remove ${members.personToRemove
          ?.fullName} from the folder "${folderName}"? ${`\n\n`} This action cannot be undone.`}
        confirmText="Remove"
        confirmColor="error"
      />

      <ConfirmationDialog
        open={openDeleteFolderModal}
        onClose={handleCloseDeleteFolderModal}
        onConfirm={handleConfirmDeleteFolder}
        title="Delete Folder"
        message={`Are you sure you want to delete the folder "${folderName}"?${`\n\n`} This action cannot be undone and will remove all associated data.`}
        confirmText="Delete"
        confirmColor="error"
      />

      <SetlistFolderAddPeopleDialog
        open={members.openAddModal}
        onClose={members.handleCloseAddModal}
        searchString={members.searchString}
        onSearchChange={members.setSearchString}
        filteredPeople={members.filteredPeople}
        addedPeople={members.addedPeople}
        onTogglePerson={members.handleAddPerson}
      />

      <Drawer
        anchor={isMobileAndSmallTablet ? 'bottom' : 'right'}
        open={openDrawer}
        onClose={() => toggleFolderDrawer(false)}
        PaperProps={{
          sx: {
            width: isDesktop ? '25%' : isTablet ? '40%' : '100%',
            height: '100vh',
            bgcolor: isMobileAndSmallTablet ? 'primary.darkest' : 'surface.containerHigh',
          },
        }}
      >
        <Box sx={{ position: 'relative', height: '100%' }}>
          <Box
            sx={{
              p: '1.125rem',
              backgroundColor: isMobileAndSmallTablet ? 'common.black' : 'surface.container',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <HeaderWithIcon
              Icon={Folder}
              headerText="Folder Info"
              headerColor="primary.lighter"
              headerVariant="h2"
              iconColor="secondary.main"
            />
            <IconButton onClick={cancelFolderDrawer}>
              <Close sx={{ color: 'white' }} />
            </IconButton>
          </Box>
          <Divider sx={{ borderColor: 'outline.variant' }} />

          {mode === 'edit' && (
            <Box sx={{ p: '1.125rem' }}>
              <Typography fontSize="0.75rem" fontStyle="italic" color="onSurface.secondary">
                {createdDateString || 'Created on unknown date'}
              </Typography>
            </Box>
          )}
          {mode === 'edit' && <Divider sx={{ borderColor: 'outline.variant' }} />}

          <Stack direction="column" sx={{ p: '1.125rem', gap: '1rem', alignItems: 'flex-start' }}>
            <Typography variant="h4" color="primary.lightest">
              Name
            </Typography>
            <TextField
              fullWidth
              id="folderName"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
            />
            {mode === 'edit' && (
              <Stack direction="row" width="100%" justifyContent="flex-end">
                <Button
                  sx={{
                    backgroundColor: 'secondary.main',
                    color: 'primary.main',
                    borderRadius: '40px',
                    textTransform: 'none',
                    padding: '8px 20px',
                    '&:hover': {
                      backgroundColor: 'rgba(208, 188, 255, 0.8)',
                    },
                  }}
                  onClick={handleSaveFolder}
                  disabled={isSavingFolder || isFolderNameEmpty}
                >
                  Save Name
                </Button>
              </Stack>
            )}
          </Stack>
          <Divider sx={{ borderColor: 'outline.variant' }} />

          <SetlistFolderMembersSection
            members={members.addedPeopleList}
            onAddPeople={members.handleOpenAddModal}
            onRemoveMember={members.handleOpenRemoveModal}
          />
          <Divider sx={{ borderColor: 'outline.variant' }} />

          <SetlistFolderDrawerFooter
            mode={mode}
            isSaveDisabled={isSavingFolder || isFolderNameEmpty}
            onCancel={cancelFolderDrawer}
            onSave={handleSaveFolder}
            onDelete={handleOpenDeleteFolderModal}
          />
        </Box>
      </Drawer>
    </>
  );
};

export default SetlistFolderDrawer;
