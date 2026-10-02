import { useCallback, useEffect, useState } from 'react';
import { customAxios as axios } from '../../custom/customAxios';
import { Setlist, SetlistFolder } from '../../../types/setlist.types';
import { logRequestError } from '../../../helpers/global';

const useFolderData = (id: string | undefined, onError: (message: string) => void) => {
  const [folder, setFolder] = useState<SetlistFolder | null>(null);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFolder = useCallback(async () => {
    if (!id) {
      setError('No folder ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data } = await axios.get<SetlistFolder>(`/api/groups/get?id=${id}`);

      if (!data) {
        throw new Error('Folder not found');
      }

      setFolder(data);
    } catch (err) {
      const message = 'Could not load this folder. Please try again.';
      setError(message);
      onError(message);
      logRequestError('Error fetching folder:', err);
    } finally {
      setLoading(false);
    }
  }, [id, onError]);

  const fetchSetlists = useCallback(async () => {
    if (!folder?.setlistIds?.length) {
      setSetlists([]);
      return;
    }

    try {
      const { data, status } = await axios.get<Setlist[]>('/api/setlists/get');

      if (status !== 200 || !data) {
        throw new Error('Failed to fetch setlists');
      }

      const filteredSetlists = data.filter(
        (setlist) => folder.setlistIds?.includes(setlist._id) ?? false
      );

      setSetlists(filteredSetlists);
    } catch (err) {
      onError('Could not load the setlists in this folder. Please try again.');
      logRequestError('Error fetching setlists:', err);
    }
  }, [folder?.setlistIds, onError]);

  const refreshFolder = useCallback(async () => {
    if (!folder?._id) return;

    try {
      const { data } = await axios.get<SetlistFolder>(`/api/groups/get?id=${folder._id}`);
      setFolder(data);
    } catch (err) {
      logRequestError('Error refreshing folder:', err);
      onError('Could not refresh this folder. Please try again.');
    }
  }, [folder?._id, onError]);

  const removeSetlist = useCallback((setlistId: string) => {
    setSetlists((prev) => prev.filter((s) => s._id !== setlistId));
  }, []);

  useEffect(() => {
    fetchFolder();
  }, [fetchFolder]);

  useEffect(() => {
    fetchSetlists();
  }, [fetchSetlists]);

  return {
    folder,
    setlists,
    loading,
    error,
    refreshFolder,
    removeSetlist,
  };
};

export default useFolderData;
