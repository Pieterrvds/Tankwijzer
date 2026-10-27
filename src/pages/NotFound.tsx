import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';

export function Loading() {
  return (
    <Layout title="KeurKompas">
      <p className="text-gray-600">Laden…</p>
    </Layout>
  );
}

export function InspectionNotFound() {
  return (
    <Layout title="Niet gevonden" back="/">
      <p className="mb-4">Deze inspectie bestaat niet (meer) op dit toestel.</p>
      <Link to="/" className="font-semibold text-brand underline">
        Naar het overzicht
      </Link>
    </Layout>
  );
}
