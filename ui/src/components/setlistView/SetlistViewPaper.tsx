import { PUBLIC_SETLIST_FOOTER_HEIGHT, PUBLIC_SETLIST_HEADER_HEIGHT } from '../../constants';
import { Box, styled } from '@mui/material';

export const SetlistViewHeader = styled(Box)<{ isMobile: boolean }>(({ isMobile }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  background:
    'linear-gradient(158deg, rgba(0, 0, 0, 0.00) 31.44%, rgba(148, 111, 255, 0.20) 80.34%), radial-gradient(111.68% 110.13% at 66.1% 8.28%, rgba(154, 118, 255, 0.20) 36.5%, rgba(0, 0, 0, 0.20) 64%), #1F1F1F',
  width: isMobile ? '100%' : '100vw',
  maxWidth: isMobile ? '100%' : '100vw',
  height: PUBLIC_SETLIST_HEADER_HEIGHT,
  maxHeight: PUBLIC_SETLIST_HEADER_HEIGHT,
}));

export const SetlistViewFooter = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  background: theme.palette.background.paper,
  width: '100vw',
  maxWidth: '100vw',
  height: PUBLIC_SETLIST_FOOTER_HEIGHT,
  maxHeight: PUBLIC_SETLIST_FOOTER_HEIGHT,
  color: theme.palette.outline.main,
  fontSize: '0.75rem',
}));

export const SetlistViewSongsControlChip = styled(Box)<{ isSelected: boolean }>(
  ({ isSelected, theme }) => ({
    display: 'flex',
    flexDirection: 'row',
    gap: '0.5rem',
    justifyContent: 'center',
    border: `1px solid ${
      isSelected ? theme.palette.secondary.lighter : theme.palette.outline.main
    }`,
    background: isSelected ? theme.palette.secondary.lighter : 'none',
    padding: '5px 10px',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    alignItems: 'center',
    fontSize: '0.875rem',
    fontWeight: 500,
    fontFamily: 'DM Sans',
    '&:hover': {
      borderColor: theme.palette.secondary.lighter,
    },
  })
);
