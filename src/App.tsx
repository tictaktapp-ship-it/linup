import { HashRouter, Routes, Route, useParams, Navigate } from 'react-router-dom';
import TopBar from './components/TopBar';
import ProjectsScreen from './screens/ProjectsScreen';
import OnboardingFlow from './screens/OnboardingFlow';
import StageWorkspaceScreen from './screens/StageWorkspaceScreen';
import AnalyticsDashboardScreen from './screens/AnalyticsDashboardScreen';
import SecretsWizardScreen from './screens/SecretsWizardScreen';
import MaintenanceScreen from './screens/MaintenanceScreen';
import UpdatesScreen from './screens/UpdatesScreen';

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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <TopBar />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Routes>
            <Route path='/' element={<ProjectsScreen />} />
            <Route path='/onboarding' element={<OnboardingFlow />} />
            <Route path='/project/:projectId/stage/:stageIndex' element={<StageWorkspaceScreen />} />
            <Route path='/project/:projectId/analytics' element={<AnalyticsRoute />} />
            <Route path='/project/:projectId/secrets' element={<SecretsRoute />} />
            <Route path='/project/:projectId/maintenance' element={<MaintenanceRoute />} />
            <Route path='/settings/updates' element={<UpdatesScreen />} />
            <Route path='*' element={<Navigate to='/' replace />} />
          </Routes>
        </div>
      </div>
    </HashRouter>
  );
}

export default App;
