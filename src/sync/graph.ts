/**
 * Upload to OneDrive with Microsoft Graph. Small files (≤ 4 MB) in one request; larger ones
 * (long voice notes) through an upload session in chunks.
 */

const GRAPH = 'https://graph.microsoft.com/v1.0';
const SIMPLE_LIMIT = 4 * 1024 * 1024;
/** Chunks must be a multiple of 320 KiB. */
const CHUNK = 10 * 320 * 1024;

export class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** "a b/c#d.jpg" → "a%20b/c%23d.jpg" — each segment encoded, slashes kept. */
export function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export async function uploadFile(
  token: string,
  path: string,
  blob: Blob,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const item = `${GRAPH}/me/drive/root:/${encodePath(path)}`;
  if (blob.size <= SIMPLE_LIMIT) {
    const res = await fetchImpl(`${item}:/content`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': blob.type || 'application/octet-stream',
      },
      body: blob,
    });
    if (!res.ok) throw new GraphError(`Upload mislukt (${res.status})`, res.status);
    return;
  }

  const session = await fetchImpl(`${item}:/createUploadSession`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
  });
  if (!session.ok)
    throw new GraphError(`Upload starten mislukt (${session.status})`, session.status);
  const { uploadUrl } = (await session.json()) as { uploadUrl: string };
  for (let start = 0; start < blob.size; start += CHUNK) {
    const end = Math.min(start + CHUNK, blob.size);
    // The upload URL is pre-authorised: no Authorization header (Graph rejects it).
    const res = await fetchImpl(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Range': `bytes ${start}-${end - 1}/${blob.size}` },
      body: blob.slice(start, end),
    });
    if (!res.ok) throw new GraphError(`Upload mislukt (${res.status})`, res.status);
  }
}
