import axios from 'axios';
import { LoginCredentials, RegisterData, AuthResponse, User } from '../../types/auth';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

// Create axios instance for auth API
const authAxios = axios.create({
  baseURL: `${API_BASE_URL}/auth`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authAPI = {
  // Login user
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await authAxios.post('/login', credentials);
    return response.data;
  },

  // Register user
  async register(userData: RegisterData): Promise<AuthResponse> {
    const response = await authAxios.post('/register', userData);
    return response.data;
  },

  // Get current user
  async getCurrentUser(): Promise<{ user: User }> {
    const response = await authAxios.get('/me');
    return response.data;
  },

  // Refresh token
  async refreshToken(refreshToken: string): Promise<{ tokens: any }> {
    const response = await authAxios.post('/refresh', { refreshToken });
    return response.data;
  },

  // Logout
  async logout(): Promise<void> {
    await authAxios.post('/logout');
  },

  // Forgot password
  async forgotPassword(email: string): Promise<void> {
    await authAxios.post('/forgot-password', { email });
  },

  // Reset password
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await authAxios.post('/reset-password', { token, new_password: newPassword });
  },

  // Verify email
  async verifyEmail(token: string): Promise<void> {
    await authAxios.post('/verify-email', { token });
  },

  // Social login URLs
  getGoogleLoginUrl(): string {
    return `${API_BASE_URL}/auth/google`;
  },

  getLinkedInLoginUrl(): string {
    return `${API_BASE_URL}/auth/linkedin`;
  },
};