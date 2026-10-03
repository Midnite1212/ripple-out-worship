import { Fragment, MouseEvent, SyntheticEvent, useCallback, useRef } from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Snackbar,
  SnackbarCloseReason,
  Typography,
  styled,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import Folder from '@mui/icons-material/Folder';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import QueueMusic from '@mui/icons-material/QueueMusic';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import MobileBackButton from '../navigation/MobileBackButton';
import SetlistActionsMenu from './SetlistActionsMenu';
import SetlistFolderDrawer from './SetlistFolderDrawer';
import useFolderData from './hooks/useFolderData';
import useFolderDrawer from './hooks/useFolderDrawer';
import useSetlistMenu, { MenuState } from './hooks/useSetlistMenu';
import useSnackbar, { SnackbarState } from './hooks/useSnackbar';
import { Setlist, SetlistFolder } from '../../types/setlist.types';

const SNACKBAR_AUTO_HIDE_DURATION = 5000;

const STYLES = {
  header: {
    color: 'secondary.main',
    '& .MuiListItemText-primary': {
      color: 'primary.lighter',
      fontWeight: 700,
      fontSize: '1.125rem',
    },
    '& .MuiListItemText-secondary': {
      color: 'onSurface.variant',
      fontWeight: 500,
      fontSize: '0.875rem',
    },
  },
  listItemText: {
    color: 'secondary.main',
    '& .MuiListItemText-primary': {
      color: 'primary.lighter',
      fontWeight: 700,
      fontSize: '1rem',
    },
    '& .MuiListItemText-secondary': {
      color: 'onSurface.variant',
      fontWeight: 500,
      fontSize: '0.75rem',
    },
  },
  listItemIcon: {
    color: 'secondary.main',
    fontSize: '1.75rem',
  },
} as const;

const MainContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  width: '100%',
  padding: 0,
});

const HeaderContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  alignItems: 'flex-start',
  backgroundColor: theme.palette.primary.darkest,
  padding: '1rem',
}));

const ListContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  width: '100%',
  padding: 0,
});

const LoadingContainer = styled(Box)({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '200px',
  flexDirection: 'column',
  gap: '1rem',
});

const formatDate = (date?: Date | string | null): string => {
  if (!date) return '';
  const parsedDate = dayjs(date);
  return parsedDate.isValid() ? parsedDate.format('YYYY-MM-DD') : '';
};

const LoadingState: React.FC = () => (
  <LoadingContainer>
    <CircularProgress size={40} />
    <Typography variant="body2" color="textSecondary">
      Loading folder details...
    </Typography>
  </LoadingContainer>
);

const ErrorState: React.FC<{ message: string }> = ({ message }) => (
  <Box p={2} textAlign="center">
    <Typography color="error" variant="h6">
      {message}
    </Typography>
  </Box>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <ListItem>
    <Typography variant="subtitle1" color="primary.main">
      {message}
    </Typography>
  </ListItem>
);

const FolderHeader: React.FC<{
  folder: SetlistFolder;
  onDrawerOpen: () => void;
}> = ({ folder, onDrawerOpen }) => (
  <HeaderContainer>
    <MobileBackButton path="/setlist" />
    <ListItemButton sx={{ width: '100%' }} disableRipple disableTouchRipple>
      <ListItemIcon sx={{ minWidth: '40px', mr: '0.5rem' }}>
        <Folder sx={STYLES.listItemIcon} />
      </ListItemIcon>
      <ListItemText primary={folder.groupName} sx={STYLES.header} />
      <IconButton onClick={onDrawerOpen}>
        <MoreVertRounded sx={{ color: 'secondary.lighter', fontSize: '1.75rem' }} />
      </IconButton>
    </ListItemButton>
  </HeaderContainer>
);

const SetlistItem: React.FC<{
  setlist: Setlist;
  onNavigate: (id: string) => void;
  onMenuOpen: (event: MouseEvent<HTMLButtonElement>, setlistId: string) => void;
  menuState: MenuState;
  onMenuClose: () => void;
  onSnackbarOpen: (message: string) => void;
  onSetlistDeleted: (setlistId: string) => void;
  onFolderRefresh: () => Promise<void>;
}> = ({
  setlist,
  onNavigate,
  onMenuOpen,
  menuState,
  onMenuClose,
  onSnackbarOpen,
  onSetlistDeleted,
  onFolderRefresh,
}) => (
  <Fragment key={setlist._id}>
    <ListItem sx={{ paddingX: '0.75rem' }} disablePadding disableGutters>
      <ListItemButton
        sx={{ borderBottom: (theme) => `1px solid ${theme.palette.outline.variant}` }}
        onClick={() => onNavigate(setlist._id)}
      >
        <ListItemIcon sx={{ minWidth: '40px', mr: '0.5rem' }}>
          <QueueMusic sx={STYLES.listItemIcon} />
        </ListItemIcon>
        <ListItemText
          primary={setlist.name}
          secondary={formatDate(setlist.date)}
          sx={STYLES.listItemText}
        />
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            onMenuOpen(e, setlist._id);
          }}
          aria-controls={`setlist-menu-${setlist._id}`}
          aria-haspopup="true"
          aria-label={`Open menu for setlist ${setlist.name}`}
        >
          <MoreVertRounded sx={{ color: 'secondary.lighter', fontSize: '1.75rem' }} />
        </IconButton>
      </ListItemButton>
      <SetlistActionsMenu
        anchorEl={menuState.anchorEl}
        open={menuState.anchorEl !== null && menuState.currentSetlistId === setlist._id}
        onClose={onMenuClose}
        setlist={setlist}
        handleSnackbarOpen={onSnackbarOpen}
        onSetlistDeleted={onSetlistDeleted}
        onFolderAssignmentChanged={onFolderRefresh}
      />
    </ListItem>
  </Fragment>
);

