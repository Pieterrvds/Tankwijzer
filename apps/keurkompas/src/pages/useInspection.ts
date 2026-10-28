import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { db } from '../db/db';

/**
 * Live inspection from the route param `:id`.
 * `undefined` while loading, `null` when it does not exist.
 */
export function useInspection() {
  const { id = '' } = useParams();
  const inspection = useLiveQuery(async () => (await db.inspections.get(id)) ?? null, [id]);
  return { id, inspection };
}
