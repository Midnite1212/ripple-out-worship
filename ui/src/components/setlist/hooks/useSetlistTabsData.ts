import { useCallback, useState } from 'react';
import { customAxios as axios } from '../../custom/customAxios';
import { Ownership } from '../../../types/ownership.types';
import { Setlist, SetlistFolder } from '../../../types/setlist.types';
import { logRequestError } from '../../../helpers/global';

const useSetlistTabsData = (
  ownership: Ownership,
  handleSnackbarOpen: (message: string) => void
) => {
  const [allSetlists, setAllSetlists] = useState<Setlist[]>([]);
  const [ownedSetlists, setOwnedSetlists] = useState<Setlist[]>([]);
  const [sharedSetlists, setSharedSetlists] = useState<Setlist[]>([]);
  const [ownedFolders, setOwnedFolders] = useState<SetlistFolder[]>([]);

  const getSetlistsAndFolders = useCallback(async () => {
    try {
      const [folderRes, setlistRes] = await Promise.all([
        axios.get<SetlistFolder[]>('/api/groups/get'),
        axios.get<Setlist[]>('/api/setlists/get'),
      ]);

      if (folderRes.status !== 200 || !folderRes.data) {
        throw new Error('Failed to fetch folders');
      }
      if (setlistRes.status !== 200 || !setlistRes.data) {
        throw new Error('Failed to fetch setlists');
      }

      const filteredFolders = folderRes.data.filter(
        (folder) => ownership.groupIds?.some(({ id }) => id === folder._id)
      );
      setOwnedFolders(filteredFolders);
      const foldersSetlistIds = Array.from(
        new Set(filteredFolders.flatMap((folder) => folder.setlistIds ?? []))
      );

      const ownedSetlists = setlistRes.data.filter(
        (setlist) => ownership.setlistIds?.some(({ id }) => id === setlist._id)
      );
      setOwnedSetlists(ownedSetlists);
      const folderSetlists = setlistRes.data.filter((setlist) =>
        foldersSetlistIds.includes(setlist._id)
      );
      const shared = folderSetlists.filter(
        (setlist) => !ownedSetlists.some((owned) => owned._id === setlist._id)
      );
      setSharedSetlists(shared);
      setAllSetlists([...ownedSetlists, ...shared]);
    } catch (error) {
      handleSnackbarOpen('Could not load your setlists and folders. Please try again.');
      logRequestError('Error in getSetlistsAndFolders:', error);
    }
  }, [handleSnackbarOpen, ownership.groupIds, ownership.setlistIds]);

  const handleDataRefresh = useCallback(
    async (type?: 'folders' | 'setlists' | 'all') => {
      try {
        if (type === 'folders' || type === 'all' || !type) {
          const folderRes = await axios.get<SetlistFolder[]>('/api/groups/get');
          if (folderRes.status === 200 && folderRes.data) {
            const filteredFolders = folderRes.data.filter(
              (folder) => ownership.groupIds?.some(({ id }) => id === folder._id)
            );
            setOwnedFolders(filteredFolders);
          }
        }

        if (type === 'setlists' || type === 'all' || !type) {
          const setlistRes = await axios.get<Setlist[]>('/api/setlists/get');
          if (setlistRes.status === 200 && setlistRes.data) {
            const ownedSetlists = setlistRes.data.filter(
              (setlist) => ownership.setlistIds?.some(({ id }) => id === setlist._id)
            );
            setOwnedSetlists(ownedSetlists);

            const foldersSetlistIds = Array.from(
              new Set(ownedFolders.flatMap((folder) => folder.setlistIds ?? []))
            );
            const folderSetlists = setlistRes.data.filter((setlist) =>
              foldersSetlistIds.includes(setlist._id)
            );
            const shared = folderSetlists.filter(
              (setlist) => !ownedSetlists.some((owned) => owned._id === setlist._id)
            );
            setSharedSetlists(shared);
            setAllSetlists([...ownedSetlists, ...shared]);
          }
        }
      } catch (error) {
        logRequestError('Error refreshing setlists and folders:', error);
        handleSnackbarOpen('Could not refresh your setlists and folders. Please try again.');
      }
    },
    [ownership, ownedFolders, handleSnackbarOpen]
  );

  const handleSetlistDeleted = (setlistId: string) => {
    setOwnedSetlists((prev) => prev.filter((s) => s._id !== setlistId));
    setSharedSetlists((prev) => prev.filter((s) => s._id !== setlistId));
    setAllSetlists((prev) => prev.filter((s) => s._id !== setlistId));
  };

  return {
    allSetlists,
    ownedSetlists,
    sharedSetlists,
    ownedFolders,
    getSetlistsAndFolders,
    handleDataRefresh,
    handleSetlistDeleted,
  };
};

export default useSetlistTabsData;
