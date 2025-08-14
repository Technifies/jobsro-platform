import { AuthTokens } from '../types/auth';
import { jwtDecode } from 'jwt-decode';

const ACCESS_TOKEN_KEY = 'jobsro_access_token';
const REFRESH_TOKEN_KEY = 'jobsro_refresh_token';

export const tokenStorage = {
  // Get stored tokens
  getTokens(): AuthTokens | null {
    try {
      const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      
      if (accessToken && refreshToken) {
        return { accessToken, refreshToken };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting tokens from storage:', error);
      return null;
    }
  },

  // Set tokens in storage
  setTokens(tokens: AuthTokens): void {
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    } catch (error) {
      console.error('Error storing tokens:', error);
    }
  },

  // Clear tokens from storage
  clearTokens(): void {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  },

  // Check if access token is expired
  isAccessTokenExpired(): boolean {
    try {
      const tokens = this.getTokens();
      if (!tokens?.accessToken) return true;

      const decoded: any = jwtDecode(tokens.accessToken);
      const currentTime = Date.now() / 1000;
      
      return decoded.exp < currentTime;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true;
    }
  },

  // Check if refresh token is expired
  isRefreshTokenExpired(): boolean {
    try {
      const tokens = this.getTokens();
      if (!tokens?.refreshToken) return true;

      const decoded: any = jwtDecode(tokens.refreshToken);
      const currentTime = Date.now() / 1000;
      
      return decoded.exp < currentTime;
    } catch (error) {
      console.error('Error checking refresh token expiration:', error);
      return true;
    }
  },

  // Get user info from token
  getUserFromToken(): any | null {
    try {
      const tokens = this.getTokens();
      if (!tokens?.accessToken) return null;

      const decoded: any = jwtDecode(tokens.accessToken);
      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  },

  // Check if tokens are valid
  areTokensValid(): boolean {
    const tokens = this.getTokens();
    if (!tokens) return false;

    return !this.isAccessTokenExpired() || !this.isRefreshTokenExpired();
  }
};