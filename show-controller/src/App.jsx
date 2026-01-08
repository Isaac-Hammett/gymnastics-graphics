import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ShowProvider } from './context/ShowContext';

// New pages
import HubPage from './pages/HubPage';
import DashboardPage from './pages/DashboardPage';
import ControllerPage from './pages/ControllerPage';
import UrlGeneratorPage from './pages/UrlGeneratorPage';

// Existing views (for show controller functionality)
import TalentView from './views/TalentView';
import ProducerView from './views/ProducerView';
import ImportView from './views/ImportView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* New consolidated pages */}
        <Route path="/" element={<HubPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/controller" element={<ControllerPage />} />
        <Route path="/url-generator" element={<UrlGeneratorPage />} />

        {/* Show controller routes (need ShowProvider) */}
        <Route
          path="/producer"
          element={
            <ShowProvider>
              <ProducerView />
            </ShowProvider>
          }
        />
        <Route
          path="/show-producer"
          element={
            <ShowProvider>
              <ProducerView />
            </ShowProvider>
          }
        />
        <Route
          path="/talent"
          element={
            <ShowProvider>
              <TalentView />
            </ShowProvider>
          }
        />

        {/* Import view doesn't need ShowProvider */}
        <Route path="/import" element={<ImportView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
