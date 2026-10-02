import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, Skeleton } from '@mui/material';
import ErrorPage from './ErrorPage';
import Sidebar from '../navigation/Sidebar';
import { useUser } from '../../helpers/customHooks';
import { DESKTOP_SIDEBAR_WIDTH, MOBILE_NAVBAR_HEIGHT } from '../../constants';
import { UserAccessType } from '../../types/user.types';

export type RoutePermission = 'noUser' | 'user' | 'admin' | 'public';

type PageWrapperProps = {
  children: ReactNode;
  showNavBar?: boolean;
};

type PrivateRouteWrapperProps = {
  children: ReactNode;
  permissions: RoutePermission[];
};

const PageWrapper = ({ children, showNavBar = true }: PageWrapperProps) => {
  return (
    <Box display="flex" width="100%" height="100%" sx={{ flexGrow: 1 }}>
      {showNavBar && <Sidebar />}
      <Box
        overflow="auto"
        sx={{
          height: showNavBar ? { xs: `calc(100% - ${MOBILE_NAVBAR_HEIGHT})`, sm: '100%' } : '100%',
          width: showNavBar ? { xs: '100%', sm: `calc(100% - ${DESKTOP_SIDEBAR_WIDTH})` } : '100%',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

const PrivateRouteWrapper = ({ children, permissions }: PrivateRouteWrapperProps) => {
  const { user, loading } = useUser();
  const location = useLocation();

  if (loading) {
    return <Skeleton variant="rectangular" width="100%" height="100%" />;
  }

  const isAuthenticated = !!user && Object.keys(user).length > 0;
  const isAdmin = user?.accessType === UserAccessType.ADMIN;
  const loginRedirect = <Navigate to="/login" state={{ from: location.pathname }} replace />;

  if (permissions.includes('public')) {
    return isAuthenticated ? (
      <PageWrapper showNavBar={false}>{children}</PageWrapper>
    ) : (
      <Box sx={{ flexGrow: 1 }}>{children}</Box>
    );
  }

  if (permissions.includes('noUser')) {
    return isAuthenticated ? (
      <Navigate to="/" replace />
    ) : (
      <Box sx={{ flexGrow: 1 }}>{children}</Box>
    );
  }

  if (permissions.includes('user')) {
    return isAuthenticated ? <PageWrapper>{children}</PageWrapper> : loginRedirect;
  }

  if (permissions.includes('admin')) {
    if (!isAuthenticated) {
      return loginRedirect;
    }
    return isAdmin ? <PageWrapper>{children}</PageWrapper> : <ErrorPage />;
  }

  return <ErrorPage />;
};

export default PrivateRouteWrapper;
