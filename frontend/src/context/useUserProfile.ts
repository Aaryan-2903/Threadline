import { useContext } from 'react';
import { UserProfileContext, type UserProfileContextType } from './user-profile-context';

export function useUserProfile(): UserProfileContextType {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}
