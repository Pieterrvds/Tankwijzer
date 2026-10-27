import { describe, expect, it, vi } from 'vitest';
import type { Answer, AskRequest, PreviousReportFacts } from '../../src/ai/schemas';
import { createApp } from './app';
import { AssistantError, createClaudeAssistant, type Assistant } from './assistant';
import { buildAskRequest, renderLessons } from './prompt';
import { createTranscriber } from './transcribe';

const ANSWER: Answer = {
  antwoord: 'Ja, een kijkglas is toegelaten als lekdetectie op een bestaande dubbelwandige houder.',
  zekerheid: 'middel',
  te_bevestigen: true,
  bronnen: [{ bron: 'regel', referentie: 'lekdetectie.kijkglas_vlotter_logboek', citaat: '' }],
  sectie: 'T8',
  voorstel_tekst: null,
  nakijken: ['Is het kijkglas leesbaar?'],
};

const ASK: AskRequest = {
  vraag: 'Is dit kijkglas in orde?',
  bezoek: { klant: 'Klant NV', datum: '2026-10-27', tank: 'Tank 3' },
  vorigVerslag: 'T8 Lekdetectie: kijkglas, OK.',
  notities: [{ label: 'VN_01', tijd: '10:02', tekst: 'kijkglas aan de mangatdeksel' }],
  fotos: [{ label: 'foto 1', mediaType: 'image/jpeg', data: 'AAAA' }],
  eerdereVragen: [],
  lessen: [{ vraag: 'x', fout_antwoord: 'y', correctie: 'z' }],
};

function fakeAssistant(): Assistant {
  return {
    ask: vi.fn(async () => ANSWER),
    extract: vi.fn(async () => ({}) as PreviousReportFacts),
    tag: vi.fn(async () => ({
      sectie: 'T10',
      omschrijving: 'Inkuiping met water',
      zekerheid: 'hoog' as const,
    })),
  };
}

function app(overrides: Partial<Parameters<typeof createApp>[0]> = {}) {
  return createApp({
    assistant: fakeAssistant(),
    transcriber: null,
    appToken: 'geheim',
    allowedOrigins: ['https://app.example'],
    ...overrides,
  });
}

const auth = { Authorization: 'Bearer geheim', 'Content-Type': 'application/json' };

describe('API', () => {
  it('health needs no token, the rest does', async () => {
    expect((await app().request('/api/health')).status).toBe(200);
    expect((await app().request('/api/check')).status).toBe(401);
    expect(
      (await app().request('/api/check', { headers: { Authorization: 'Bearer fout' } })).status,
    ).toBe(401);
    expect((await app().request('/api/check', { headers: auth })).status).toBe(200);
  });

  it('answers a valid question and rejects an invalid one', async () => {
    const res = await app().request('/api/ask', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify(ASK),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ANSWER);
    const bad = await app().request('/api/ask', {
      method: 'POST',
      headers: auth,
      body: '{"vraag":""}',
    });
    expect(bad.status).toBe(400);
  });

  it('tags a note, and rejects an empty tag request', async () => {
    const body = { tekst: 'water in de inkuiping', foto: null, context: '' };
    const res = await app().request('/api/tag', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify(body),
    });
    expect(await res.json()).toMatchObject({ sectie: 'T10' });
    const empty = await app().request('/api/tag', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ tekst: null, foto: null, context: '' }),
    });
    expect(empty.status).toBe(400);
  });

  it('turns assistant errors into a Dutch message with the right status', async () => {
    const assistant = fakeAssistant();
    assistant.ask = async () => {
      throw new AssistantError('Even te veel vragen tegelijk.', 429);
    };
    const res = await app({ assistant }).request('/api/ask', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify(ASK),
    });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'Even te veel vragen tegelijk.' });
  });

  it('only allows the configured origin (CORS)', async () => {
    const ok = await app().request('/api/health', { headers: { Origin: 'https://app.example' } });
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    const other = await app().request('/api/health', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('transcribes an uploaded file, or says transcription is not configured', async () => {
    const form = () => {
      const f = new FormData();
      f.append('file', new Blob(['x'], { type: 'audio/mp4' }), 'VN_01.m4a');
      return f;
    };
    const none = await app().request('/api/transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer geheim' },
      body: form(),
    });
    expect(none.status).toBe(501);
    const transcriber = {
      transcribe: vi.fn(async (_audio: Blob, _name: string) => ({
        text: 'kijkglas OK',
        provider: 'test',
      })),
    };
    const res = await app({ transcriber }).request('/api/transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer geheim' },
      body: form(),
    });
    expect(await res.json()).toEqual({ text: 'kijkglas OK', provider: 'test' });
    expect(transcriber.transcribe.mock.calls[0]![1]).toBe('VN_01.m4a');
  });
});

