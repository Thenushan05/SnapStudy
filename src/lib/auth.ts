import { http } from "./http";
import type {
  AuthResponse,
  LoginRequestBody,
  RegisterRequestBody,
} from "./api-types";

const BASE_URL = "https://backendsnap-student.vercel.app/";

export const authApi = {
  register: (userData: RegisterRequestBody) => {
    // sanitize inputs to match backend expectations
    const payload: RegisterRequestBody = {
      username: userData.username.trim(),
      email: userData.email.trim().toLowerCase(),
      password: userData.password,
    };
    return http.post<AuthResponse, RegisterRequestBody>(
      `${BASE_URL}/api/auth/register`,
      payload
    );
  },

  login: (credentials: LoginRequestBody) => {
    // sanitize inputs to avoid case issues on email lookup
    const payload: LoginRequestBody = {
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password,
    };
    return http.post<AuthResponse, LoginRequestBody>(
      `${BASE_URL}/api/auth/login`,
      payload
    );
  },
};
