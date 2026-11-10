import React, { useState, useEffect } from 'react';
import type { UserProfile } from '../types';
import {
  DEFAULT_PROFILE,
  computeInitials,
  UserProfileContext,
} from './user-profile-context';

const STORAGE_KEY = 'threadline_user_profile_v1';

function loadStoredProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.displayName === 'string' &&
      parsed.displayName.trim().length > 0
    ) {
      return {
        displayName: parsed.displayName.trim().slice(0, 60),
        role: typeof parsed.role === 'string' ? parsed.role.trim().slice(0, 60) : '',
      };
    }
  } catch (e) {
    console.warn('Failed to parse stored user profile from localStorage:', e);
  }
  return DEFAULT_PROFILE;
}

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile>(() => loadStoredProfile());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn('Failed to persist user profile to localStorage:', e);
    }
  }, [profile]);

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      const nextName =
        updates.displayName !== undefined
          ? updates.displayName.trim().slice(0, 60)
          : prev.displayName;
      const nextRole =
        updates.role !== undefined
          ? updates.role.trim().slice(0, 60)
          : prev.role;
      return {
        displayName: nextName || 'User',
        role: nextRole,
      };
    });
  };

  const resetProfile = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setProfile(DEFAULT_PROFILE);
  };

  const initials = computeInitials(profile.displayName);

  return (
    <UserProfileContext.Provider value={{ profile, initials, updateProfile, resetProfile }}>
      {children}
    </UserProfileContext.Provider>
  );
};
