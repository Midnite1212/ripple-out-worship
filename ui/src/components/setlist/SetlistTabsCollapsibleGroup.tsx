import { ReactNode } from 'react';
import { Collapse, List, ListItemButton, ListItemText } from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { SMALL_LIST_ITEM_ICON_STYLE } from './SetlistTabs.styles';

type SetlistTabsCollapsibleGroupProps = {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

const SetlistTabsCollapsibleGroup = ({
  title,
  open,
  onToggle,
  children,
}: SetlistTabsCollapsibleGroupProps) => {
  return (
    <>
      <ListItemButton
        onClick={onToggle}
        sx={{
          borderBottom: (theme) => `1px solid ${theme.palette.outline.variant}`,
          background: (theme) => theme.palette.surface.container,
          py: '2px',
        }}
      >
        <ListItemText
          primary={title}
          sx={{
            fontSize: '0.75rem',
            fontWeight: 500,
          }}
        />
        {open ? (
          <ExpandLess sx={SMALL_LIST_ITEM_ICON_STYLE} />
        ) : (
          <ExpandMore sx={SMALL_LIST_ITEM_ICON_STYLE} />
        )}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {children}
        </List>
      </Collapse>
    </>
  );
};

export default SetlistTabsCollapsibleGroup;
