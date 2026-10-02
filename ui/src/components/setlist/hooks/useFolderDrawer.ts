import { useCallback, useState } from 'react';

const useFolderDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [folderId, setFolderId] = useState('');
  const [folderName, setFolderName] = useState('');
  const [folderCreated, setFolderCreated] = useState('');

  const toggle = useCallback((newOpen: boolean) => {
    setIsOpen(newOpen);
  }, []);

  const reset = useCallback(() => {
    setFolderId('');
    setFolderName('');
    setFolderCreated('');
  }, []);

  return {
    isOpen,
    folderId,
    folderName,
    folderCreated,
    toggle,
    reset,
    setFolderId,
    setFolderName,
    setFolderCreated,
  };
};

export default useFolderDrawer;
