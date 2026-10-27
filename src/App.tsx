import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { InspectionListPage } from './pages/InspectionListPage';
import { InspectionPage } from './pages/InspectionPage';
import { SectionPage } from './pages/SectionPage';
import { GegevensPage } from './pages/GegevensPage';
import { VorigeKeuringPage } from './pages/VorigeKeuringPage';
import { PhotoTrayPage } from './pages/PhotoTrayPage';
import { UpdatePrompt } from './components/UpdatePrompt';
import { VergeetNietPage } from './pages/VergeetNietPage';
import { RulesReviewPage } from './pages/RulesReviewPage';

export function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
