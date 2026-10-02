import { Box, styled } from '@mui/material';

type SearchResultRowProps = {
  isFocused: boolean;
};

const SearchResultRow = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isFocused',
})<SearchResultRowProps>(({ theme, isFocused }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  width: '100%',
  padding: '0.75rem',
  borderRadius: '5px',
  color: theme.palette.onSurface.variant,
  backgroundColor: isFocused ? theme.palette.primary.dark : theme.palette.surface.container,
  cursor: 'pointer',
  outline: 'none',
  '&:hover, &:focus-visible': {
    backgroundColor: theme.palette.primary.dark,
  },
}));

export default SearchResultRow;
