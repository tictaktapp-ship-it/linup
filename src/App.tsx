import { HashRouter, Routes, Route, useParams } from 'react-router-dom';
import ProjectsScreen from './screens/ProjectsScreen';
import OnboardingFlow from './screens/OnboardingFlow';
import StageWorkspaceScreen from './screens/StageWorkspaceScreen';
import AnalyticsDashboardScreen from './screens/AnalyticsDashboardScreen';
import SecretsWizardScreen from './screens/SecretsWizardScreen';
import MaintenanceScreen from './screens/MaintenanceScreen';

function AnalyticsRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  return <AnalyticsDashboardScreen projectId={projectId ?? ''} />;
}

function SecretsRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  return <SecretsWizardScreen projectId={projectId ?? ''} />;
}

function MaintenanceRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  return <MaintenanceScreen projectId={projectId ?? ''} />;
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path='/' element={<ProjectsScreen />} />
        <Route path='/onboarding' element={<OnboardingFlow />} />
        <Route path='/project/:projectId/stage/:stageIndex' element={<StageWorkspaceScreen />} />
        <Route path='/project/:projectId/analytics' element={<AnalyticsRoute />} />
        <Route path='/project/:projectId/secrets' element={<SecretsRoute />} />
        <Route path='/project/:projectId/maintenance' element={<MaintenanceRoute />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
