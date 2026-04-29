import { HashRouter, Routes, Route } from 'react-router-dom';
import ProjectsScreen from './screens/ProjectsScreen';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ProjectsScreen />} />
      </Routes>
    </HashRouter>
  );
}

export default App;