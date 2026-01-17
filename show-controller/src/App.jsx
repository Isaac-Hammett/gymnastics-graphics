import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import HomePage from './pages/HomePage';
import ControllerPage from './pages/ControllerPage';
import UrlGeneratorPage from './pages/UrlGeneratorPage';
import MediaManagerPage from './pages/MediaManagerPage';
import CameraSetupPage from './pages/CameraSetupPage';
import VMPoolPage from './pages/VMPoolPage';
import SystemOfflinePage from './pages/SystemOfflinePage';
import SetupGuidePage from './pages/SetupGuidePage';
import OBSManager from './pages/OBSManager';

// Competition-bound layout
import CompetitionLayout from './components/CompetitionLayout';

// Route guard for coordinator-dependent pages
import CoordinatorGate from './components/CoordinatorGate';

// Existing views (for show controller functionality)
import TalentView from './views/TalentView';
import ProducerView from './views/ProducerView';
import ImportView from './views/ImportView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home page - consolidated landing page */}
        <Route path="/" element={<HomePage />} />

        {/* Legacy routes redirect to home */}
        <Route path="/select" element={<Navigate to="/" replace />} />
        <Route path="/hub" element={<Navigate to="/" replace />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />

        {/* Standalone tool pages */}
        <Route path="/controller" element={<ControllerPage />} />
        <Route path="/url-generator" element={<UrlGeneratorPage />} />
        <Route path="/media-manager" element={<MediaManagerPage />} />
        <Route path="/import" element={<ImportView />} />

        {/* Admin routes - use _admin prefix to avoid /:compId catching it */}
        <Route path="/_admin/vm-pool" element={
          <CoordinatorGate>
            <VMPoolPage />
          </CoordinatorGate>
        } />
        <Route path="/_admin/system-offline" element={<SystemOfflinePage />} />
        <Route path="/_admin/setup-guide" element={<SetupGuidePage />} />

        {/* Legacy route redirects - redirect to home */}
        <Route path="/producer" element={<Navigate to="/" replace />} />
        <Route path="/show-producer" element={<Navigate to="/" replace />} />
        <Route path="/talent" element={<Navigate to="/" replace />} />
        <Route path="/camera-setup" element={<Navigate to="/" replace />} />

        {/* Competition-bound routes */}
        <Route path="/:compId" element={<CompetitionLayout />}>
          {/* Default to producer view */}
          <Route index element={<Navigate to="producer" replace />} />

          {/* Main views within a competition */}
          <Route path="producer" element={<ProducerView />} />
          <Route path="talent" element={<TalentView />} />
          <Route path="camera-setup" element={<CameraSetupPage />} />
          <Route path="graphics" element={<ControllerPage />} />
          <Route path="obs-manager" element={<OBSManager />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
