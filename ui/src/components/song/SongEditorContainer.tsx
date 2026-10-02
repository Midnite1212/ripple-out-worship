import { FC, useCallback, useEffect, useState } from 'react';
import DeleteIcon from '@mui/icons-material/Delete';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { customAxios as axios } from '../custom/customAxios';
import { SongSchema } from '../../types/song.types';
import { SongEditorFormFields } from '../../types/form.types';
import {
  musicKeysOptions,
  tempoOptions,
  timeSignatureOptions,
  themeOptions,
} from '../../constants';
import SongHelpDialog from './SongHelpDialog';
import {
  Box,
  Container,
  useMediaQuery,
  Typography,
  Grid,
  TextField,
  Stack,
  TextareaAutosize,
  FormControl,
  Button,
  Alert,
  AlertTitle,
  Snackbar,
  Fade,
  Chip,
  Autocomplete,
  Divider,
  Theme,
} from '@mui/material';

// ICONS
import InfoIcon from '@mui/icons-material/Info';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import AutocompleteInput from '../custom/AutocompleteInput';
import { useNavigate, useParams } from 'react-router-dom';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PageHeader from '../navigation/PageHeader';
import HeaderWithIcon from '../custom/HeaderWithIcon';
import { findFirstLetterLyrics, logRequestError } from '../../helpers/global';
import { getNextSongCode } from '../../helpers/song/songCode';
import SongDeleteDialog from './SongDeleteDialog';

const requiredString = (message: string) =>
  z.string({ invalid_type_error: message, required_error: message }).min(1, message);

const songEditorValidationSchema: z.ZodType<SongEditorFormFields> = z.object({
  title: requiredString('Song title is required'),
  artist: requiredString('Artist name is required'),
  originalKey: requiredString('Original key is required'),
  themes: z.array(z.string()).min(1, 'At least one theme must be selected'),
  tempo: z.array(z.string()),
  timeSignature: z.array(z.string()),
  recommendedKeys: z.array(z.string()),
  year: z.string().nullish(),
  code: z.string().nullish(),
  chordLyrics: requiredString('Chord lyrics are required'),
  simplifiedChordLyrics: z.string().nullish(),
});

const SONG_EDITOR_DEFAULT_VALUES: SongEditorFormFields = {
  title: '',
  artist: '',
  originalKey: '',
  themes: [],
  tempo: [],
  timeSignature: [],
  recommendedKeys: [],
  year: '',
  code: '',
  chordLyrics: '',
  simplifiedChordLyrics: '',
};