const SetlistSection: React.FC<{
  setlists: Setlist[];
  onNavigate: (id: string) => void;
  menuProps: {
    menuState: MenuState;
    onMenuOpen: (event: MouseEvent<HTMLButtonElement>, setlistId: string) => void;
    onMenuClose: () => void;
  };
  onSnackbarOpen: (message: string) => void;
  onSetlistDeleted: (setlistId: string) => void;
  onFolderRefresh: () => Promise<void>;
}> = ({ setlists, onNavigate, menuProps, onSnackbarOpen, onSetlistDeleted, onFolderRefresh }) => (
  <ListContainer>
    <Box width="100%" sx={{ p: '1rem' }}>
      <Typography color="onSurface.neutral" fontSize="0.75rem" fontWeight={700}>
        Setlists ({setlists.length})
      </Typography>
    </Box>
    <List disablePadding>
      {setlists.length > 0 ? (
        setlists.map((setlist) => (
          <SetlistItem
            key={setlist._id}
            setlist={setlist}
            onNavigate={onNavigate}
            onMenuOpen={menuProps.onMenuOpen}
            menuState={menuProps.menuState}
            onMenuClose={menuProps.onMenuClose}
            onSnackbarOpen={onSnackbarOpen}
            onSetlistDeleted={onSetlistDeleted}
            onFolderRefresh={onFolderRefresh}
          />
        ))
      ) : (
        <EmptyState message="No setlists found in this folder" />
      )}
    </List>
  </ListContainer>
);

const CustomSnackbar: React.FC<{
  snackbar: SnackbarState;
  onClose: (event?: SyntheticEvent | Event, reason?: SnackbarCloseReason) => void;
}> = ({ snackbar, onClose }) => (
  <Snackbar
    open={snackbar.open}
    autoHideDuration={SNACKBAR_AUTO_HIDE_DURATION}
    onClose={onClose}
    message={snackbar.message}
    action={
      <IconButton size="small" color="inherit" onClick={onClose} aria-label="close">
        <Close fontSize="small" />
      </IconButton>
    }
  />
);

const SetlistFolderDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const {
    snackbar,
    handleOpen: handleSnackbarOpen,
    handleClose: handleSnackbarClose,
  } = useSnackbar();
  const { menuState, handleOpen: handleMenuOpen, handleClose: handleMenuClose } = useSetlistMenu();
  const drawer = useFolderDrawer();
  const isFolderDeletedRef = useRef(false);

  const { folder, setlists, loading, error, refreshFolder, removeSetlist } = useFolderData(
    id,
    handleSnackbarOpen
  );

  const handleNavigateToSetlist = useCallback(
    (setlistId: string) => {
      navigate(`/setlist/details/${setlistId}`);
    },
    [navigate]
  );

  const handleDrawerOpen = useCallback(() => {
    if (folder) {
      drawer.setFolderId(folder._id);
      drawer.setFolderName(folder.groupName);
      drawer.setFolderCreated(folder.createdAt || '');
    }
    drawer.toggle(true);
  }, [folder, drawer]);

  const { toggle: toggleDrawer } = drawer;
  const handleDrawerToggle = useCallback(
    (newOpen: boolean) => {
      toggleDrawer(newOpen);
      if (!newOpen && !isFolderDeletedRef.current) refreshFolder();
    },
    [refreshFolder, toggleDrawer]
  );

  const handleFolderDeleted = useCallback(() => {
    isFolderDeletedRef.current = true;
    navigate('/setlist', { state: { snackbarMessage: 'Folder deleted.' } });
  }, [navigate]);

  if (!id) {
    return <ErrorState message="No folder ID provided" />;
  }

  if (loading) {
    return (
      <MainContainer>
        <LoadingState />
      </MainContainer>
    );
  }

  if (error || !folder) {
    return (
      <MainContainer>
        <ErrorState message={error || 'Folder not found'} />
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <FolderHeader folder={folder} onDrawerOpen={handleDrawerOpen} />

      <SetlistSection
        setlists={setlists}
        onNavigate={handleNavigateToSetlist}
        menuProps={{
          menuState,
          onMenuOpen: handleMenuOpen,
          onMenuClose: handleMenuClose,
        }}
        onSnackbarOpen={handleSnackbarOpen}
        onSetlistDeleted={removeSetlist}
        onFolderRefresh={refreshFolder}
      />

      <SetlistFolderDrawer
        openDrawer={drawer.isOpen}
        toggleFolderDrawer={handleDrawerToggle}
        setFolderId={drawer.setFolderId}
        setFolderName={drawer.setFolderName}
        setFolderCreated={drawer.setFolderCreated}
        folderId={drawer.folderId}
        folderName={drawer.folderName}
        folderCreated={drawer.folderCreated}
        mode="edit"
        onFolderDeleted={handleFolderDeleted}
      />

      <CustomSnackbar snackbar={snackbar} onClose={handleSnackbarClose} />
    </MainContainer>
  );
};

export default SetlistFolderDetail;
