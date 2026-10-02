import { FC, useCallback, useEffect, useState } from 'react';
import { Alert, Drawer, Typography, useMediaQuery, useTheme } from '@mui/material';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import MusicNote from '@mui/icons-material/MusicNote';
import QueueMusic from '@mui/icons-material/QueueMusic';
import { AxiosResponse } from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { customAxios as axios } from '../custom/customAxios';
import HeaderWithIcon from '../custom/HeaderWithIcon';
import PageHeader from '../navigation/PageHeader';
import SetlistEditorActionButtons from './SetlistEditorActionButtons';
import SetlistEditorDetailsSection from './SetlistEditorDetailsSection';
import SetlistEditorMobileActionButtons from './SetlistEditorMobileActionButtons';
import SetlistEditorSongSearchSection from './SetlistEditorSongSearchSection';
import SetlistEditorSuccessSnackbar from './SetlistEditorSuccessSnackbar';
import SetlistSongsTable from './SetlistSongsTable';
import useSetlistEditorData from './hooks/useSetlistEditorData';
import useSetlistSongSearch from './hooks/useSetlistSongSearch';
import { useOwnership } from '../../helpers/customHooks';
import { SetlistEditorFields, SetlistEditorProps } from '../../types/setlist.types';
import { SongSetlistSchema } from '../../types/song.types';
import {
  AddSongsButton,
  AddSongsSection,
  ContentWrapper,
  DrawerBody,
  DrawerContent,
  MainContainer,
  MobileSongList,
  SectionsContainer,
  StyledButton,
} from './SetlistEditor.styles';
import { logRequestError } from '../../helpers/global';

