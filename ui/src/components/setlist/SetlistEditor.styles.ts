import { Box, Button, Container, IconButton, InputBase, Stack } from '@mui/material';
import Search from '@mui/icons-material/Search';
import { styled } from '@mui/material/styles';
import { MOBILE_ACTION_BUTTONS_HEIGHT, MOBILE_NAVBAR_HEIGHT } from '../../constants';

export const MainContainer = styled(Container)<{ isMobileOrSmallTablet?: boolean }>(
  ({ isMobileOrSmallTablet }) => ({
    padding: '1rem',
    height: isMobileOrSmallTablet ? `calc(100vh - ${MOBILE_NAVBAR_HEIGHT})` : '100vh',
    maxHeight: isMobileOrSmallTablet ? `calc(100vh - ${MOBILE_NAVBAR_HEIGHT})` : '100vh',
    minWidth: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  })
);

export const ContentWrapper = styled(Box)<{ isMobileOrSmallTablet?: boolean }>(
  ({ isMobileOrSmallTablet }) => ({
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: isMobileOrSmallTablet
      ? `calc(100vh - ${MOBILE_NAVBAR_HEIGHT} - ${MOBILE_ACTION_BUTTONS_HEIGHT})`
      : '100vh',
    maxHeight: isMobileOrSmallTablet
      ? `calc(100vh - ${MOBILE_NAVBAR_HEIGHT} - ${MOBILE_ACTION_BUTTONS_HEIGHT})`
      : '100vh',
  })
);

export const SectionsContainer = styled(Box)<{ isMobileOrSmallTablet?: boolean }>(
  ({ isMobileOrSmallTablet }) => ({
    flex: 1,
    overflow: isMobileOrSmallTablet ? 'auto' : 'hidden',
    display: 'flex',
    flexDirection: isMobileOrSmallTablet ? 'column' : 'row',
    gap: '1.25rem',
    marginBlock: '0.5rem',
  })
);

export const SetlistDetailsBox = styled(Box)<{ isMobileOrSmallTablet?: boolean }>(
  ({ isMobileOrSmallTablet }) => ({
    display: 'flex',
    flexDirection: 'column',
    flex: isMobileOrSmallTablet ? 0 : 1,
    overflow: isMobileOrSmallTablet ? 'visible' : 'hidden',
    flexShrink: isMobileOrSmallTablet ? 0 : undefined,
  })
);

export const SetlistDetailsContent = styled(Stack)<{ isMobileOrSmallTablet?: boolean }>(
  ({ isMobileOrSmallTablet }) => ({
    flex: isMobileOrSmallTablet ? undefined : 1,
    overflow: isMobileOrSmallTablet ? 'visible' : 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: isMobileOrSmallTablet ? '1rem' : '1.5rem',
  })
);

export const SongSearchBox = styled(Box)<{ isMobileOrSmallTablet?: boolean; isTablet?: boolean }>(
  ({ isMobileOrSmallTablet, isTablet }) => ({
    display: 'flex',
    flexDirection: 'column',
    width: isMobileOrSmallTablet ? '100%' : isTablet ? '45vw' : '57.5vw',
    overflow: 'hidden',
    maxHeight: isMobileOrSmallTablet ? 'calc(100vh - 5rem)' : '90vh',
  })
);

export const SongSearchContent = styled(Stack)<{ isMobileOrSmallTablet?: boolean }>(
  ({ isMobileOrSmallTablet }) => ({
    flex: isMobileOrSmallTablet ? undefined : 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: isMobileOrSmallTablet ? '1rem' : '1.5rem',
    maxHeight: '100%',
  })
);

export const SongSearchStack = styled(Stack)({
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
  width: '100%',
  overflow: 'auto',
  maxHeight: '100%',
});

export const SongResultsContainer = styled(Box)({
  overflow: 'auto',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  marginTop: '1rem',
  width: '100%',
  maxHeight: '100%',
});

export const MobileSongList = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
});

export const AddSongsSection = styled(Box)({
  flexShrink: 0,
  marginBottom: '1rem',
});

export const AddSongsButton = styled(Button)({
  width: '100%',
  textTransform: 'none',
  borderRadius: '6.25rem',
  paddingBlock: '0.5rem',
  fontSize: '0.875rem',
  fontWeight: 500,
});

export const StyledButton = styled(Button)({
  textTransform: 'none',
  borderRadius: '100px',
  paddingBlock: '0.5rem',
});

export const CancelButton = styled(Button)(({ theme }) => ({
  marginRight: '0.5rem',
  textTransform: 'none',
  borderRadius: '100px',
  border: `1px solid ${theme.palette.outline.main}`,
  paddingInline: '1.5rem',
}));

export const SearchContainer = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.20), 0px 0.1px 0.3px 0px rgba(0, 0, 0, 0.10)',
  background: theme.palette.surface.containerHigh,
  borderRadius: '100px',
  paddingInline: '0.5rem',
  flexShrink: 0,
  flexDirection: 'row',
  width: '100%',
}));

export const SearchIcon = styled(Search)(({ theme }) => ({
  marginInline: '0.5rem',
  color: theme.palette.onSurface.variant,
}));

export const SongSearchInput = styled(InputBase)(({ theme }) => ({
  marginBlock: '0.75rem',
  color: theme.palette.onSurface.variant,
  backgroundColor: theme.palette.surface.containerHigh,
  borderRadius: '20.5rem',
}));

export const SongCard = styled(Container)(({ theme }) => ({
  borderRadius: '0.5rem',
  border: `1px solid ${theme.palette.outline.variant}`,
  backgroundColor: theme.palette.primary.darkest,
  padding: '1rem',
  '&:hover': {
    borderColor: theme.palette.secondary.main,
    cursor: 'pointer',
  },
  transition: 'all 0.1s ease-in-out',
  minWidth: '100%',
  maxWidth: '100%',
  flexShrink: 0,
}));

export const SongCardHeader = styled(Stack)({
  justifyContent: 'space-between',
  width: '100%',
  padding: 0,
  marginBottom: '1rem',
});

export const AddButton = styled(IconButton)<{ isAdded?: boolean }>(({ theme, isAdded }) => ({
  width: '32px',
  height: '32px',
  border: '2px solid',
  borderRadius: '50%',
  color: theme.palette.primary.lighter,
  '&:hover': {
    color: theme.palette.secondary.main,
  },
  ...(isAdded && {
    backgroundColor: theme.palette.secondary.main,
    color: theme.palette.primary.darkest,
  }),
}));

export const SongDetails = styled(Stack)({
  maxWidth: '100%',
  flexWrap: 'wrap',
  gap: '0.5rem',
});

export const DetailField = styled(Stack)({
  gap: '0.5rem',
  width: 'fit-content',
  maxWidth: '100%',
  alignItems: 'center',
  justifyContent: 'flex-start',
});

export const DrawerContent = styled(Box)({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  padding: '1rem',
});

export const DrawerBody = styled(Box)({
  flex: 1,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});
