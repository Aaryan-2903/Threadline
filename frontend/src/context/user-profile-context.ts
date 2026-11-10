import { createContext } from 'react';
import type { UserProfile } from '../types';

export const DEFAULT_PROFILE: UserProfile = {
  displayName: 'User',
  role: '',
};

export function computeInitials(name: string): string {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface UserProfileContextType {
  profile: UserProfile;
  initials: string;
  updateProfile: (updates: Partial<UserProfile>) => void;
  resetProfile: () => void;
}

export const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

