import { MouseEvent, useCallback, useState } from 'react';

export type MenuState = {
  anchorEl: HTMLElement | null;
  currentSetlistId: string | null;
};

const useSetlistMenu = () => {
  const [menuState, setMenuState] = useState<MenuState>({
    anchorEl: null,
    currentSetlistId: null,
  });

  const handleOpen = useCallback((event: MouseEvent<HTMLButtonElement>, setlistId: string) => {
    event.stopPropagation();
    setMenuState({
      anchorEl: event.currentTarget,
      currentSetlistId: setlistId,
    });
  }, []);

  const handleClose = useCallback(() => {
    setMenuState({
      anchorEl: null,
      currentSetlistId: null,
    });
  }, []);

  return {
    menuState,
    handleOpen,
    handleClose,
  };
};

export default useSetlistMenu;
