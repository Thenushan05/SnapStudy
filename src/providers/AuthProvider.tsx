import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthResponse } from '@/lib/api-types';

interface AuthContextType {
  user: AuthResponse['user'] | null;
  token: string | null;
  login: (data: AuthResponse) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthResponse['user'] | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = (data: AuthResponse) => {
    setUser(data.user || null);
    setToken(data.token || null);
    // Persist to storage for session continuity
    try {
      if (data.token) localStorage.setItem('auth_token', data.token);
      if (data.user) localStorage.setItem('auth_user', JSON.stringify(data.user));
    } catch (_) {
      // ignore storage failures
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    // Clear all app storage on logout
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {
      // ignore storage failures
    }
  };

  // Rehydrate on app load
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');
      if (storedToken) setToken(storedToken);
      if (storedUser) setUser(JSON.parse(storedUser));
    } catch (_) {
      // ignore storage failures
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

