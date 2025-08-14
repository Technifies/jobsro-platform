import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { store } from '../../store/store';
import { refreshToken, logoutUser } from '../../store/slices/authSlice';
import { tokenStorage } from '../../utils/tokenStorage';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

// Create main API client
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    const tokens = tokenStorage.getTokens();
    if (tokens?.accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh and errors
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If token is already being refreshed, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh the token
        const resultAction = await store.dispatch(refreshToken());
        
        if (refreshToken.fulfilled.match(resultAction)) {
          const newTokens = resultAction.payload;
          processQueue(null, newTokens.accessToken);
          
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          }
          
          return apiClient(originalRequest);
        } else {
          throw new Error('Token refresh failed');
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        store.dispatch(logoutUser());
        
        // Redirect to login if not already there
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        }
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle other HTTP errors
    const errorMessage = getErrorMessage(error);
    
    // Don't show toast for certain errors or endpoints
    const skipToast = [
      '/auth/me', // Silent failures for auth checks
      '/auth/refresh', // Token refresh errors
    ].some(path => error.config?.url?.includes(path));

    if (!skipToast) {
      switch (error.response?.status) {
        case 400:
          toast.error(errorMessage || 'Invalid request');
          break;
        case 403:
          toast.error(errorMessage || 'Access denied');
          break;
        case 404:
          toast.error(errorMessage || 'Resource not found');
          break;
        case 429:
          toast.error(errorMessage || 'Too many requests. Please try again later.');
          break;
        case 500:
          toast.error('Server error. Please try again later.');
          break;
        default:
          if (error.response?.status >= 400) {
            toast.error(errorMessage || 'An error occurred');
          }
      }
    }

    return Promise.reject(error);
  }
);

// Helper function to extract error message
const getErrorMessage = (error: AxiosError): string => {
  if (error.response?.data) {
    const data = error.response.data as any;
    return data.error || data.message || 'An error occurred';
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'Network error';
};

// Upload client for file uploads
export const uploadClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
  timeout: 60000, // 60 seconds for uploads
});

// Add auth token to upload client
uploadClient.interceptors.request.use((config) => {
  const tokens = tokenStorage.getTokens();
  if (tokens?.accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

// Generic API methods
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) => 
    apiClient.get<T>(url, config),
  
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    apiClient.post<T>(url, data, config),
  
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    apiClient.put<T>(url, data, config),
  
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    apiClient.patch<T>(url, data, config),
  
  delete: <T = any>(url: string, config?: AxiosRequestConfig) => 
    apiClient.delete<T>(url, config),
  
  upload: <T = any>(url: string, formData: FormData, config?: AxiosRequestConfig) => 
    uploadClient.post<T>(url, formData, config),
};

export default apiClient;