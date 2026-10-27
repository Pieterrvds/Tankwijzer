import { useEffect } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { startQueue } from './ai/queue';
import { ConfirmHost } from './components/ConfirmHost';
import { UpdatePrompt } from './components/UpdatePrompt';
import { InspectionListPage } from './pages/InspectionListPage';
import { InspectionPage } from './pages/InspectionPage';
import { LessonsPage } from './pages/LessonsPage';
import { RulesReviewPage } from './pages/RulesReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { startSync } from './sync/sync';

const PREVIEW = import.meta.env.VITE_PREVIEW === 'true';

/**
 * The preview build (`npm run build:preview`) runs inside an embedded page where the URL
 * cannot be changed, so it keeps the route in memory instead of in the address bar.
 */
const Router = PREVIEW ? MemoryRouter : BrowserRouter;

export function App() {
  // Background work: answer questions, transcribe and sort notes, upload to OneDrive.
  useEffect(() => startQueue(), []);
  useEffect(() => (PREVIEW ? undefined : startSync()), []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<InspectionListPage />} />
        <Route path="/inspectie/:id" element={<InspectionPage />} />
        <Route path="/instellingen" element={<SettingsPage />} />
        <Route path="/lessen" element={<LessonsPage />} />
        <Route path="/regels" element={<RulesReviewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UpdatePrompt />
      <ConfirmHost />
    </Router>
  );
}
