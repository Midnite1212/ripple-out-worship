import { MouseEvent, ReactNode } from 'react';
import {
  Box,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Folder from '@mui/icons-material/Folder';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import { SetlistFolder } from '../../types/setlist.types';
import { LIST_ITEM_ICON_STYLE, LIST_ITEM_TEXT_STYLE } from './SetlistTabs.styles';

type SetlistTabsFolderItemProps = {
  folder: SetlistFolder;
  isOpen: boolean;
  isExpandIconVisible: boolean;
  onToggle: () => void;
  onOpenDrawer: () => void;
  renderSetlistItem: (setlistId: string) => ReactNode;
};

const SetlistTabsFolderItem = ({
  folder,
  isOpen,
  isExpandIconVisible,
  onToggle,
  onOpenDrawer,
  renderSetlistItem,
}: SetlistTabsFolderItemProps) => (
  <>
    <ListItemButton
      onClick={onToggle}
      sx={{ borderBottom: (theme) => `1px solid ${theme.palette.outline.variant}` }}
    >
      <ListItemIcon sx={{ minWidth: '40px', mr: '0.5rem' }}>
        <Folder sx={LIST_ITEM_ICON_STYLE} />
      </ListItemIcon>
      <ListItemText primary={folder.groupName} sx={LIST_ITEM_TEXT_STYLE} />
      <IconButton
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          onOpenDrawer();
        }}
      >
        <MoreVertRounded sx={{ color: 'secondary.lighter', fontSize: '1.75rem' }} />
      </IconButton>
      {isExpandIconVisible && (
        <Box component="span" sx={{ display: 'inline-flex', p: 1 }}>
          {isOpen ? (
            <ExpandLess sx={LIST_ITEM_ICON_STYLE} />
          ) : (
            <ExpandMore sx={LIST_ITEM_ICON_STYLE} />
          )}
        </Box>
      )}
    </ListItemButton>
    <Collapse in={isOpen} timeout="auto" unmountOnExit>
      <List component="div" disablePadding>
        {/* TODO: Workaround for duplicated setlist bug, see issue #119. Remove this "Set" logic after fixing the underlying bug. */}
        {folder.setlistIds?.length > 0 ? (
          Array.from(new Set(folder.setlistIds)).map((setlistId) => renderSetlistItem(setlistId))
        ) : (
          <ListItem sx={{ pl: 7 }}>
            <Typography variant="subtitle2" color="secondary.light">
              No setlists in this folder
            </Typography>
          </ListItem>
        )}
      </List>
    </Collapse>
  </>
);

export default SetlistTabsFolderItem;