const SongEditorContainer: FC = () => {
  // hook to detect the window size
  const isDesktop = useMediaQuery((theme: Theme) => theme.breakpoints.up('sm'));
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const songId = id ?? '';

  const [openDeleteDialog, setOpenDeleteDialog] = useState<boolean>(false);
  const [successSnackbarOpen, setSuccessSnackbarOpen] = useState<boolean>(false);
  const [invalidSong, setInvalidSong] = useState<string>('');

  // FORM HANDLER
  const { control, formState, handleSubmit, reset, setValue, watch } =
    useForm<SongEditorFormFields>({
      resolver: zodResolver(songEditorValidationSchema),
      defaultValues: SONG_EDITOR_DEFAULT_VALUES,
    });
  const { errors } = formState;
  const themes = watch('themes');
  const tempo = watch('tempo');

  const getSong = useCallback(async () => {
    if (songId === '') return;

    try {
      const { data: song, status } = await axios.get<SongSchema>(`/api/songs/get?id=${songId}`);
      if (status === 200 && song) {
        reset({
          title: song.title,
          artist: song.artist,
          originalKey: song.originalKey,
          themes: song.themes ?? [],
          tempo: song.tempo ?? [],
          timeSignature: song.timeSignature ?? [],
          recommendedKeys: song.recommendedKeys ?? [],
          year: song.year,
          code: song.code,
          chordLyrics: song.chordLyrics,
          simplifiedChordLyrics: song.simplifiedChordLyrics,
        });
      }
    } catch (error) {
      logRequestError('Error fetching song:', error);
    }
  }, [reset, songId]);

  useEffect(() => {
    getSong();
  }, [getSong]);

  const handleSaveSong: SubmitHandler<SongEditorFormFields> = useCallback(
    async (data) => {
      try {
        let payload;
        if (isEditing) {
          payload = await axios.put('/api/songs/update', {
            id: songId,
            artist: data.artist,
            title: data.title,
            themes: data.themes,
            tempo: data.tempo,
            year: data.year,
            code: data.code,
            timeSignature: data.timeSignature,
            simplifiedChordLyrics: data.simplifiedChordLyrics,
            originalKey: data.originalKey,
            recommendedKeys: data.recommendedKeys,
            chordLyrics: data.chordLyrics,
          });
        } else {
          const songLetter = findFirstLetterLyrics(data.chordLyrics) || '';
          const code = await getNextSongCode(songLetter);
          payload = await axios.post<SongSchema>('/api/songs/create', {
            artist: data.artist,
            title: data.title,
            themes: data.themes,
            tempo: data.tempo,
            year: data.year,
            code,
            timeSignature: data.timeSignature,
            simplifiedChordLyrics: data.simplifiedChordLyrics,
            originalKey: data.originalKey,
            recommendedKeys: data.recommendedKeys,
            chordLyrics: data.chordLyrics,
          });
        }

        if (payload.status === 200) {
          setInvalidSong('');
          setSuccessSnackbarOpen(true);
          const savedSongId = isEditing ? songId : payload.data?._id;
          navigate(savedSongId ? `/song/${savedSongId}` : '/song');
          return payload.data;
        }

        handleCloseSuccessSnackbar();
        setInvalidSong('Error saving song!');
        return;
      } catch (err: unknown) {
        setInvalidSong('Could not save this song. Please try again.');
        handleCloseSuccessSnackbar();
        logRequestError('Error saving song:', err);
      }
    },
    [isEditing, navigate, songId]
  );

  const handleCloseSuccessSnackbar = () => {
    setSuccessSnackbarOpen(false);
  };

  const handleDeleteTempo = (chipToDelete: string) => () => {
    setValue(
      'tempo',
      tempo.filter((chip) => chip !== chipToDelete)
    );
  };

  const handleReactivateTempo = (chipToActivate: string) => () => {
    setValue('tempo', [...tempo, chipToActivate]);
  };

  const handleDeleteTheme = (chipToDelete: string) => () => {
    setValue(
      'themes',
      themes.filter((chip) => chip !== chipToDelete),
      { shouldValidate: true }
    );
  };

  const handleReactivateTheme = (chipToActivate: string) => () => {
    setValue('themes', [...themes, chipToActivate], { shouldValidate: true });
  };

  const songActionButtons = (
    <Box>
      <Stack direction="column">
        <Stack direction="row">
          {isEditing && isDesktop ? (
            <>
              <Button
                color="error"
                variant="outlined"
                startIcon={<DeleteIcon />}
                onClick={() => setOpenDeleteDialog(true)}
                sx={{
                  textTransform: 'none',
                  borderRadius: '100px',
                  px: 3,
                }}
              >
                Delete
              </Button>
              <Divider variant="fullWidth" orientation="vertical" flexItem sx={{ mx: 2 }} />
            </>
          ) : null}
          <Button
            type={'submit'}
            color="secondary"
            variant="contained"
            sx={{
              mr: 1,
              textTransform: 'none',
              borderRadius: '100px',
              px: 3,
            }}
          >
            Save
          </Button>
          <Button
            color={'secondary'}
            sx={{
              textTransform: 'none',
              borderRadius: '100px',
              border: 1,
              px: 2,
            }}
            onClick={() => navigate(isEditing ? `/song/${songId}` : '/song')}
          >
            Cancel
          </Button>
        </Stack>
        {isEditing && !isDesktop ? (
          <Button
            color="error"
            variant="outlined"
            startIcon={<DeleteIcon />}
            onClick={() => setOpenDeleteDialog(true)}
            sx={{
              textTransform: 'none',
              borderRadius: '100px',
              px: 3,
              py: '6px',
              width: '33%',
              mt: 2,
            }}
          >
            Delete
          </Button>
        ) : null}
      </Stack>
    </Box>
  );

  return (
    <Container sx={{ py: '1rem', px: '2rem', height: '100%', minWidth: '100%', overflow: 'auto' }}>
      <Box>
        <form onSubmit={handleSubmit(handleSaveSong)}>
          <PageHeader
            title={isEditing ? 'Edit Song' : 'New Song'}
            icon={<MusicNoteIcon />}
            actionButtons={isDesktop ? songActionButtons : null}
          />

          <Box my={'24px'}>
            {/* Error message */}
            {invalidSong ? (
              <Typography variant={'body2'} color={'error'}>
                {invalidSong}
              </Typography>
            ) : null}

            {/* Success message */}
            <Snackbar
              open={successSnackbarOpen}
              onClose={handleCloseSuccessSnackbar}
              autoHideDuration={6000}
              TransitionComponent={Fade}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
              <Alert severity="success" onClose={handleCloseSuccessSnackbar}>
                <AlertTitle>Success</AlertTitle>
                Song successfully saved!
              </Alert>
            </Snackbar>

            <Stack direction={['column', 'row']} gap={4} mt={2}>
              {/* column 1: Song Details */}
              <Box width={isDesktop ? '35vw' : 'unset'}>
                <Stack direction="column" spacing={2}>
                  {/* header */}
                  <HeaderWithIcon
                    headerText={'Song Details'}
                    headerVariant={'h4'}
                    iconColor={'secondary.main'}
                    headerColor={'secondary.main'}
                    Icon={InfoIcon}
                  />

                  {/* Song Title Field */}
                  <Controller
                    name="title"
                    control={control}
                    defaultValue=""
                    render={({ field }) => (
                      <TextField
                        {...field}
                        id="title"
                        label="Song Title*"
                        variant="outlined"
                        error={!!errors.title}
                        helperText={errors?.title?.message}
                        fullWidth
                      />
                    )}
                  />

                  {/* Artist Field */}
                  <Controller
                    name="artist"
                    control={control}
                    defaultValue=""
                    render={({ field }) => (
                      <TextField
                        {...field}
                        id="artist"
                        label="Artist Name*"
                        variant="outlined"
                        error={!!errors.artist}
                        helperText={errors?.artist?.message}
                        fullWidth
                      />
                    )}
                  />

                  {/* Themes field */}
                  <FormControl fullWidth>
                    <Box>
                      <Typography
                        variant="h4"
                        sx={{ pb: 1 }}
                        color={errors.themes ? 'error' : 'inherit'}
                      >
                        Themes*
                      </Typography>
                      {errors.themes && (
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{ mb: 1, display: 'block' }}
                        >
                          {errors.themes.message}
                        </Typography>
                      )}
                      {themeOptions.map((item) => {
                        const isSelected = themes.includes(item);
                        return (
                          <Chip
                            sx={{
                              backgroundColor: isSelected ? 'primary.dark' : 'secondary.lighter',
                              borderRadius: '8px',
                              m: 0.5,
                            }}
                            key={item}
                            label={item}
                            onDelete={isSelected ? handleDeleteTheme(item) : undefined}
                            onClick={isSelected ? undefined : handleReactivateTheme(item)}
                          />
                        );
                      })}
                    </Box>
                  </FormControl>

                  {/* Tempo field */}
                  <FormControl fullWidth>
                    <Box>
                      <Typography variant="h4" sx={{ pb: 1 }}>
                        Tempo
                      </Typography>
                      {tempoOptions.map((item) => {
                        const isSelected = tempo.includes(item);
                        return (
                          <Chip
                            sx={{
                              backgroundColor: isSelected ? 'primary.dark' : 'secondary.lighter',
                              borderRadius: '8px',
                              m: 0.5,
                            }}
                            key={item}
                            label={item}
                            onDelete={isSelected ? handleDeleteTempo(item) : undefined}
                            onClick={isSelected ? undefined : handleReactivateTempo(item)}
                          />
                        );
                      })}
                    </Box>
                  </FormControl>

                  {/* Time Signature field */}
                  <FormControl fullWidth>
                    <Controller
                      name="timeSignature"
                      control={control}
                      render={({ field }) => (
                        <AutocompleteInput
                          id="time-signature"
                          options={timeSignatureOptions}
                          label="Time Signature"
                          clearAriaLabel="Clear all selected time signatures"
                          autoComplete="time-signature"
                          value={field.value}
                          onChange={(_, newValue) => field.onChange(newValue)}
                          multiple
                        />
                      )}
                    />
                  </FormControl>

                  {/* Original Key field */}
                  <FormControl fullWidth>
                    <Controller
                      name="originalKey"
                      control={control}
                      defaultValue=""
                      render={({ field }) => (
                        <Autocomplete
                          {...field}
                          id="original-key"
                          options={musicKeysOptions}
                          getOptionLabel={(option) => option}
                          filterSelectedOptions
                          value={field.value || null}
                          onChange={(event, newValue) => field.onChange(newValue)}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              variant="outlined"
                              label="Original Key*"
                              error={!!errors.originalKey}
                              helperText={errors?.originalKey?.message}
                            />
                          )}
                        />
                      )}
                    />
                  </FormControl>

                  {/* Recommended Keys field */}
                  <FormControl fullWidth>
                    <Controller
                      name="recommendedKeys"
                      control={control}
                      render={({ field }) => (
                        <AutocompleteInput
                          id="recommended-keys"
                          options={musicKeysOptions}
                          label="Recommended Keys"
                          clearAriaLabel="Clear all selected recommended keys"
                          autoComplete="recommended-keys"
                          value={field.value}
                          onChange={(_, newValue) => field.onChange(newValue)}
                          multiple
                        />
                      )}
                    />
                  </FormControl>

                  {/* Year field */}
                  <Controller
                    name="year"
                    control={control}
                    defaultValue={''}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        id="year"
                        label="Year"
                        type="number"
                        error={!!errors.year}
                        helperText={errors?.year?.message}
                        variant="outlined"
                        fullWidth
                      />
                    )}
                  />
                </Stack>
              </Box>

              {/* column 2: Lyrics & Chords */}
              <Box width="100%">
                <Stack direction="column" spacing={2}>
                  <Grid
                    container
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <HeaderWithIcon
                      headerText={'Lyrics & Chords*'}
                      headerVariant={'h4'}
                      iconColor={'secondary.main'}
                      headerColor={'secondary.main'}
                      Icon={LibraryMusicIcon}
                    />
                    <SongHelpDialog />
                  </Grid>

                  <Controller
                    name="chordLyrics"
                    control={control}
                    defaultValue=""
                    render={({ field }) => (
                      <TextField
                        {...field}
                        id="chord-lyrics"
                        placeholder="Enter lyrics & chords here"
                        multiline
                        error={!!errors.chordLyrics}
                        helperText={errors?.chordLyrics?.message}
                        InputProps={{
                          inputComponent: TextareaAutosize,
                          inputProps: {
                            minRows: 20,
                            style: {
                              resize: 'vertical',
                            },
                          },
                        }}
                        variant="outlined"
                        fullWidth
                      />
                    )}
                  />

                  <Grid
                    container
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <HeaderWithIcon
                      headerText={'Lyrics & Simplified Chords'}
                      headerVariant={'h4'}
                      iconColor={'secondary.main'}
                      headerColor={'secondary.main'}
                      Icon={LibraryMusicIcon}
                    />
                    <SongHelpDialog />
                  </Grid>

                  <Controller
                    name="simplifiedChordLyrics"
                    control={control}
                    defaultValue=""
                    render={({ field }) => (
                      <TextField
                        {...field}
                        id="simplified-chord-lyrics"
                        placeholder="Enter lyrics & simplified chords here"
                        multiline
                        error={!!errors.simplifiedChordLyrics}
                        helperText={errors?.simplifiedChordLyrics?.message}
                        InputProps={{
                          inputComponent: TextareaAutosize,
                          inputProps: {
                            minRows: 20,
                            style: {
                              resize: 'vertical',
                            },
                          },
                        }}
                        variant="outlined"
                        fullWidth
                      />
                    )}
                  />
                </Stack>
              </Box>
              {isDesktop ? null : songActionButtons}
            </Stack>
          </Box>
        </form>
        <SongDeleteDialog
          open={openDeleteDialog}
          onClose={() => setOpenDeleteDialog(false)}
          songId={songId}
        />
      </Box>
    </Container>
  );
};

export default SongEditorContainer;
