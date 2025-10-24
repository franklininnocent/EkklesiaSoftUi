import { User } from './user.model';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expiry_time: string;
  user_id: number;
  role_id: number;
  token_type: string;
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role_id?: number;
  tenant_id?: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  expiryTime: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

