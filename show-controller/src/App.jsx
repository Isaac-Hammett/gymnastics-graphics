import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

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
import RundownEditorPage from './pages/RundownEditorPage';
import GraphicsManagerPage from './pages/GraphicsManagerPage';
import ThemeEditorPage from './pages/ThemeEditorPage';
import BackgroundGeneratorPage from './pages/BackgroundGeneratorPage';
import ChecklistPage from './pages/ChecklistPage';
import TalentPage from './pages/TalentPage';
import TalentProfilePage from './pages/TalentProfilePage';
import TalentDiscoveryPage from './pages/TalentDiscoveryPage';
import CommentaryPage from './pages/CommentaryPage';
import BookingPage from './pages/BookingPage';
import SurveyPage from './pages/SurveyPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';

// Error boundary for catching component errors
import ErrorBoundary from './components/ErrorBoundary';

// Competition-bound layout
import CompetitionLayout from './components/CompetitionLayout';

// Route guard for coordinator-dependent pages
import CoordinatorGate from './components/CoordinatorGate';

// Auth guard for protected pages
import RequireAuth from './components/RequireAuth';

// Existing views (for show controller functionality)
import TalentView from './views/TalentView';
import ProducerView from './views/ProducerView';
import ImportView from './views/ImportView';

function App() {
  return (
    <BrowserRouter>
      {/* Toast notifications for the app */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#27272a',
            color: '#fff',
            border: '1px solid #3f3f46',
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <Routes>
        {/* Home page - consolidated landing page */}
        <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />

        {/* Legacy routes redirect to home */}
        <Route path="/select" element={<Navigate to="/" replace />} />
        <Route path="/hub" element={<Navigate to="/" replace />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />

        {/* Standalone tool pages */}
        <Route path="/controller" element={<RequireAuth><ControllerPage /></RequireAuth>} />
        <Route path="/url-generator" element={<RequireAuth><UrlGeneratorPage /></RequireAuth>} />
        <Route path="/media-manager" element={<RequireAuth><MediaManagerPage /></RequireAuth>} />
        <Route path="/graphics-manager" element={<RequireAuth><GraphicsManagerPage /></RequireAuth>} />
        <Route path="/theme-editor" element={<RequireAuth><ThemeEditorPage /></RequireAuth>} />
        <Route path="/background-generator" element={<RequireAuth><BackgroundGeneratorPage /></RequireAuth>} />
        <Route path="/import" element={<RequireAuth><ImportView /></RequireAuth>} />

        {/* Admin routes - use _admin prefix to avoid /:compId catching it */}
        <Route path="/_admin/vm-pool" element={
          <RequireAuth>
            <CoordinatorGate>
              <VMPoolPage />
            </CoordinatorGate>
          </RequireAuth>
        } />
        <Route path="/_admin/system-offline" element={<RequireAuth><SystemOfflinePage /></RequireAuth>} />
        <Route path="/_admin/setup-guide" element={<RequireAuth><SetupGuidePage /></RequireAuth>} />

        {/* Talent roster — global tool pages */}
        <Route path="/talent" element={<RequireAuth><TalentPage /></RequireAuth>} />
        <Route path="/talent/discover" element={<RequireAuth><TalentDiscoveryPage /></RequireAuth>} />
        <Route path="/talent/:talentId" element={<RequireAuth><TalentProfilePage /></RequireAuth>} />

        {/* Settings page */}
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />

        {/* Public pages (no auth required) - MUST be before /:compId */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/book/:token" element={<BookingPage />} />
        <Route path="/survey/:year" element={<SurveyPage />} />

        {/* Legacy route redirects - redirect to home */}
        <Route path="/producer" element={<Navigate to="/" replace />} />
        <Route path="/show-producer" element={<Navigate to="/" replace />} />
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
          <Route path="commentary" element={<CommentaryPage />} />
          <Route path="rundown" element={<RundownEditorPage />} />
          <Route path="checklist" element={
            <ErrorBoundary>
              <ChecklistPage />
            </ErrorBoundary>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
