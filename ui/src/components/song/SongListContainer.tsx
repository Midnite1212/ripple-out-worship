import {
  Button,
  CircularProgress,
  Container,
  Grid,
  IconButton,
  Snackbar,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { FC, ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { SongSchema, SongSearchFilter } from '../../types/song.types';
import SongCard from './SongCard';
import SongSearch from './SongSearch';
import { useNavigate, useLocation } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PageHeader from '../navigation/PageHeader';
import { getFirstLineLyrics } from '../../helpers/song';
import { customAxios as axios } from '../custom/customAxios';
import { useOwnership } from '../../helpers/customHooks';
import {
  DESKTOP_PAGE_HEADER_HEIGHT,
  MOBILE_NAVBAR_HEIGHT,
  MOBILE_PAGE_HEADER_HEIGHT,
  TABLET_PAGE_HEADER_HEIGHT,
  specificSongsMobileWidth,
} from '../../constants';
import { logRequestError } from '../../helpers/global';

type SongQuery = {
  search: string;
  themes: string[];
  tempo: string[];
};

type SongSearchResponse = {
  data?: SongSchema[];
  totalPages?: number;
};

const newSongButtonSx = {
  border: 0,
  borderRadius: '40px',
  backgroundColor: 'secondary.main',
  color: 'onPrimary.main',
  textTransform: 'none',
  '&:hover': {
    backgroundColor: 'secondary.main',
    opacity: '0.95',
  },
  transition: 'all 0.1s ease-in-out',
} as const;

const getSongQueryKey = (filterData: SongSearchFilter | undefined) =>
  filterData
    ? JSON.stringify({
        search: filterData.search?.trim() ?? '',
        themes: filterData.themes ?? [],
        tempo: filterData.tempo ?? [],
      })
    : '';

const SongListContainer: FC = (): ReactElement => {
  const ownership = useOwnership();
  const isAdmin = ownership?.accessType === 'admin';
  const theme = useTheme();
  const [songResults, setSongResults] = useState<SongSchema[]>([]);
  const [filterData, setFilterData] = useState<SongSearchFilter>();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryIdRef = useRef(0);
  const isFetchingRef = useRef(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);

  const queryKey = getSongQueryKey(filterData);

  const fetchSongResults = useCallback(
    async (query: SongQuery, pageToFetch: number, queryId: number) => {
      isFetchingRef.current = true;
      try {
        const { data } = await axios.get<SongSearchResponse>('/api/songs/search', {
          params: {
            code: query.search,
            keyword: query.search,
            themes: query.themes,
            tempo: query.tempo,
            page: pageToFetch,
            limit: 20,
          },
        });
        if (queryId !== queryIdRef.current) return;
        const songs = Array.isArray(data?.data) ? data.data : [];
        setSongResults((prevSongs) => (pageToFetch === 1 ? songs : [...prevSongs, ...songs]));
        setTotalPages(data?.totalPages ?? 1);
        setErrorMessage('');
      } catch (err: unknown) {
        if (queryId !== queryIdRef.current) return;
        if (isAxiosError(err) && err.response?.status === 404) {
          setSongResults([]);
          return;
        }
        logRequestError('Error searching songs:', err);
        setErrorMessage('Could not load songs. Please try again.');
      } finally {
        if (queryId === queryIdRef.current) {
          isFetchingRef.current = false;
          setLoading(false);
        }
      }
    },
    []
  );

  const handleScroll = useCallback(() => {
    const searchDisplayBox = document.getElementById('search-display');
    if (searchDisplayBox) {
      const { scrollTop, scrollHeight, clientHeight } = searchDisplayBox;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;
      if (isAtBottom && timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (!loading && !isFetchingRef.current && isAtBottom && page < totalPages && queryKey) {
        const nextPage = page + 1;
        const queryId = queryIdRef.current;
        const query: SongQuery = JSON.parse(queryKey);
        timeoutRef.current = setTimeout(() => {
          setPage(nextPage);
          fetchSongResults(query, nextPage, queryId);
        }, 300);
        searchDisplayBox.scrollTop = scrollTop - 30;
      }
    }
  }, [loading, page, totalPages, queryKey, fetchSongResults]);

  useEffect(() => {
    const searchDisplayBox = document.getElementById('search-display');
    if (searchDisplayBox) {
      searchDisplayBox.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (searchDisplayBox) {
        searchDisplayBox.removeEventListener('scroll', handleScroll);
      }
    };
  }, [handleScroll]);

  useEffect(() => {
    if (!queryKey) return;
    const query: SongQuery = JSON.parse(queryKey);
    const queryId = ++queryIdRef.current;
    isFetchingRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const timer = setTimeout(() => {
      setSongResults([]);
      setPage(1);
      setTotalPages(1);
      setLoading(true);
      fetchSongResults(query, 1, queryId);
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [queryKey, fetchSongResults]);

  useEffect(() => {
    if (location.search) {
      const searchQuery = new URLSearchParams(location.search).get('q');
      setFilterData((prevState) => ({ ...prevState, search: searchQuery }));
    }
  }, [location.search]);

  useEffect(() => {
    const message = location.state?.snackbarMessage;
    if (typeof message === 'string') {
      setSnackbarMessage(message);
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
  }, [location, navigate]);

  return (
    <>
      <Container
        fixed
        sx={{
          py: '1rem',
          px: '1rem',
          maxHeight: { xs: `calc(100vh - ${MOBILE_NAVBAR_HEIGHT})`, sm: '100vh' },
          height: '100%',
          minWidth: '100%',
          overflow: 'hidden',
        }}
        disableGutters
      >
        {isAdmin && (
          <Button
            variant="outlined"
            sx={{
              ...newSongButtonSx,
              zIndex: 9,
              display: {
                xs: 'flex',
                sm: 'none',
              },
              position: 'fixed',
              bottom: '90px',
              right: '40px',
              padding: '5px 10px',
            }}
            startIcon={<AddIcon />}
            onClick={() => navigate('/song/add')}
          >
            <Typography
              variant="subtitle1"
              component="span"
              fontWeight={700}
              sx={{
                fontSize: '1rem',
              }}
            >
              New Song
            </Typography>
          </Button>
        )}

        <PageHeader
          title="Songs"
          icon={<MusicNoteIcon />}
          actionButtons={
            isAdmin && (
              <Button
                variant="outlined"
                sx={{
                  ...newSongButtonSx,
                  display: { xs: 'none', sm: 'flex' },
                  padding: {
                    xs: '8px 15px',
                    sm: '10px 25px',
                  },
                }}
                startIcon={<AddIcon />}
                onClick={() => navigate('/song/add')}
              >
                <Typography
                  variant="subtitle1"
                  component="span"
                  fontWeight={700}
                  sx={{
                    fontSize: {
                      xs: '0.875rem',
                      sm: '1rem',
                    },
                  }}
                >
                  New Song
                </Typography>
              </Button>
            )
          }
        />
        <Grid
          container
          maxWidth="100%"
          height={'100%'}
          maxHeight={{
            xs: `calc(100% - ${MOBILE_PAGE_HEADER_HEIGHT})`,
            sm: `calc(100vh - ${TABLET_PAGE_HEADER_HEIGHT} - 2rem)`,
            lg: `calc(100vh - ${DESKTOP_PAGE_HEADER_HEIGHT} - 2rem)`,
          }}
          width="100%"
          columnSpacing={isMobile ? 0 : '1rem'}
        >
          <Grid
            item
            xs={isDesktop ? 4 : isTablet ? 5 : 12}
            height={!isMobile ? '100%' : 'auto'}
            p={0}
          >
            <SongSearch isMobile={isMobile} setFilterData={setFilterData} />
          </Grid>

          {/* Song cards search results */}
          <Grid item xs={isDesktop ? 8 : isTablet ? 7 : 12} height="100%">
            <Container
              sx={{
                p: '1rem',
                background: (theme) => theme.palette.common.black,
                borderRadius: '16px',
                width: '100%',
                height: '100%',
                maxHeight: { xs: '90%', sm: '100%' },
              }}
              disableGutters
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                maxWidth="100%"
                height={!isMobile ? '4%' : 'auto'}
                pb={!isMobile ? 0 : '1em'}
              >
                <Typography variant="h3" color="common.white">
                  Search Results
                </Typography>
                {errorMessage ? (
                  <Typography variant="body2" color="error">
                    {errorMessage}
                  </Typography>
                ) : null}
              </Stack>
              <Stack
                direction="column"
                spacing={3}
                height="97%"
                overflow="auto"
                maxWidth="100%"
                id="search-display"
                sx={{
                  '&::-webkit-scrollbar': {
                    display: 'none',
                  },
                  [`@media (min-width: ${specificSongsMobileWidth})`]: {
                    '&::-webkit-scrollbar': {
                      display: 'block',
                    },
                  },
                }}
              >
                {loading ? (
                  <Stack height="80%" justifyContent="center" alignItems="center" width="100%">
                    <CircularProgress />
                  </Stack>
                ) : songResults.length > 0 ? (
                  songResults.map((song) => (
                    <SongCard
                      key={song._id}
                      {...song}
                      filterData={filterData}
                      isDesktop={!isMobile}
                      firstLine={getFirstLineLyrics(song.chordLyrics)}
                    />
                  ))
                ) : errorMessage ? null : (
                  <Stack height="80%" display="flex" justifyContent="center" alignItems="center">
                    <Typography variant="h2" color="primary.main">
                      Couldn't find "{filterData?.search}"
                    </Typography>
                    <Typography variant="body2">Try searching again</Typography>
                  </Stack>
                )}
              </Stack>
            </Container>
          </Grid>
        </Grid>
      </Container>
      <Snackbar
        open={snackbarMessage !== ''}
        autoHideDuration={5000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setSnackbarMessage('');
        }}
        message={snackbarMessage}
        action={
          <IconButton
            size="small"
            color="inherit"
            onClick={() => setSnackbarMessage('')}
            aria-label="close"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </>
  );
};

export default SongListContainer;
