/**
 * How the app reaches the assistant. Normally the KeurKompas server (keys stay there); in the
 * preview build, Claude through the page itself. Both return the same validated shapes.
 */
import type { SettingsRecord } from '../db/db';
import {
  Answer,
  PreviousReportFacts,
  TagResult,
  TranscribeResponse,
  type AskRequest,
  type TagRequest,
} from './schemas';

/** `retry` = temporary (no network, server busy): leave the job queued and try again later. */
export class AiError extends Error {
  constructor(
    message: string,
    readonly retry: boolean,
  ) {
    super(message);
  }
}

export interface AiProvider {
  /** Shown in the settings screen. */
  name: string;
  ask(req: AskRequest): Promise<Answer>;
  extract(vorigVerslag: string): Promise<PreviousReportFacts>;
  /** Sort a photo or note into a T-section (background). */
  tag(req: TagRequest): Promise<TagResult>;
  /** null when this provider cannot transcribe (preview). */
  transcribe: ((audio: Blob, fileName: string) => Promise<TranscribeResponse>) | null;
}

export function createServerProvider(
  settings: Pick<SettingsRecord, 'serverUrl' | 'appToken'>,
): AiProvider {
  const base = settings.serverUrl.replace(/\/+$/, '');
  const headers = { Authorization: `Bearer ${settings.appToken}` };

  async function call<T>(path: string, init: RequestInit, parse: (json: unknown) => T): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...init.headers } });
    } catch {
      throw new AiError('Geen verbinding met de server.', true);
    }
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        json && typeof json === 'object' && 'error' in json && typeof json.error === 'string'
          ? json.error
          : res.status === 401
            ? 'De app-sleutel klopt niet (zie Instellingen).'
            : `Serverfout ${res.status}.`;
      throw new AiError(message, res.status === 429 || res.status >= 500);
    }
    try {
      return parse(json);
    } catch {
      throw new AiError('Onverwacht antwoord van de server.', false);
    }
  }

  const postJson = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return {
    name: 'KeurKompas-server',
    ask: (req) => call('/api/ask', postJson(req), (j) => Answer.parse(j)),
    extract: (vorigVerslag) =>
      call('/api/extract', postJson({ vorigVerslag }), (j) => PreviousReportFacts.parse(j)),
    tag: (req) => call('/api/tag', postJson(req), (j) => TagResult.parse(j)),
    transcribe: (audio, fileName) => {
      const form = new FormData();
      form.append('file', audio, fileName);
      return call('/api/transcribe', { method: 'POST', body: form }, (j) =>
        TranscribeResponse.parse(j),
      );
    },
  };
}

/** Check the server address and app token (settings screen). */
export async function checkServer(settings: Pick<SettingsRecord, 'serverUrl' | 'appToken'>) {
  const base = settings.serverUrl.replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/check`, {
      headers: { Authorization: `Bearer ${settings.appToken}` },
    });
    if (res.status === 401)
      return { ok: false, message: 'Server bereikt, maar de app-sleutel klopt niet.' };
    if (!res.ok) return { ok: false, message: `Server antwoordt met fout ${res.status}.` };
    const json = (await res.json()) as { transcription?: boolean };
    return {
      ok: true,
      message: json.transcription
        ? 'Verbonden. Vragen en spraak-naar-tekst werken.'
        : 'Verbonden. Vragen werken; spraak-naar-tekst is nog niet ingesteld op de server.',
    };
  } catch {
    return { ok: false, message: 'Server niet bereikbaar. Klopt het adres? Is er netwerk?' };
  }
}
