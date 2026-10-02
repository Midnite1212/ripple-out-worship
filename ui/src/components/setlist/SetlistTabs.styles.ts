export const SELECTED_ITEM_STYLE = {
  backgroundColor: 'primary.darker',
  color: 'primary.lighter',
  '&:hover': {
    backgroundColor: 'primary.darker',
    opacity: '0.9',
  },
  '& .MuiListItemIcon-root': {
    color: 'secondary.main',
  },
  '& .MuiListItemText-root': {
    color: 'secondary.main',
  },
};

export const LIST_ITEM_TEXT_STYLE = {
  color: 'secondary.main',
  '& .MuiListItemText-primary': {
    color: 'primary.lighter',
    fontWeight: 600,
    fontSize: '1rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  },
  '& .MuiListItemText-secondary': {
    color: 'onSurface.variant',
    fontWeight: 400,
    fontSize: '0.75rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  },
};

export const LIST_ITEM_ICON_STYLE = { color: 'secondary.main', fontSize: '1.75rem' };
export const SMALL_LIST_ITEM_ICON_STYLE = {
  fontSize: '1.125rem',
  color: 'secondary.main',
};
