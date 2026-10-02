import { useCallback, useEffect, useState } from 'react';
import { customAxios as axios } from '../../custom/customAxios';
import { applySongKeys } from '../../../helpers/setlist/applySongKeys';
import { Ownership } from '../../../types/ownership.types';
import { Setlist, SetlistFolder } from '../../../types/setlist.types';
import { logRequestError } from '../../../helpers/global';

const useSetlistEditorData = (
  setlistId: string,
  ownership: Ownership,
  onError: (message: string) => void
) => {
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [folderOptions, setFolderOptions] = useState<SetlistFolder[]>([]);

  const getFolderOptions = useCallback(async () => {
    try {
      const { data, status } = await axios.get<SetlistFolder[]>('/api/groups/get');
      if (status === 200) {
        const filteredFolders = data.filter((folder) =>
          (ownership?.groupIds ?? []).some((group) => group.id === folder._id)
        );
        setFolderOptions(filteredFolders);
      }
    } catch (e) {
      logRequestError('Error fetching folders:', e);
      onError('Could not load your folders. Please try again.');
    }
  }, [onError, ownership]);

  const getSetlist = useCallback(async () => {
    if (setlistId === '') return;

    try {
      const { data, status } = await axios.get<Setlist>(`/api/setlists/get`, {
        params: {
          id: setlistId,
        },
      });
      if (status === 200) {
        setSetlist(applySongKeys(data));
      }
    } catch (e) {
      logRequestError('Error fetching setlist:', e);
      onError('Could not load this setlist. Please try again.');
    }
  }, [onError, setlistId]);

  useEffect(() => {
    getFolderOptions();
  }, [getFolderOptions]);

  useEffect(() => {
    getSetlist();
  }, [getSetlist]);

  return { setlist, folderOptions };
};

export default useSetlistEditorData;
