import { HashRouter, Routes, Route, useParams, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import TopBar from './components/TopBar';
import AuthScreen from './screens/AuthScreen';
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

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--color-text-tertiary)', fontSize: 14 }}>Loading...</div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
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
  );
}

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </HashRouter>
  );
}

export default App;
