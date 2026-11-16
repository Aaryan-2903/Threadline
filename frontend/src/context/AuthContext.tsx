import React, { useState, useEffect, useCallback } from 'react';
import type { User, UserRole } from '../types';
import { api, getAuthToken, setAuthToken } from '../api/client';
import { AuthContext } from './auth-context';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(() => getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Restore authenticated session on mount if token exists
  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      const existingToken = getAuthToken();
      if (!existingToken) {
        if (mounted) setIsLoading(false);
        return;
      }
      try {
        const profile = await api.getMe();
        if (mounted) {
          if (profile) {
            setUser(profile);
            setTokenState(existingToken);
          } else {
            setAuthToken(null);
            setTokenState(null);
            setUser(null);
          }
        }
      } catch (err) {
        console.warn('Session verification failed:', err);
        if (mounted) {
          setAuthToken(null);
          setTokenState(null);
          setUser(null);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const login = async (usernameOrEmail: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.login(usernameOrEmail, password);
      setUser(res.user);
      setTokenState(res.access_token);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const demoLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.demoLogin();
      setUser(res.user);
      setTokenState(res.access_token);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Demo session initialization failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setTokenState(null);
    setError(null);
  };

  const switchRole = async (newRole: UserRole) => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const updated = await api.changeUserRole(user.id, newRole);
      setUser(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update user role';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const isDemo = Boolean(user?.is_demo);
  const isAuthenticated = Boolean(user && token);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        isDemo,
        login,
        demoLogin,
        logout,
        switchRole,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

