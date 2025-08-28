import { http } from './http';
import type { AuthResponse, LoginRequestBody, RegisterRequestBody } from './api-types';

const BASE_URL = 'https://0429d9b3-d955-4a41-9825-e264e3350a9a.mock.pstmn.io/api';

export const authApi = {
  register: (userData: RegisterRequestBody) => {
    return http.post<AuthResponse, RegisterRequestBody>(`${BASE_URL}/auth/register`, userData);
  },

  login: (credentials: LoginRequestBody) => {
    return http.post<AuthResponse, LoginRequestBody>(`${BASE_URL}/auth/dev-login`, credentials);
  },
};
