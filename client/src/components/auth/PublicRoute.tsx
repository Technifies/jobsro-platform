import React from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuth } from '../../store/slices/authSlice';

interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, user } = useSelector(selectAuth);
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // If user is authenticated, redirect them away from auth pages
  if (isAuthenticated && user) {
    // Check if there's a redirect parameter
    const redirectTo = searchParams.get('redirect');
    
    if (redirectTo) {
      // Decode and validate the redirect URL
      try {
        const decodedUrl = decodeURIComponent(redirectTo);
        // Only allow internal redirects
        if (decodedUrl.startsWith('/')) {
          return <Navigate to={decodedUrl} replace />;
        }
      } catch (error) {
        console.warn('Invalid redirect URL:', redirectTo);
      }
    }

    // Default redirect based on user role
    const defaultRedirects = {
      job_seeker: '/dashboard',
      employer: '/employer',
      recruiter: '/recruiter',
      admin: '/admin',
    };

    const redirectPath = defaultRedirects[user.role] || '/';
    return <Navigate to={redirectPath} replace />;
  }

  // User is not authenticated, show the public route content
  return <>{children}</>;
};

export default PublicRoute;