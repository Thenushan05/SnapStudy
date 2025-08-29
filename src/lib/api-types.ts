export interface RegisterRequestBody {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}

// Matches both routes/authRoutes.js and controllers/authController.js responses
export interface AuthResponse {
  success?: boolean;
  message?: string;
  token?: string;
  user?: {
    id: string;
    email: string;
    // Some endpoints return username, others name
    username?: string;
    name?: string;
    role?: string;
    lastLogin?: string;
    preferences?: Record<string, unknown>;
  };
}

export interface ApiError {
    // Backend may return either `error` or `message`
    error?: string;
    message?: string;
    errors?: Record<string, string[]>;
}