const SetlistEditorContainer: FC<SetlistEditorProps> = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobileOrSmallTablet = !isTablet && !isDesktop;

  const ownership = useOwnership();

  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    reset,
  } = useForm<SetlistEditorFields>();
  const { id: routeSetlistId } = useParams();
  const setlistId = routeSetlistId ?? '';
  const action = setlistId ? 'edit' : 'new';

  const [date, setDate] = useState<Dayjs | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const { filterData, songResults, loading, handleScroll, handleFilterChange } =
    useSetlistSongSearch(setErrorMessage);

  const [addedSongList, setAddedSongList] = useState<SongSetlistSchema[]>([]);
  const [folderList, setFolderList] = useState<string[]>([]);

  const [successSnackbarOpen, setSuccessSnackbarOpen] = useState(false);
  const [invalidSetlist, setInvalidSetlist] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { setlist, folderOptions } = useSetlistEditorData(setlistId, ownership, setErrorMessage);

  useEffect(() => {
    if (setlist) {
      const setlistDate = setlist.date ? dayjs(setlist.date) : null;
      const setlistSongs = setlist.songs ?? [];
      const setlistGroupIds = setlist.groupIds ?? [];
      reset({
        name: setlist.name,
        date: setlistDate ?? undefined,
        songs: setlistSongs,
      });
      setDate(setlistDate);
      setAddedSongList(setlistSongs);
      setFolderList(
        folderOptions
          .filter((folder) => setlistGroupIds.includes(folder._id))
          .map((folder) => folder.groupName)
      );
    }
  }, [setlist, folderOptions, reset]);

  const handleSaveSetlist: SubmitHandler<SetlistEditorFields> = async (data) => {
    try {
      const isEditSetlist = action === 'edit';

      // Get updated folder IDs
      const updatedSetlistFolderIds: string[] = folderOptions
        .filter((folder) => folderList.includes(folder.groupName))
        .map((folder) => folder._id);

      const songKeys = addedSongList
        .filter((song) => song.key && song.key !== song.originalKey)
        .map((song) => ({ songId: song._id, key: song.key }));

      // Create/update setlist
      const payload = await (isEditSetlist
        ? axios.put('/api/setlists/update', {
            id: setlistId,
            name: data.name,
            date: date ? date.toDate() : null,
            songs: addedSongList.map((song) => song._id),
            songKeys,
            groupIds: updatedSetlistFolderIds,
          })
        : axios.post('/api/setlists/create', {
            name: data.name,
            date: date ? date.toDate() : null,
            songs: addedSongList.map((song) => song._id),
            songKeys,
            groupIds: updatedSetlistFolderIds,
            createdBy: ownership.userId,
          }));

      if (payload.status !== 200) {
        throw new Error('Failed to save setlist');
      }

      const savedSetlistId = payload.data._id;

      // Prepare all update promises
      const promises: Promise<AxiosResponse<unknown> | undefined>[] = [];

      // Add ownership update if needed
      const ownedSetlistIds = ownership?.setlistIds ?? [];
      const isOwnedSetlist = ownedSetlistIds.some((setlist) => setlist.id === payload.data._id);

      if (!isOwnedSetlist) {
        promises.push(
          axios.put('/api/ownerships/update', {
            ...ownership,
            setlistIds: [
              ...ownedSetlistIds,
              {
                id: payload.data._id,
                name: payload.data.name,
                createdAt: payload.data.createdAt,
              },
            ],
          })
        );
      }

      // Add folder update promises
      if (isEditSetlist && setlist) {
        const originalFolderIds = setlist.groupIds || [];
        const foldersToAdd = updatedSetlistFolderIds.filter(
          (id) => !originalFolderIds.includes(id)
        );
        const foldersToRemove = originalFolderIds.filter(
          (id) => !updatedSetlistFolderIds.includes(id)
        );

        // Helper function to update folder
        const updateFolder = (folderId: string, shouldAdd: boolean) => {
          const folder = folderOptions.find((f) => f._id === folderId);
          if (!folder) return Promise.resolve(undefined);

          const currentSetlistIds = folder.setlistIds || [];
          const newSetlistIds = shouldAdd
            ? Array.from(new Set([...currentSetlistIds, savedSetlistId]))
            : currentSetlistIds.filter((id) => id !== savedSetlistId);

          return axios.put('/api/groups/update', {
            id: folderId,
            setlistIds: newSetlistIds,
          });
        };

        // Add folder update promises
        promises.push(
          ...foldersToAdd.map((folderId) => updateFolder(folderId, true)),
          ...foldersToRemove.map((folderId) => updateFolder(folderId, false))
        );
      } else if (!isEditSetlist) {
        // For new setlists, just add to all selected folders
        const folderUpdatePromises = updatedSetlistFolderIds.map((folderId) => {
          const folder = folderOptions.find((f) => f._id === folderId);
          return folder
            ? axios.put('/api/groups/update', {
                id: folderId,
                setlistIds: Array.from(new Set([...(folder.setlistIds || []), savedSetlistId])),
              })
            : Promise.resolve(undefined);
        });

        promises.push(...folderUpdatePromises);
      }

      // Execute all updates
      if (promises.length > 0) {
        const results = await Promise.all(promises);
        const allSuccessful = results.every((res) => res?.status === 200);

        if (!allSuccessful) {
          console.warn('Some updates failed, but setlist was saved');
        }
      }

      // Success - clear errors and redirect
      setInvalidSetlist('');
      setSuccessSnackbarOpen(true);
      //TODO: Find a better way to redirect to list and refetch the newly created/updated setlist.
      if (isTablet || isDesktop) {
        window.location.href = `/setlist/${savedSetlistId}`;
      } else {
        window.location.href = `/setlist/details/${savedSetlistId}`;
      }
    } catch (error) {
      logRequestError('Error saving setlist:', error);
      setInvalidSetlist('Could not save this setlist. Please try again.');
      setSuccessSnackbarOpen(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  const handleAddSong = useCallback(
    (songId: string) => {
      const existingSongIndex = addedSongList.findIndex((song) => song._id === songId);

      if (existingSongIndex >= 0) {
        const removedSong = addedSongList[existingSongIndex];
        const updatedList = addedSongList
          .filter((_, index) => index !== existingSongIndex)
          .map((song) => ({
            ...song,
            sequence:
              (song.sequence ?? 0) > (removedSong.sequence ?? 0)
                ? (song.sequence ?? 0) - 1
                : song.sequence ?? 0,
          }));

        setAddedSongList(updatedList);
      } else {
        const songToAdd = songResults.find((song) => song._id === songId);
        if (!songToAdd) return;

        const newSong: SongSetlistSchema = {
          ...songToAdd,
          key: songToAdd.originalKey,
          sequence: addedSongList.length + 1,
        };

        setAddedSongList((prev) => [...prev, newSong]);
      }

      if (isMobileOrSmallTablet) {
        setDrawerOpen(false);
      }
    },
    [addedSongList, songResults, isMobileOrSmallTablet]
  );

  const addedSongIds = addedSongList.map((song) => song._id);

  return (
    <form onSubmit={handleSubmit(handleSaveSetlist)}>
      <MainContainer isMobileOrSmallTablet={isMobileOrSmallTablet} disableGutters>
        <ContentWrapper>
          {errorMessage && (
            <Typography variant="body2" color="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Typography>
          )}

          {invalidSetlist && (
            <Alert severity="error" onClose={() => setInvalidSetlist('')} sx={{ mb: 2 }}>
              {invalidSetlist}
            </Alert>
          )}

          <SetlistEditorSuccessSnackbar
            open={successSnackbarOpen}
            onClose={() => setSuccessSnackbarOpen(false)}
          />

          <PageHeader
            title={`${action === 'edit' ? 'Edit' : 'New'} Setlist`}
            icon={<QueueMusic />}
            actionButtons={
              !isMobileOrSmallTablet && (
                <SetlistEditorActionButtons onCancel={handleCancel} isSubmitting={isSubmitting} />
              )
            }
          />

          <SectionsContainer isMobileOrSmallTablet={isMobileOrSmallTablet}>
            <SetlistEditorDetailsSection
              control={control}
              errors={errors}
              date={date}
              onDateChange={setDate}
              folderOptions={folderOptions}
              folderList={folderList}
              onFolderChange={setFolderList}
              addedSongList={addedSongList}
              setAddedSongList={setAddedSongList}
              isMobileOrSmallTablet={isMobileOrSmallTablet}
            />

            {isMobileOrSmallTablet ? (
              <MobileSongList>
                <HeaderWithIcon
                  Icon={MusicNote}
                  headerText="Songs"
                  headerVariant="h3"
                  iconColor="secondary.main"
                  headerColor="secondary.main"
                />
                <AddSongsSection>
                  <AddSongsButton
                    variant="outlined"
                    color="secondary"
                    startIcon={<AddCircleOutline />}
                    onClick={() => setDrawerOpen(true)}
                  >
                    Add Songs
                  </AddSongsButton>
                </AddSongsSection>
                <SetlistSongsTable songList={addedSongList} setSongList={setAddedSongList} />
              </MobileSongList>
            ) : (
              <SetlistEditorSongSearchSection
                filterData={filterData}
                setFilterData={handleFilterChange}
                songResults={songResults}
                isLoading={loading}
                isMobileOrSmallTablet={isMobileOrSmallTablet}
                isTablet={isTablet}
                onAddSong={handleAddSong}
                onResultsScroll={handleScroll}
                addedSongIds={addedSongIds}
              />
            )}
          </SectionsContainer>

          {isMobileOrSmallTablet && (
            <Drawer
              anchor="bottom"
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              PaperProps={{
                sx: {
                  height: '100%',
                  bgcolor: 'background.default',
                },
              }}
            >
              <DrawerContent>
                <DrawerBody>
                  <SetlistEditorSongSearchSection
                    filterData={filterData}
                    setFilterData={handleFilterChange}
                    songResults={songResults}
                    isLoading={loading}
                    isMobileOrSmallTablet={isMobileOrSmallTablet}
                    isTablet={isTablet}
                    onAddSong={handleAddSong}
                    onResultsScroll={handleScroll}
                    addedSongIds={addedSongIds}
                    showHeader={false}
                  />
                </DrawerBody>
                <StyledButton
                  color="secondary"
                  variant="contained"
                  onClick={() => setDrawerOpen(false)}
                >
                  Done
                </StyledButton>
              </DrawerContent>
            </Drawer>
          )}
        </ContentWrapper>
        {isMobileOrSmallTablet && (
          <SetlistEditorMobileActionButtons onCancel={handleCancel} isSubmitting={isSubmitting} />
        )}
      </MainContainer>
    </form>
  );
};

export default SetlistEditorContainer;
