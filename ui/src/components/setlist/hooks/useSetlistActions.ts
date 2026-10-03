import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { customAxios as axios } from '../../custom/customAxios';
import { Setlist } from '../../../types/setlist.types';
import { logRequestError } from '../../../helpers/global';
import { requestErrorMessage } from '../../../helpers/setlist/requestErrorMessage';

const useSetlistActions = (
  setlist: Setlist,
  handleSnackbarOpen: (message: string) => void,
  onSetlistDeleted?: (setlistId: string) => void
) => {
  const navigate = useNavigate();

  const handleEdit = useCallback(() => {
    navigate(`/setlist/edit/${setlist._id}`);
  }, [navigate, setlist._id]);

  const handleCopyLink = useCallback(async () => {
    if (!setlist.publicLink) {
      handleSnackbarOpen('This setlist does not have a public link yet');
      return;
    }
    try {
      await navigator.clipboard.writeText(setlist.publicLink);
      handleSnackbarOpen('Setlist Public Link copied to clipboard');
    } catch (error) {
      handleSnackbarOpen('Failed to copy link to clipboard');
    }
  }, [setlist.publicLink, handleSnackbarOpen]);

  const handleDelete = useCallback(async () => {
    try {
      const { status } = await axios.put('/api/setlists/delete', {
        params: { id: setlist._id },
      });

      if (status === 200) {
        onSetlistDeleted?.(setlist._id);
        handleSnackbarOpen(`Successfully deleted setlist: ${setlist.name}`);
        return true;
      }
      handleSnackbarOpen('Failed to delete setlist');
      return false;
    } catch (error) {
      logRequestError('Delete setlist error:', error);
      const message =
        isAxiosError(error) && error.response?.status === 404
          ? 'Setlist not found or already deleted'
          : requestErrorMessage(error, 'Failed to delete setlist');
      handleSnackbarOpen(message);
      return false;
    }
  }, [setlist._id, setlist.name, handleSnackbarOpen, onSetlistDeleted]);

  return { handleEdit, handleCopyLink, handleDelete };
};

export default useSetlistActions;
