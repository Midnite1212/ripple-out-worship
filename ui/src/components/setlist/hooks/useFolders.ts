import { useCallback, useEffect, useState } from 'react';
import { customAxios as axios } from '../../custom/customAxios';
import { Ownership } from '../../../types/ownership.types';
import { SetlistFolder } from '../../../types/setlist.types';
import { logRequestError } from '../../../helpers/global';

const useFolders = (
  ownership: Partial<Ownership> | null | undefined,
  handleSnackbarOpen: (message: string) => void,
  isEnabled: boolean
) => {
  const [ownedFolders, setOwnedFolders] = useState<SetlistFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFolders = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, status } = await axios.get<SetlistFolder[]>('/api/groups/get');

      if (status !== 200 || !data) {
        throw new Error('Failed to fetch folders');
      }

      const filteredFolders = data.filter(
        (folder) => ownership?.groupIds?.some(({ id }) => id === folder._id)
      );

      setOwnedFolders(filteredFolders);
    } catch (error) {
      handleSnackbarOpen('Could not load your folders. Please try again.');
      logRequestError('Error fetching folders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [ownership, handleSnackbarOpen]);

  useEffect(() => {
    if (isEnabled) fetchFolders();
  }, [fetchFolders, isEnabled]);

  return { ownedFolders, isLoading, refetchFolders: fetchFolders };
};

export default useFolders;
