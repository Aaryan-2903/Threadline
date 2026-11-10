import React from 'react';
import { NavigationProvider } from './context/NavigationContext';
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
      return (
        <PlaceholderScreen
          title="Handover Reports"
          badge="Audit Ready"
          subtitle="Compiled knowledge continuity reports, executive briefings, and signed-off succession dossiers."
          icon="assignment_turned_in"
        />
      );
    case 'ai-review-queue':
      return <AIReviewQueueScreen />;
    case 'continuity-map':
      return (
        <PlaceholderScreen
          title="Continuity Map"
          badge="v2.4 topology"
          subtitle="Visual dependency graph mapping enterprise decisions, open handovers, risk blast radii, and owner relays."
          icon="hub"
        />
      );
    case 'settings':
      return (
        <PlaceholderScreen
          title="Workspace Settings"
          subtitle="Configure organization integrations, AI models, and audit log policies."
          icon="settings"
        />
      );
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
    <NavigationProvider>
      <AppShell>
        <MainRouter />
      </AppShell>
    </NavigationProvider>
  );
}

export default App;
