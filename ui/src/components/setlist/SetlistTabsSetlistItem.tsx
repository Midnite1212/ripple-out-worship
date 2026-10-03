import { MouseEvent } from 'react';
import { IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { Theme } from '@mui/material/styles';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import QueueMusic from '@mui/icons-material/QueueMusic';
import dayjs from 'dayjs';
import SetlistActionsMenu from './SetlistActionsMenu';
import { Setlist } from '../../types/setlist.types';
import {
  LIST_ITEM_ICON_STYLE,
  LIST_ITEM_TEXT_STYLE,
  SELECTED_ITEM_STYLE,
} from './SetlistTabs.styles';

const formatDate = (date?: Date | string | null): string => {
  if (!date) return '';
  const parsedDate = dayjs(date);
  return parsedDate.isValid() ? parsedDate.format('YYYY-MM-DD') : '';
};

type SetlistTabsSetlistItemProps = {
  setlist: Setlist;
  isNested?: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onMenuOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  menuAnchorEl: HTMLElement | null;
  isMenuOpen: boolean;
  onMenuClose: () => void;
  handleSnackbarOpen: (message: string) => void;
  onSetlistDeleted: (setlistId: string) => void;
  onFolderAssignmentChanged: (type?: 'folders' | 'setlists' | 'all') => Promise<void>;
};

const SetlistTabsSetlistItem = ({
  setlist,
  isNested = false,
  isSelected,
  onSelect,
  onMenuOpen,
  menuAnchorEl,
  isMenuOpen,
  onMenuClose,
  handleSnackbarOpen,
  onSetlistDeleted,
  onFolderAssignmentChanged,
}: SetlistTabsSetlistItemProps) => {
  const itemStyle = isSelected
    ? SELECTED_ITEM_STYLE
    : { borderBottom: (theme: Theme) => `1px solid ${theme.palette.outline.variant}` };

  const itemButton = (
    <ListItemButton sx={isNested ? { pl: 6, ...itemStyle } : itemStyle} onClick={onSelect}>
      <ListItemIcon sx={{ minWidth: '40px', mr: '0.5rem' }}>
        <QueueMusic sx={LIST_ITEM_ICON_STYLE} />
      </ListItemIcon>
      <ListItemText
        primary={setlist.name}
        secondary={formatDate(setlist.date)}
        sx={LIST_ITEM_TEXT_STYLE}
      />
      <IconButton
        onClick={(e) => {
          e.stopPropagation();
          onMenuOpen(e);
        }}
        aria-controls={`setlist-menu-${setlist._id}`}
        aria-haspopup="true"
        aria-label={`Open menu for setlist ${setlist.name}`}
      >
        <MoreVertRounded
          sx={{
            color: 'secondary.lighter',
            fontSize: '1.75rem',
          }}
        />
      </IconButton>
    </ListItemButton>
  );

  const actionsMenu = (
    <SetlistActionsMenu
      anchorEl={menuAnchorEl}
      open={isMenuOpen}
      onClose={onMenuClose}
      setlist={setlist}
      handleSnackbarOpen={handleSnackbarOpen}
      onSetlistDeleted={onSetlistDeleted}
      onFolderAssignmentChanged={onFolderAssignmentChanged}
    />
  );

  return isNested ? (
    <>
      {itemButton}
      {actionsMenu}
    </>
  ) : (
    <ListItem disablePadding>
      {itemButton}
      {actionsMenu}
    </ListItem>
  );
};

export default SetlistTabsSetlistItem;
