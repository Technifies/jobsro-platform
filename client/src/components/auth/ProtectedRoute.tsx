import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { selectAuth } from '../../store/slices/authSlice';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireEmailVerification?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles = [],
  requireEmailVerification = false,
}) => {
  const { user, isAuthenticated, isLoading } = useSelector(selectAuth);
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="50vh"
        gap={2}
      >
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary">
          Verifying authentication...
        </Typography>
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  // Check role-based access
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <Typography variant="h6" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body2">
            You don't have permission to access this page. Your current role is "{user.role}".
            {allowedRoles.length === 1 
              ? ` This page requires "${allowedRoles[0]}" role.`
              : ` This page requires one of these roles: ${allowedRoles.join(', ')}.`
            }
          </Typography>
        </Alert>
      </Box>
    );
  }

  // Check account status
  if (user.status !== 'active') {
    let message = 'Your account is not active.';
    let severity: 'warning' | 'error' = 'warning';
    
    switch (user.status) {
      case 'pending':
        message = 'Your account is pending activation. Please check your email for activation instructions.';
        break;
      case 'suspended':
        message = 'Your account has been suspended. Please contact support for assistance.';
        severity = 'error';
        break;
      case 'deactivated':
        message = 'Your account has been deactivated. Please contact support to reactivate your account.';
        severity = 'error';
        break;
    }

    return (
      <Box sx={{ p: 3 }}>
        <Alert severity={severity}>
          <Typography variant="h6" gutterBottom>
            Account Status: {user.status}
          </Typography>
          <Typography variant="body2">
            {message}
          </Typography>
        </Alert>
      </Box>
    );
  }

  // Check email verification if required
  if (requireEmailVerification && !user.email_verified) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          <Typography variant="h6" gutterBottom>
            Email Verification Required
          </Typography>
          <Typography variant="body2">
            Please verify your email address to access this feature. 
            Check your inbox for a verification link or request a new one from your profile settings.
          </Typography>
        </Alert>
      </Box>
    );
  }

  // All checks passed, render the protected content
  return <>{children}</>;
};

export default ProtectedRoute;