import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { getCurrentUser, initializeAuth } from '../../store/slices/authSlice';
import { tokenStorage } from '../../utils/tokenStorage';
import { AppDispatch } from '../../store/store';

/**
 * AuthChecker component that initializes authentication state on app load
 * This component runs once when the app starts to check for existing tokens
 * and fetch current user data if tokens are valid
 */
const AuthChecker: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const initializeAuthentication = async () => {
      try {
        // Check if we have valid tokens in storage
        const tokens = tokenStorage.getTokens();
        
        if (tokens && tokenStorage.areTokensValid()) {
          // Initialize auth state with tokens
          dispatch(initializeAuth());
          
          // Fetch current user data
          dispatch(getCurrentUser());
        } else {
          // Clear invalid tokens
          tokenStorage.clearTokens();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        tokenStorage.clearTokens();
      }
    };

    initializeAuthentication();
  }, [dispatch]);

  // This component doesn't render anything
  return null;
};

export default AuthChecker;