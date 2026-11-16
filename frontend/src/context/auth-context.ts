import { createContext } from 'react';
import type { User, UserRole } from '../types';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemo: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => void;
  switchRole: (newRole: UserRole) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

