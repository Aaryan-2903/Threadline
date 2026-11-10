import React from 'react';
import { NavigationProvider } from './context/NavigationContext';
import { UserProfileProvider } from './context/UserProfileContext';
import { useNavigation } from './context/useNavigation';
import { AppShell } from './components/layout/AppShell';
import { OverviewScreen } from './screens/OverviewScreen';
import { MyProjectsScreen } from './screens/MyProjectsScreen';
import { ProjectWorkspaceScreen } from './screens/ProjectWorkspaceScreen';
import { MyTasksScreen } from './screens/MyTasksScreen';
import { DecisionsScreen } from './screens/DecisionsScreen';
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

export function App() {
  return (
    <UserProfileProvider>
      <NavigationProvider>
        <AppShell>
          <MainRouter />
        </AppShell>
      </NavigationProvider>
    </UserProfileProvider>
  );
}

export default App;
