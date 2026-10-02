import { Box, styled } from '@mui/material';

export const SearchButtonBox = styled(Box)(({ theme }) => ({
  color: theme.palette.primary.lighter,
  backgroundColor: theme.palette.primary.darker,
  borderRadius: '15px',
  padding: '1rem',
  width: 'fit-content',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  '&:hover': {
    opacity: 0.9,
  },
}));
