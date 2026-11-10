import React, { useState, useEffect } from 'react';
import type { ScreenId } from '../types';
import { NavigationContext } from './navigation-context';
import { isValidUUID } from '../utils/uuid';

const LOCAL_STORAGE_KEY = 'threadline_selected_project_id';

const getInitialProjectId = (): string => {
  if (typeof window === 'undefined') return '';
  const hash = window.location.hash.replace('#', '').trim();
  if (hash.startsWith('project/')) {
    const candidate = hash.replace('project/', '').trim();
    if (isValidUUID(candidate)) return candidate;
  }
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored && isValidUUID(stored)) {
    return stored;
  }
  // Clear any stale non-UUID value from localStorage (e.g. 'INF-109')
  if (stored) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
  return '';
};

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('overview');
  const [selectedProjectId, setSelectedProjectIdState] = useState<string>(getInitialProjectId);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const workspaceName = 'Acme / Core Platform';

  const setSelectedProjectId = (id: string) => {
    if (isValidUUID(id)) {
      setSelectedProjectIdState(id);
      localStorage.setItem(LOCAL_STORAGE_KEY, id);
    } else if (!id) {
      setSelectedProjectIdState('');
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  // Listen to hash changes for browser navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (!hash) {
        setCurrentScreen('overview');
        return;
      }
      if (hash.startsWith('project/')) {
        const id = hash.replace('project/', '').trim();
        if (isValidUUID(id)) {
          setSelectedProjectId(id);
        }
        setCurrentScreen('project-workspace');
        return;
      }
      const validScreens: ScreenId[] = [
        'overview',
        'my-projects',
        'project-workspace',
        'my-tasks',
        'decisions',
        'activity',
        'documents',
        'handover-reports',
        'ai-review-queue',
        'continuity-map',
        'settings',
        'help-docs',
      ];
      if (validScreens.includes(hash as ScreenId)) {
        setCurrentScreen(hash as ScreenId);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Run on mount

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (screen: ScreenId, projectId?: string) => {
    if (projectId && isValidUUID(projectId)) {
      setSelectedProjectId(projectId);
      window.location.hash = `project/${projectId}`;
    } else {
      window.location.hash = screen;
    }
    setCurrentScreen(screen);
  };

  return (
    <NavigationContext.Provider
      value={{
        currentScreen,
        selectedProjectId,
        setSelectedProjectId,
        navigate,
        navigateTo: navigate,
        workspaceName,
        searchQuery,
        setSearchQuery,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};
