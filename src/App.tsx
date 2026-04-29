import { HashRouter, Routes, Route } from 'react-router-dom';
import ProjectsScreen from './screens/ProjectsScreen';
import OnboardingFlow from './screens/OnboardingFlow';
import StageWorkspaceScreen from './screens/StageWorkspaceScreen';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ProjectsScreen />} />
        <Route path="/onboarding" element={<OnboardingFlow />} />
        <Route path="/project/:projectId/stage/:stageIndex" element={<StageWorkspaceScreen />} />
      </Routes>
    </HashRouter>
  );
}

export default App;