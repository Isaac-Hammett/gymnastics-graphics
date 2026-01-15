import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// New pages
import HubPage from './pages/HubPage';
import DashboardPage from './pages/DashboardPage';
import ControllerPage from './pages/ControllerPage';
import UrlGeneratorPage from './pages/UrlGeneratorPage';
import MediaManagerPage from './pages/MediaManagerPage';
import CameraSetupPage from './pages/CameraSetupPage';
import CompetitionSelector from './pages/CompetitionSelector';
import VMPoolPage from './pages/VMPoolPage';

// Competition-bound layout
import CompetitionLayout from './components/CompetitionLayout';

// Existing views (for show controller functionality)
import TalentView from './views/TalentView';
import ProducerView from './views/ProducerView';
import ImportView from './views/ImportView';

/**
 * Legacy route redirect component
 * Redirects old routes like /producer to /select?redirect=/producer
 */
function LegacyRedirect({ to }) {
  return <Navigate to={`/select?redirect=${to}`} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root redirects to competition selector */}
        <Route path="/" element={<Navigate to="/select" replace />} />

        {/* Competition selector (landing page) */}
        <Route path="/select" element={<CompetitionSelector />} />

        {/* Standalone pages (not competition-bound) */}
        <Route path="/hub" element={<HubPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/controller" element={<ControllerPage />} />
        <Route path="/url-generator" element={<UrlGeneratorPage />} />
        <Route path="/media-manager" element={<MediaManagerPage />} />
        <Route path="/import" element={<ImportView />} />

        {/* Admin routes - use _admin prefix to avoid /:compId catching it */}
        <Route path="/_admin/vm-pool" element={<VMPoolPage />} />

        {/* Legacy route redirects - redirect to selector with redirect param */}
        <Route path="/producer" element={<LegacyRedirect to="/producer" />} />
        <Route path="/show-producer" element={<LegacyRedirect to="/producer" />} />
        <Route path="/talent" element={<LegacyRedirect to="/talent" />} />
        <Route path="/camera-setup" element={<LegacyRedirect to="/camera-setup" />} />

        {/* Competition-bound routes */}
        <Route path="/:compId" element={<CompetitionLayout />}>
          {/* Default to producer view */}
          <Route index element={<Navigate to="producer" replace />} />

          {/* Main views within a competition */}
          <Route path="producer" element={<ProducerView />} />
          <Route path="talent" element={<TalentView />} />
          <Route path="camera-setup" element={<CameraSetupPage />} />
          <Route path="graphics" element={<ControllerPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
