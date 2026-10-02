import { FC, MouseEvent, ReactNode, SyntheticEvent, useCallback, useEffect, useState } from 'react';
import {
  Box,
  Divider,
  IconButton,
  List,
  ListItem,
  Snackbar,
  SnackbarCloseReason,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import { useTheme } from '@mui/material/styles';
import { useLocation, useNavigate } from 'react-router-dom';
import SetlistFolderDrawer from './SetlistFolderDrawer';
import SetlistTabsCollapsibleGroup from './SetlistTabsCollapsibleGroup';
import SetlistTabsFolderItem from './SetlistTabsFolderItem';
import SetlistTabsSearchField from './SetlistTabsSearchField';
import SetlistTabsSetlistItem from './SetlistTabsSetlistItem';
import useSetlistTabsData from './hooks/useSetlistTabsData';
import { useOwnership } from '../../helpers/customHooks';
import { Setlist, SetlistFolder } from '../../types/setlist.types';

interface TabPanelProps {
  children?: ReactNode;
  index: number;
  value: number;
}

interface SnackbarState {
  open: boolean;
  message: string;
}

const SNACKBAR_AUTO_HIDE_DURATION = 5000;

const SetlistTabPanel: FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
};

const SetlistTabsContainer: FC = () => {
  const ownership = useOwnership();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  const [tab, setTab] = useState(0);
  const [filteredSetlists, setFilteredSetlists] = useState<Setlist[]>([]);
  const [filteredPersonalSetlists, setFilteredPersonalSetlists] = useState<Setlist[]>([]);
  const [filteredSharedSetlists, setFilteredSharedSetlists] = useState<Setlist[]>([]);
  const [filteredFolders, setFilteredFolders] = useState<SetlistFolder[]>([]);
  const [openFolders, setOpenFolders] = useState<string[]>([]);
  const [openPersonalSetlists, setOpenPersonalSetlists] = useState(true);
  const [openSharedSetlists, setOpenSharedSetlists] = useState(true);
  const [selectedSetlistId, setSelectedSetlistId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
  });

  const handleCloseSnackbar = useCallback(
    (_?: SyntheticEvent | Event, reason?: SnackbarCloseReason) => {
      if (reason === 'clickaway') return;
      setSnackbar((prev) => ({ ...prev, open: false }));
    },
    []
  );

  const handleSnackbarOpen = useCallback((message: string) => {
    setSnackbar({ open: true, message });
  }, []);

  useEffect(() => {
    const message = location.state?.snackbarMessage;
    if (typeof message === 'string') {
      handleSnackbarOpen(message);
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
  }, [handleSnackbarOpen, location, navigate]);

  const {
    allSetlists,
    ownedSetlists,
    sharedSetlists,
    ownedFolders,
    getSetlistsAndFolders,
    handleDataRefresh,
    handleSetlistDeleted,
  } = useSetlistTabsData(ownership, handleSnackbarOpen);

  const handleSearch = useCallback(
    (term: string) => {
      const lowercasedSearchTerm = term.toLowerCase();
      const newFilteredFolders = ownedFolders.filter((folder) => {
        const folderSetlists = allSetlists.filter((s) => folder.setlistIds.includes(s._id));

        return (
          folder.groupName.toLowerCase().includes(lowercasedSearchTerm) ||
          folderSetlists.some((setlist) =>
            setlist.name.toLowerCase().includes(lowercasedSearchTerm)
          )
        );
      });
      const newFilteredPersonal = ownedSetlists.filter((setlist) =>
        setlist.name.toLowerCase().includes(lowercasedSearchTerm)
      );
      const newFilteredShared = sharedSetlists.filter((setlist) =>
        setlist.name.toLowerCase().includes(lowercasedSearchTerm)
      );
      const newFilteredSetlists = [...newFilteredPersonal, ...newFilteredShared];
      setFilteredPersonalSetlists(newFilteredPersonal);
      setFilteredSharedSetlists(newFilteredShared);
      setFilteredSetlists(newFilteredSetlists);
      setFilteredFolders(newFilteredFolders);
    },
    [allSetlists, ownedFolders, ownedSetlists, sharedSetlists]
  );

  useEffect(() => {
    handleSearch(searchTerm);
  }, [searchTerm, handleSearch]);

  useEffect(() => {
    getSetlistsAndFolders();
  }, [getSetlistsAndFolders]);

  const toggleOpenFolder = (id: string) => {
    if (isTablet || isDesktop) {
      setOpenFolders((prev) =>
        prev.includes(id)
          ? prev.filter((selectedFolderId) => selectedFolderId !== id)
          : [...prev, id]
      );
    } else {
      navigate(`/setlist/folder/${id}`);
    }
  };

  const handleSelectSetlist = (id: string) => {
    setSelectedSetlistId(id);
    navigate(isTablet || isDesktop ? `/setlist/${id}` : `/setlist/details/${id}`);
  };

  const [menuState, setMenuState] = useState({
    anchorEl: null as HTMLElement | null,
    currentSetlistId: null as string | null,
    currentFolderId: null as string | null,
  });

  const handleMenuOpen = (
    event: MouseEvent<HTMLButtonElement>,
    setlistId: string,
    folderId: string
  ) => {
    event.stopPropagation();
    setMenuState({
      anchorEl: event.currentTarget,
      currentSetlistId: setlistId,
      currentFolderId: folderId,
    });
  };

  const handleMenuClose = () => {
    setMenuState({
      anchorEl: null,
      currentSetlistId: null,
      currentFolderId: null,
    });
  };

  const isMenuOpenFor = (setlistId: string, folderId: string) =>
    menuState.anchorEl !== null &&
    menuState.currentSetlistId === setlistId &&
    menuState.currentFolderId === folderId;

  const renderNestedSetlistItem = (setlistId: string, folderId: string) => {
    const setlist = allSetlists.find((s) => s._id === setlistId);
    if (!setlist) return null;

    return (
      <SetlistTabsSetlistItem
        key={setlistId}
        setlist={setlist}
        isNested
        isSelected={selectedSetlistId === setlistId && selectedFolderId === folderId}
        onSelect={() => {
          setSelectedFolderId(folderId);
          handleSelectSetlist(setlistId);
        }}
        onMenuOpen={(e) => handleMenuOpen(e, setlistId, folderId)}
        menuAnchorEl={menuState.anchorEl}
        isMenuOpen={isMenuOpenFor(setlistId, folderId)}
        onMenuClose={handleMenuClose}
        handleSnackbarOpen={handleSnackbarOpen}
        onSetlistDeleted={handleSetlistDeleted}
        onFolderAssignmentChanged={handleDataRefresh}
      />
    );
  };

  const renderFolderItem = (folder: SetlistFolder) => (
    <SetlistTabsFolderItem
      key={folder._id}
      folder={folder}
      isOpen={openFolders.includes(folder._id)}
      isExpandIconVisible={isTablet || isDesktop}
      onToggle={() => toggleOpenFolder(folder._id)}
      onOpenDrawer={() => {
        setSelectedFolderId(folder._id);
        toggleFolderDrawer(true);
      }}
      renderSetlistItem={(setlistId) => renderNestedSetlistItem(setlistId, folder._id)}
    />
  );

  const renderSetlistItem = (setlist: Setlist) => (
    <SetlistTabsSetlistItem
      key={setlist._id}
      setlist={setlist}
      isSelected={selectedSetlistId === setlist._id && selectedFolderId === ''}
      onSelect={() => {
        handleSelectSetlist(setlist._id);
        setSelectedFolderId('');
      }}
      onMenuOpen={(e) => handleMenuOpen(e, setlist._id, '')}
      menuAnchorEl={menuState.anchorEl}
      isMenuOpen={isMenuOpenFor(setlist._id, '')}
      onMenuClose={handleMenuClose}
      handleSnackbarOpen={handleSnackbarOpen}
      onSetlistDeleted={handleSetlistDeleted}
      onFolderAssignmentChanged={handleDataRefresh}
    />
  );

  const renderEmptyState = (message: string) => (
    <ListItem>
      <Typography variant="subtitle1" color="primary.main">
        {message}
      </Typography>
    </ListItem>
  );

  const [openDrawer, setOpenDrawer] = useState<boolean>(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [folderName, setFolderName] = useState<string>('');
  const [folderCreated, setFolderCreated] = useState<string>('');
  const toggleFolderDrawer = (newOpen: boolean) => {
    setOpenDrawer(newOpen);
    if (!newOpen) {
      handleDataRefresh('folders');
    }
  };

  return (
    <Box display="flex" flex={1} flexDirection={'column'} sx={{ overflow: 'hidden' }}>
      <Tabs
        selectionFollowsFocus
        variant="fullWidth"
        value={tab}
        onChange={(_, newValue: number) => setTab(newValue)}
        textColor={'secondary'}
        indicatorColor={'secondary'}
      >
        <Tab sx={{ textTransform: 'none', fontSize: '1rem' }} label="All" />
        <Tab sx={{ textTransform: 'none', fontSize: '1rem' }} label="Folders" />
        <Tab sx={{ textTransform: 'none', fontSize: '1rem' }} label="Setlists" />
      </Tabs>

      <Divider sx={{ borderColor: 'outline.variant' }} />

      <SetlistTabsSearchField searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      <Box sx={{ overflowY: 'auto', flex: 1 }}>
        <SetlistTabPanel value={tab} index={0}>
          <List>
            {filteredFolders.length > 0 || filteredSetlists.length > 0 ? (
              <>
                {filteredFolders.map(renderFolderItem)}
                {filteredSetlists.map(renderSetlistItem)}
              </>
            ) : (
              renderEmptyState('No Setlists or Folders Found')
            )}
          </List>
        </SetlistTabPanel>

        <SetlistTabPanel value={tab} index={1}>
          <List>
            {filteredFolders && filteredFolders.length > 0
              ? filteredFolders.map(renderFolderItem)
              : renderEmptyState('No Folders Found')}
          </List>
        </SetlistTabPanel>

        <SetlistTabPanel value={tab} index={2}>
          <List>
            <SetlistTabsCollapsibleGroup
              title="Personal Setlists"
              open={openPersonalSetlists}
              onToggle={() => setOpenPersonalSetlists(!openPersonalSetlists)}
            >
              {filteredPersonalSetlists && filteredPersonalSetlists.length > 0
                ? filteredPersonalSetlists.map(renderSetlistItem)
                : renderEmptyState('No Personal Setlists Found')}
            </SetlistTabsCollapsibleGroup>
            <SetlistTabsCollapsibleGroup
              title="Shared Setlists"
              open={openSharedSetlists}
              onToggle={() => setOpenSharedSetlists(!openSharedSetlists)}
            >
              {filteredSharedSetlists && filteredSharedSetlists.length > 0
                ? filteredSharedSetlists.map(renderSetlistItem)
                : renderEmptyState('No Shared Setlists Found')}
            </SetlistTabsCollapsibleGroup>
          </List>
        </SetlistTabPanel>
      </Box>
      <SetlistFolderDrawer
        openDrawer={openDrawer}
        toggleFolderDrawer={toggleFolderDrawer}
        setFolderId={setSelectedFolderId}
        setFolderName={setFolderName}
        setFolderCreated={setFolderCreated}
        folderId={selectedFolderId}
        folderName={folderName}
        folderCreated={folderCreated}
        mode={'edit'}
      />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={SNACKBAR_AUTO_HIDE_DURATION}
        onClose={handleCloseSnackbar}
        message={snackbar.message}
        action={
          <IconButton size="small" color="inherit" onClick={handleCloseSnackbar} aria-label="close">
            <Close fontSize="small" />
          </IconButton>
        }
      />
    </Box>
  );
};

export default SetlistTabsContainer;
