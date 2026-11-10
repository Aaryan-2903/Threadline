import { createContext } from 'react';
import type { ScreenId } from '../types';

export interface NavigationContextType {
  currentScreen: ScreenId;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  navigate: (screen: ScreenId, projectId?: string) => void;
  navigateTo: (screen: ScreenId, projectId?: string) => void;
  workspaceName: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

