import { Box, Button, Container, Stack, TextField, Typography, styled } from '@mui/material';
import { useDispatch } from 'react-redux';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import PageHeader from '../navigation/PageHeader';
import { persistor } from '../../store';
import { signout } from '../../reducers/userSlice';
import { useUser } from '../../helpers/customHooks';

const FieldLabel = styled(Typography)(({ theme }) => ({
  marginBottom: '6px',
  fontSize: '1rem',
  fontWeight: 400,
  color: theme.palette.primary.lightest,
}));

const DisabledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiInputBase-input.Mui-disabled': {
    WebkitTextFillColor: theme.palette.text.primary,
    color: theme.palette.text.primary,
  },
  '& .MuiInputLabel-root.Mui-disabled': {
    color: theme.palette.text.primary,
  },
  '& .MuiOutlinedInput-root.Mui-disabled .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.common.white,
  },
}));

const fieldWidth = { xs: '100%', sm: '75%' };

const ProfileView = () => {
  const { user } = useUser();
  const dispatch = useDispatch();

  const handleLogout = async () => {
    await persistor.purge();
    dispatch(signout());
    window.location.assign('/login');
  };

  return (
    <Container
      maxWidth={false}
      sx={{
        py: '1rem',
        px: { xs: 2, sm: '1.5rem' },
        ml: 0,
        height: '100%',
        overflow: 'auto',
        maxWidth: { xs: '100%', md: '45%' },
      }}
    >
      <Box display="flex" flexDirection="column" flexGrow={1} p={{ xs: 0, sm: 2 }}>
        <PageHeader title="Profile" icon={<PersonIcon />} />
        <Stack
          spacing={2}
          width={{ xs: '100%', sm: '90%' }}
          mt={2}
          p={{ xs: 2, sm: 3 }}
          borderRadius="8px"
          bgcolor="background.paper"
        >
          <Typography variant="h2">My Information</Typography>
          <Box>
            <FieldLabel>Full Name</FieldLabel>
            <DisabledTextField
              disabled
              id="outlined-name"
              value={user?.fullName}
              sx={{ width: fieldWidth }}
            />
          </Box>
          <Box>
            <FieldLabel>Email</FieldLabel>
            <DisabledTextField
              disabled
              id="outlined-email"
              value={user?.email}
              sx={{ width: fieldWidth, mb: 2 }}
            />
          </Box>
          <Box>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{ borderRadius: '20px', p: '8px 16px' }}
            >
              <Typography component="span" fontSize="1rem" fontWeight={700} color="onPrimary.main">
                Log out
              </Typography>
            </Button>
          </Box>
        </Stack>
      </Box>
    </Container>
  );
};

export default ProfileView;
