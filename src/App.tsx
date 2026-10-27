import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ConfirmHost } from './components/ConfirmHost';
import { InspectionListPage } from './pages/InspectionListPage';
import { InspectionPage } from './pages/InspectionPage';
import { SectionPage } from './pages/SectionPage';
import { GegevensPage } from './pages/GegevensPage';
import { VorigeKeuringPage } from './pages/VorigeKeuringPage';
import { PhotoTrayPage } from './pages/PhotoTrayPage';
import { UpdatePrompt } from './components/UpdatePrompt';
import { VergeetNietPage } from './pages/VergeetNietPage';
import { RulesReviewPage } from './pages/RulesReviewPage';

/**
 * The preview build (`npm run build:preview`) runs inside an embedded page where the URL
 * cannot be changed, so it keeps the route in memory instead of in the address bar.
 */
const Router = import.meta.env.VITE_PREVIEW === 'true' ? MemoryRouter : BrowserRouter;

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<InspectionListPage />} />
        <Route path="/inspectie/:id" element={<InspectionPage />} />
        <Route path="/inspectie/:id/gegevens/:tab" element={<GegevensPage />} />
        <Route path="/inspectie/:id/vorige" element={<VorigeKeuringPage />} />
        <Route path="/inspectie/:id/fotos" element={<PhotoTrayPage />} />
        <Route path="/inspectie/:id/sectie/:code" element={<SectionPage />} />
        <Route path="/inspectie/:id/vergeet-niet" element={<VergeetNietPage />} />
        <Route path="/regels" element={<RulesReviewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UpdatePrompt />
      <ConfirmHost />
    </Router>
  );
}
