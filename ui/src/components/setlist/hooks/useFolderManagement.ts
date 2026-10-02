import { useCallback, useEffect, useState } from 'react';
import { customAxios as axios } from '../../custom/customAxios';
import { Setlist, SetlistFolder } from '../../../types/setlist.types';
import { logRequestError } from '../../../helpers/global';

const useFolderManagement = (
  setlist: Setlist,
  handleSnackbarOpen: (message: string) => void,
  onFolderAssignmentChanged?: (type?: 'folders' | 'setlists' | 'all') => Promise<void>,
  refetchFolders?: () => Promise<void>
) => {
  const [updatedFolderIds, setUpdatedFolderIds] = useState<string[]>([]);
  const [originalFolderIds, setOriginalFolderIds] = useState<string[]>([]);

  useEffect(() => {
    setOriginalFolderIds(setlist.groupIds ?? []);
    setUpdatedFolderIds(setlist.groupIds ?? []);
  }, [setlist.groupIds]);

  const toggleFolder = useCallback((folderId: string) => {
    setUpdatedFolderIds((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]
    );
  }, []);

  const saveFolderChanges = useCallback(async () => {
    try {
      // Update setlist with new folder IDs
      const { status } = await axios.put('/api/setlists/update', {
        id: setlist._id,
        groupIds: updatedFolderIds,
      });

      if (status !== 200) throw new Error('Failed to update setlist');

      // Calculate changes
      const foldersToAdd = updatedFolderIds.filter((id) => !originalFolderIds.includes(id));
      const foldersToRemove = originalFolderIds.filter((id) => !updatedFolderIds.includes(id));

      const { data: freshFolders } = await axios.get<SetlistFolder[]>('/api/groups/get');

      // Update folder setlist references
      const updatePromises = [
        ...foldersToAdd.flatMap((folderId) => {
          const folder = freshFolders.find((f) => f._id === folderId);
          return folder
            ? [
                axios.put('/api/groups/update', {
                  id: folderId,
                  setlistIds: Array.from(new Set([...(folder.setlistIds || []), setlist._id])),
                }),
              ]
            : [];
        }),
        ...foldersToRemove.flatMap((folderId) => {
          const folder = freshFolders.find((f) => f._id === folderId);
          return folder
            ? [
                axios.put('/api/groups/update', {
                  id: folderId,
                  setlistIds: Array.from(
                    new Set((folder.setlistIds || []).filter((id) => id !== setlist._id))
                  ),
                }),
              ]
            : [];
        }),
      ];

      const results = await Promise.all(updatePromises);
      const allSuccessful = results.every((res) => res.status === 200);

      if (allSuccessful) {
        handleSnackbarOpen('Folder assignments updated successfully');
        setOriginalFolderIds(updatedFolderIds);
        // Refetch folders to get updated data
        if (refetchFolders) {
          await refetchFolders();
        }
        // Trigger parent refresh
        if (onFolderAssignmentChanged) {
          await onFolderAssignmentChanged('all');
        }
        return true;
      } else {
        throw new Error('Some folder updates failed');
      }
    } catch (error) {
      handleSnackbarOpen('Could not update folders. Please try again.');
      logRequestError('Error updating folders:', error);
      return false;
    }
  }, [
    setlist._id,
    updatedFolderIds,
    originalFolderIds,
    handleSnackbarOpen,
    onFolderAssignmentChanged,
    refetchFolders,
  ]);

  const resetFolderChanges = useCallback(() => {
    setUpdatedFolderIds(originalFolderIds);
  }, [originalFolderIds]);

  return {
    updatedFolderIds,
    toggleFolder,
    saveFolderChanges,
    resetFolderChanges,
  };
};

export default useFolderManagement;
