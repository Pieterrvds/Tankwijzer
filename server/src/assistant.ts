/**
 * Calls Claude with structured outputs, so every reply is validated against the shared Zod
 * schemas before it reaches the app.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod/v4';
import {
  Answer,
  PreviousReportFacts,
  TagResult,
  type AskRequest,
  type ExtractRequest,
  type TagRequest,
} from '../../src/ai/schemas';
import { buildAskRequest, buildExtractRequest, buildTagRequest } from './prompt';

export const DEFAULT_MODEL = 'claude-opus-5-5';

/** An error with a Dutch message that can be shown to the inspector as is. */
export class AssistantError extends Error {
  constructor(
    message: string,
    readonly status: 422 | 429 | 502 = 502,
  ) {
    super(message);
  }
}

export interface Assistant {
  ask(req: AskRequest): Promise<Answer>;
  extract(req: ExtractRequest): Promise<PreviousReportFacts>;
  tag(req: TagRequest): Promise<TagResult>;
}

export function createClaudeAssistant(apiKey: string, model = DEFAULT_MODEL): Assistant {
  const client = new Anthropic({ apiKey });

  async function run<T extends z.ZodType>(
    schema: T,
    effort: 'low' | 'medium',
    request: {
      system: Anthropic.Beta.BetaTextBlockParam[];
      content: Anthropic.Beta.BetaContentBlockParam[];
    },
  ): Promise<z.infer<T>> {
    let response;
    try {
      response = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        // If a safety classifier declines, the API retries on Anthropic's recommended model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort, format: betaZodOutputFormat(schema) },
        system: request.system,
        messages: [{ role: 'user', content: request.content }],
      });
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError)
        throw new AssistantError(
          'Even te veel vragen tegelijk. Probeer het over een minuut opnieuw.',
          429,
        );
      if (error instanceof Anthropic.APIError)
        throw new AssistantError(`De assistent is niet bereikbaar (fout ${error.status ?? '?'}).`);
      throw error;
    }
    // Check why the model stopped before reading the content: a refusal has no JSON.
    if (response.stop_reason === 'refusal')
      throw new AssistantError(
        'De assistent kon deze vraag niet beantwoorden. Formuleer ze anders.',
        422,
      );
    if (response.stop_reason === 'max_tokens')
      throw new AssistantError('Het antwoord was onvolledig. Probeer opnieuw.');
    const text = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AssistantError('Het antwoord was onleesbaar. Probeer opnieuw.');
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success)
      throw new AssistantError('Het antwoord had een onverwacht formaat. Probeer opnieuw.');
    return parsed.data;
  }

  return {
    ask: (req) => run(Answer, 'medium', buildAskRequest(req)),
    extract: (req) => run(PreviousReportFacts, 'medium', buildExtractRequest(req)),
    // Routine sorting work: low effort keeps it fast and cheap.
    tag: (req) => run(TagResult, 'low', buildTagRequest(req)),
  };
}
