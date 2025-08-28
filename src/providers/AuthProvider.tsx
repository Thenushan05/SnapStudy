import React, { createContext, useContext, useState, ReactNode } from 'react';
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
    // In a real app, you'd also persist the token, e.g., in localStorage
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    // Clear the token from storage as well
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

