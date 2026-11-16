import React from 'react';
import { NavigationProvider } from './context/NavigationContext';
import { UserProfileProvider } from './context/UserProfileContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { useNavigation } from './context/useNavigation';
import { AppShell } from './components/layout/AppShell';
import { LoginScreen } from './screens/LoginScreen';
import threadlineLogo from './assets/threadline-logo.png';
import { OverviewScreen } from './screens/OverviewScreen';
import { MyProjectsScreen } from './screens/MyProjectsScreen';
import { ProjectWorkspaceScreen } from './screens/ProjectWorkspaceScreen';
import { MyTasksScreen } from './screens/MyTasksScreen';
import { DecisionsScreen } from './screens/DecisionsScreen';
import { ConflictsScreen } from './screens/ConflictsScreen';
import { ActivityTimelineScreen } from './screens/ActivityTimelineScreen';
import { DocumentsScreen } from './screens/DocumentsScreen';
import { AIReviewQueueScreen } from './screens/AIReviewQueueScreen';
import { ContinuityMapScreen } from './screens/ContinuityMapScreen';
import { HandoverReportsScreen } from './screens/HandoverReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';

const MainRouter: React.FC = () => {
  const { currentScreen } = useNavigation();

  switch (currentScreen) {
    case 'overview':
      return <OverviewScreen />;
    case 'my-projects':
      return <MyProjectsScreen />;
    case 'project-workspace':
      return <ProjectWorkspaceScreen />;
    case 'my-tasks':
      return <MyTasksScreen />;
    case 'decisions':
      return <DecisionsScreen />;
    case 'conflicts':
      return <ConflictsScreen />;
    case 'activity':
      return <ActivityTimelineScreen />;
    case 'documents':
      return <DocumentsScreen />;
    case 'handover-reports':
      return <HandoverReportsScreen />;
    case 'ai-review-queue':
      return <AIReviewQueueScreen />;
    case 'continuity-map':
      return <ContinuityMapScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'help-docs':
      return (
        <PlaceholderScreen
          title="Help & Documentation"
          subtitle="Guides, API reference, and knowledge continuity methodology."
          icon="help_outline"
        />
      );
    default:
      return <OverviewScreen />;
  }
};

const AuthenticatedApp: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-container-low select-none">
        <div className="flex flex-col items-center gap-4">
          <img
            src={threadlineLogo}
            alt="Threadline"
            className="h-10 w-auto object-contain rounded-xl shadow-md animate-pulse"
          />
          <div className="flex items-center gap-2 text-on-surface-variant font-label-md text-xs">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span>Restoring secure session...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <AppShell>
      <MainRouter />
    </AppShell>
  );
};

export function App() {
  return (
    <AuthProvider>
      <UserProfileProvider>
        <NavigationProvider>
          <AuthenticatedApp />
        </NavigationProvider>
      </UserProfileProvider>
    </AuthProvider>
  );
}

export default App;
