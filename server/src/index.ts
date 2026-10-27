/** Cloudflare Workers entry point. Configuration comes from secrets/vars (see docs/SETUP.md). */
import { createApp } from './app';
import { createClaudeAssistant } from './assistant';
import { VOCABULARY } from './knowledge.generated';
import { createTranscriber } from './transcribe';

export interface Env {
  ANTHROPIC_API_KEY: string;
  APP_TOKEN: string;
  /** Comma-separated origins of the app, e.g. "https://keurkompas.pages.dev". */
  ALLOWED_ORIGINS: string;
  CLAUDE_MODEL?: string;
  /** "mistral" (default) or "openai". */
  TRANSCRIBE_PROVIDER?: string;
  MISTRAL_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

function transcriberFrom(env: Env) {
  const provider = env.TRANSCRIBE_PROVIDER === 'openai' ? 'openai' : 'mistral';
  const apiKey = provider === 'openai' ? env.OPENAI_API_KEY : env.MISTRAL_API_KEY;
  return apiKey ? createTranscriber({ provider, apiKey, vocabulary: VOCABULARY }) : null;
}

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    if (!env.ANTHROPIC_API_KEY || !env.APP_TOKEN) {
      return new Response('Server not configured: set ANTHROPIC_API_KEY and APP_TOKEN.', {
        status: 500,
      });
    }
    const app = createApp({
      assistant: createClaudeAssistant(env.ANTHROPIC_API_KEY, env.CLAUDE_MODEL || undefined),
      transcriber: transcriberFrom(env),
      appToken: env.APP_TOKEN,
      allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    return app.fetch(request, env);
  },
};
