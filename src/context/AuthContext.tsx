/**
 * AstraX EB1 Control Tower – Auth Context
 * ========================================
 * React Context for authentication state, JWT persistence, and role checking.
 */

import React, { createContext, useState, useEffect, useCallback } from 'react';
import type { JWTPayload, RoleName } from '../types';
import * as api from '../services/api';

interface AuthState {
  token: string | null;
  userId: number | null;
  roles: RoleName[];
  requiresPasswordChange: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: RoleName[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

function isTokenExpired(payload: JWTPayload): boolean {
  return Date.now() >= payload.exp * 1000;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    token: null,
    userId: null,
    roles: [],
    requiresPasswordChange: false,
    isAuthenticated: false,
    isLoading: true,
  });

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('astrax_token');
    if (stored) {
      const payload = decodeJWT(stored);
      if (payload && !isTokenExpired(payload)) {
        setState({
          token: stored,
          userId: parseInt(payload.sub, 10),
          roles: payload.roles as RoleName[],
          requiresPasswordChange: payload.requires_password_change,
          isAuthenticated: true,
          isLoading: false,
        });
        return;
      }
      // Token expired or invalid — clear it
      localStorage.removeItem('astrax_token');
    }
    setState(prev => ({ ...prev, isLoading: false }));
  }, []);

  const setTokenState = useCallback((token: string) => {
    localStorage.setItem('astrax_token', token);
    const payload = decodeJWT(token)!;
    setState({
      token,
      userId: parseInt(payload.sub, 10),
      roles: payload.roles as RoleName[],
      requiresPasswordChange: payload.requires_password_change,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    setTokenState(res.access_token);
  }, [setTokenState]);

  const changePassword = useCallback(async (newPassword: string) => {
    const res = await api.changeInitialPassword(newPassword);
    setTokenState(res.access_token);
  }, [setTokenState]);

  const logout = useCallback(() => {
    localStorage.removeItem('astrax_token');
    setState({
      token: null,
      userId: null,
      roles: [],
      requiresPasswordChange: false,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const hasRole = useCallback((...roles: RoleName[]) => {
    return state.roles.some(r => roles.includes(r));
  }, [state.roles]);

  return (
    <AuthContext.Provider value={{ ...state, login, changePassword, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};