describe('prompt', () => {
  it('caches knowledge and the previous report, and puts the question last', () => {
    const { system, content } = buildAskRequest(ASK);
    expect(system[1]!.cache_control).toEqual({ type: 'ephemeral' });
    expect(system[1]!.text).toContain('Standard sentences');
    expect(system[2]!.text).toContain('Correctie van de keurder: z');
    expect(content[0]).toMatchObject({ type: 'text', cache_control: { type: 'ephemeral' } });
    expect(content.some((b) => b.type === 'image')).toBe(true);
    expect(content.at(-1)).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Is dit kijkglas in orde?'),
    });
  });

  it('is deterministic (no timestamps that would break the cache)', () => {
    expect(JSON.stringify(buildAskRequest(ASK))).toBe(JSON.stringify(buildAskRequest(ASK)));
  });

  it('leaves out an empty previous report and empty lessen', () => {
    const { system, content } = buildAskRequest({ ...ASK, vorigVerslag: '', lessen: [] });
    expect(system).toHaveLength(2);
    expect(JSON.stringify(content)).not.toContain('vorig_verslag');
    expect(renderLessons([])).toBe('');
  });
});

describe('Claude assistant (real SDK, fake network)', () => {
  function fakeAnthropic(reply: { text: string; stop_reason?: string }) {
    const calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: String(url),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)),
      });
      return new Response(
        JSON.stringify({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5-5',
          content: [{ type: 'text', text: reply.text }],
          stop_reason: reply.stop_reason ?? 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchImpl);
    return calls;
  }

  it('sends a structured-output request with fallbacks and parses the answer', async () => {
    const calls = fakeAnthropic({ text: JSON.stringify(ANSWER) });
    const answer = await createClaudeAssistant('sk-test').ask(ASK);
    expect(answer).toEqual(ANSWER);
    const { headers, body } = calls[0]!;
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(body.model).toBe('claude-opus-5-5');
    expect(body.fallbacks).toBe('default');
    expect(body.output_config).toMatchObject({ effort: 'medium', format: { type: 'json_schema' } });
    vi.unstubAllGlobals();
  });

  it('reports a refusal as a Dutch error instead of an empty answer', async () => {
    fakeAnthropic({ text: '', stop_reason: 'refusal' });
    await expect(createClaudeAssistant('sk-test').ask(ASK)).rejects.toThrow(
      /kon deze vraag niet beantwoorden/,
    );
    vi.unstubAllGlobals();
  });
});

describe('transcriber', () => {
  it('sends Dutch + the jargon list to Mistral, and retries without it if rejected', async () => {
    const forms: FormData[] = [];
    let n = 0;
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      forms.push(init!.body as FormData);
      n++;
      return n === 1
        ? new Response('bad', { status: 422 })
        : new Response(JSON.stringify({ text: ' kijkglas ok ' }), { status: 200 });
    });
    const t = createTranscriber({
      provider: 'mistral',
      apiKey: 'k',
      vocabulary: ['kijkglas', 'inkuiping'],
      fetchImpl,
    });
    const result = await t.transcribe(new Blob(['x']), 'VN_01.m4a');
    expect(result.text).toBe('kijkglas ok');
    expect(forms[0]!.get('language')).toBe('nl');
    expect(forms[0]!.getAll('context_bias')).toEqual(['kijkglas', 'inkuiping']);
    expect(forms[1]!.getAll('context_bias')).toEqual([]);
  });

  it('uses a prompt for OpenAI', async () => {
    let form: FormData | undefined;
    const fetchImpl = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => {
      form = init!.body as FormData;
      return new Response(JSON.stringify({ text: 'ok' }), { status: 200 });
    });
    await createTranscriber({
      provider: 'openai',
      apiKey: 'k',
      vocabulary: ['ATEX'],
      fetchImpl,
    }).transcribe(new Blob(['x']), 'a.webm');
    expect(form!.get('model')).toBe('gpt-4o-transcribe');
    expect(form!.get('prompt')).toContain('ATEX');
  });
});
