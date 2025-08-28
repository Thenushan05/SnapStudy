export interface RegisterRequestBody {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  token?: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface ApiError {
    message: string;
    errors?: Record<string, string[]>;
}
