import { Container, Box, Stack, Typography, Button } from '@mui/material';
import { FC, ReactElement, useState, useEffect, useCallback } from 'react';
import ArrowLeftIcon from '@mui/icons-material/ArrowLeft';
import { useNavigate, useParams } from 'react-router-dom';
import { SongViewSchema } from '../../types/song.types';
import { customAxios as axios } from '../custom/customAxios';
import SongsTitleCard from './SongsTitleCard';
import SongsButtonCard from './SongsButtonsCard';
import { useOwnership } from '../../helpers/customHooks';
import useMediaQuery from '@mui/material/useMediaQuery';
import { specificSongsTabletWidth } from '../../constants';
import EditIcon from '@mui/icons-material/Edit';
import { logRequestError } from '../../helpers/global';

const SongsViewContainer: FC = (): ReactElement => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery(`(max-width:${specificSongsTabletWidth})`);

  // Get user information
  const ownership = useOwnership();

  const { id } = useParams();
  const [song, setSong] = useState<SongViewSchema>();
  const [errorMessage, setErrorMessage] = useState('');

  const getSongs = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await axios.get<SongViewSchema>('/api/songs/get', {
        params: { id: id },
      });
      setErrorMessage('');
      setSong(data);
    } catch (error: unknown) {
      logRequestError('Error fetching song:', error);
      setErrorMessage('Could not load this song. Please try again.');
    }
  }, [id]);

  useEffect(() => {
    getSongs();
  }, [getSongs]);

  return (
    <>
      {isMobile && (
        <Box
          display="flex"
          alignItems="center"
          sx={{
            cursor: 'pointer',
            mt: 2,
            ml: 1,
            padding: 0,
          }}
          onClick={() => navigate('/song')}
        >
          <ArrowLeftIcon sx={{ mr: 0.5 }} fontSize="small" />
          <Typography
            sx={{
              fontSize: '12px',
              color: 'onSurface.neutral',
              fontWeight: 500,
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Back to Songs
          </Typography>
        </Box>
      )}
      <Container
        maxWidth={false}
        sx={{
          paddingTop: { xs: '1em', md: '3em' },
          width: '100%',
          paddingLeft: 0,
          paddingRight: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: ['0.1em', '0.3em'],
            paddingRight: '1.5rem',
          }}
        >
          <Box sx={{ width: '100%' }}>
            <SongsTitleCard song={song} />
          </Box>
          {ownership?.accessType === 'admin' && (
            <Button
              variant="outlined"
              onClick={() => navigate(`/song/edit/${id}`)}
              startIcon={isMobile ? null : <EditIcon />}
              sx={{
                borderWidth: '2px',
                flexShrink: 0,
                padding: isMobile ? '10px' : '10px 25px',
                minWidth: isMobile ? 'unset' : 'inherit',
                borderRadius: '40px',
                borderColor: 'outline.main',
                color: 'secondary.main',
                textTransform: 'none',
              }}
            >
              {isMobile ? (
                <EditIcon />
              ) : (
                <Typography variant="subtitle1" component="span">
                  Edit Song
                </Typography>
              )}
            </Button>
          )}
        </Box>
        {errorMessage ? (
          <Typography variant="body2" color="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Typography>
        ) : null}
        <Stack direction={['row']}>
          <Box sx={{ marginBottom: ['10px', '3vh'], width: '100%' }}>
            <SongsButtonCard song={song} />
          </Box>
        </Stack>
      </Container>
    </>
  );
};
export default SongsViewContainer;
