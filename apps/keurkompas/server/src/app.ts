/**
 * The KeurKompas API. Thin on purpose: it keeps the API keys away from the phone, validates
 * input and output, and stores nothing.
 *
 *   GET  /api/health      no auth — is the server up?
 *   GET  /api/check       auth    — is the app token right? (settings screen)
 *   POST /api/ask         auth    — answer a question (JSON AskRequest → Answer)
 *   POST /api/extract     auth    — understand the previous report (→ PreviousReportFacts)
 *   POST /api/tag         auth    — sort a photo or note into a T-section (→ TagResult)
 *   POST /api/transcribe  auth    — voice note to text (multipart "file" → { text })
 */
import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { cors } from 'hono/cors';
import { AskRequest, ExtractRequest, TagRequest } from '../../src/ai/schemas';
import { AssistantError, type Assistant } from './assistant';
import type { Transcriber } from './transcribe';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export interface AppDeps {
  assistant: Assistant;
  transcriber: Transcriber | null;
  appToken: string;
  /** Origins of the app allowed to call the API, e.g. https://keurkompas.pages.dev; "*" for any. */
  allowedOrigins: string[];
}

export function createApp(deps: AppDeps) {
  const app = new Hono();

  app.use(
    '/api/*',
    cors({
      origin: (origin) =>
        deps.allowedOrigins.includes('*') || deps.allowedOrigins.includes(origin) ? origin : null,
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      maxAge: 86400,
    }),
  );

  app.get('/api/health', (c) => c.json({ ok: true }));

  const auth = bearerAuth({ token: deps.appToken });
  app.use('/api/check', auth);
  app.use('/api/ask', auth);
  app.use('/api/extract', auth);
  app.use('/api/tag', auth);
  app.use('/api/transcribe', auth);

  app.get('/api/check', (c) => c.json({ ok: true, transcription: deps.transcriber !== null }));

  app.post('/api/ask', async (c) => {
    const parsed = AskRequest.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Ongeldige vraag.' }, 400);
    return c.json(await deps.assistant.ask(parsed.data));
  });

  app.post('/api/extract', async (c) => {
    const parsed = ExtractRequest.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Ongeldig verslag.' }, 400);
    return c.json(await deps.assistant.extract(parsed.data));
  });

  app.post('/api/tag', async (c) => {
    const parsed = TagRequest.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Ongeldige invoer.' }, 400);
    return c.json(await deps.assistant.tag(parsed.data));
  });

  app.post('/api/transcribe', async (c) => {
    if (!deps.transcriber)
      return c.json({ error: 'Transcriptie is niet ingesteld op de server.' }, 501);
    const form = await c.req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof Blob)) return c.json({ error: 'Geen audiobestand.' }, 400);
    if (file.size > MAX_AUDIO_BYTES)
      return c.json({ error: 'Audiobestand te groot (max 25 MB).' }, 413);
    const name = file instanceof File && file.name ? file.name : 'spraak.webm';
    return c.json(await deps.transcriber.transcribe(file, name));
  });

  app.onError((error, c) => {
    if (error instanceof AssistantError) return c.json({ error: error.message }, error.status);
    if ('getResponse' in error && typeof error.getResponse === 'function')
      return error.getResponse();
    console.error(error);
    return c.json({ error: 'Onverwachte fout op de server.' }, 500);
  });

  return app;
}
