import { HashRouter, Routes, Route } from 'react-router-dom';
import ProjectsScreen from './screens/ProjectsScreen';
import OnboardingFlow from './screens/OnboardingFlow';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ProjectsScreen />} />
        <Route path="/onboarding" element={<OnboardingFlow />} />
      </Routes>
    </HashRouter>
  );
}

export default App;