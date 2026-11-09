import React, { useState, useEffect } from 'react';
import type { ScreenId } from '../types';
import { NavigationContext } from './navigation-context';

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('INF-109');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const workspaceName = 'Acme / Core Platform';

  // Listen to hash changes for browser navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (!hash) {
        setCurrentScreen('overview');
        return;
      }
      if (hash.startsWith('project/')) {
        const id = hash.replace('project/', '');
        setSelectedProjectId(id);
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
    if (projectId) {
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
