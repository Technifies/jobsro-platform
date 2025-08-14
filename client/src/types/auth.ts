export interface User {
  id: string;
  email: string;
  role: 'job_seeker' | 'employer' | 'recruiter' | 'admin';
  first_name: string;
  last_name: string;
  phone?: string;
  profile_image?: string;
  status: 'pending' | 'active' | 'suspended' | 'deactivated';
  email_verified: boolean;
  profile?: any;
  created_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: 'job_seeker' | 'employer' | 'recruiter';
}

export interface AuthResponse {
  message: string;
  user: User;
  tokens: AuthTokens;
}

export interface ApiError {
  error: string;
  details?: any;
  code?: string;
}