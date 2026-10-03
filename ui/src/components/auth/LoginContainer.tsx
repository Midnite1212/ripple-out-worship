import React, { useState } from 'react';
import { isAxiosError } from 'axios';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { signin } from '../../reducers/userSlice';
import { customAxios as axios } from '../custom/customAxios';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LoginFormFields } from '../../types/form.types';
import { formSpacing } from '../../constants';
import { emailValidator, passwordValidator } from './helpers/zod.validators';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

// zod validation
const loginValidationSchema = z.object({
  email: emailValidator,
  password: passwordValidator,
});

const GENERIC_LOGIN_ERROR = 'Could not log in. Please try again.';

const getLoginErrorMessage = (error: unknown) => {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  return status === 401 || status === 500 ? 'Invalid email or wrong password' : GENERIC_LOGIN_ERROR;
};

const LoginContainer: React.FC = () => {
  const { register, handleSubmit, formState } = useForm<LoginFormFields>({
    resolver: zodResolver(loginValidationSchema),
  });
  const { errors } = formState;

  const [invalidLogin, setInvalidLogin] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const redirectFrom: unknown = location.state?.from;
  const redirectPath = typeof redirectFrom === 'string' ? redirectFrom : '/';

  const handleEmailLogin: SubmitHandler<LoginFormFields> = async (data) => {
    try {
      const payload = await axios.post<string>('/external-api/auth/login', {
        emailAddress: data.email,
        password: data.password ?? '',
      });
      dispatch(signin(payload.data));
      setInvalidLogin('');
      navigate(redirectPath);
    } catch (error: unknown) {
      setInvalidLogin(getLoginErrorMessage(error));
    }
  };

  const onGoogleSuccessLogin = async ({ credential }: { credential?: string }) => {
    if (!credential) {
      setInvalidLogin(GENERIC_LOGIN_ERROR);
      return;
    }
    try {
      const { data } = await axios.post<string>('/external-api/auth/login-google', {
        tokenId: credential,
      });
      dispatch(signin(data));
      setInvalidLogin('');
      navigate(redirectPath);
    } catch {
      setInvalidLogin(GENERIC_LOGIN_ERROR);
    }
  };

  return (
    <Box
      sx={{
        background: theme.palette.primary.darker,
        width: { xs: '100%', md: '50%' },
        borderRadius: ['15px', '30px'],
        padding: '32px 24px',
      }}
    >
      <Stack direction={'column'} margin={'auto'} spacing={formSpacing}>
        <Stack spacing={0.5}>
          <Typography variant="h1" color={theme.palette.text.primary} textAlign={'center'}>
            Log In
          </Typography>
        </Stack>
        <form onSubmit={handleSubmit(handleEmailLogin)}>
          <Stack spacing={formSpacing}>
            <Stack spacing={1}>
              <Typography variant="subtitle1" color="secondary">
                Email
              </Typography>
              <TextField
                fullWidth
                autoComplete={'email'}
                autoFocus
                {...register('email', {
                  required: 'Required',
                })}
                error={!!errors?.email?.message}
                helperText={errors?.email?.message}
              />
            </Stack>
            <Stack spacing={1}>
              <Typography variant="subtitle1" color="secondary">
                Password
              </Typography>
              <TextField
                type={showPassword ? 'text' : 'password'}
                {...register('password', {
                  required: 'Required',
                })}
                autoComplete={'current-password'}
                fullWidth
                error={!!errors?.password?.message}
                helperText={errors?.password?.message}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        color="secondary"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
              <Link
                component={RouterLink}
                to="/password/recover"
                textAlign="right"
                underline={'hover'}
                color="secondary"
                variant="button"
              >
                FORGOT PASSWORD?
              </Link>
            </Stack>
            {invalidLogin ? (
              <Typography variant={'body2'} color={'error'}>
                {invalidLogin}
              </Typography>
            ) : null}
            <Stack display="flex" justifyContent="center" alignItems="center" spacing={2}>
              <Button
                type={'submit'}
                sx={{ borderRadius: '30px' }}
                color={'secondary'}
                variant={'contained'}
                fullWidth
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }} color="primary">
                  Log In
                </Typography>
              </Button>
              <Typography>OR</Typography>
              <GoogleLogin
                locale="en"
                size="large"
                shape="pill"
                text="signin_with"
                use_fedcm_for_prompt={true}
                onSuccess={onGoogleSuccessLogin}
                onError={() => setInvalidLogin(GENERIC_LOGIN_ERROR)}
              />
              <Stack
                direction={'row'}
                spacing={4}
                justifyContent={'space-between'}
                alignItems={'center'}
              >
                <Typography variant="subtitle1" color={theme.palette.secondary.light}>
                  Don't have an account?
                </Typography>
                <Link
                  color="secondary"
                  href={`${process.env.REACT_APP_MAIN_URL}/signup`}
                  underline={'hover'}
                  variant="button"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Typography variant="subtitle1">SIGN UP @HMCC.HK</Typography>
                </Link>
              </Stack>
            </Stack>
          </Stack>
        </form>
      </Stack>
    </Box>
  );
};

export default LoginContainer;
