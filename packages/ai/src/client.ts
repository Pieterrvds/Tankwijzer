import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

/**
 * Thin wrapper around the Claude API for structured (Zod-validated) outputs.
 *
 * - Every call returns JSON validated against a Zod schema; free text never flows straight to the UI.
 * - Server-side refusal fallback is enabled, so a false-positive safety decline is retried on a
 *   fallback model instead of failing the owner's request.
 * - When no API key is configured, AI is disabled and callers fall back to manual input.
 */

export const DEFAULT_MODEL = "claude-opus-5-5";

export class AiDisabledError extends Error {
  constructor() {
    super("AI is niet geconfigureerd (ANTHROPIC_API_KEY ontbreekt). Vul de gegevens manueel in.");
  }
}

export class AiOutputError extends Error {}

export type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export interface InputFile {
  mediaType: string;
  base64: string;
}

export type UserContent = Anthropic.Beta.Messages.BetaContentBlockParam[];

export function fileToContent(file: InputFile): Anthropic.Beta.Messages.BetaContentBlockParam {
  if (file.mediaType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } };
  }
  const allowed: ImageMediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowed.includes(file.mediaType as ImageMediaType)) {
    throw new AiOutputError(`Bestandstype ${file.mediaType} wordt niet ondersteund (gebruik JPG, PNG, WEBP of PDF).`);
  }
  return {
    type: "image",
    source: { type: "base64", media_type: file.mediaType as ImageMediaType, data: file.base64 },
  };
}

export interface StructuredCall<S extends z.ZodType> {
  schema: S;
  system: string;
  content: UserContent;
  effort?: "low" | "medium" | "high";
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  usage: { input: number; output: number };
}

export class ClaudeClient {
  constructor(
    private readonly client: Anthropic | null,
    readonly model: string = DEFAULT_MODEL,
  ) {}

  get enabled(): boolean {
    return this.client !== null;
  }

  async structured<S extends z.ZodType>(call: StructuredCall<S>): Promise<StructuredResult<z.infer<S>>> {
    if (!this.client) throw new AiDisabledError();
    const res = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // The knowledge base and instructions are stable: cache them across requests.
      system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
      output_config: { effort: call.effort ?? "medium", format: betaZodOutputFormat(call.schema) },
      messages: [{ role: "user", content: call.content }],
    });
    if (res.stop_reason === "refusal") {
      throw new AiOutputError("De AI kon deze vraag niet behandelen. Probeer het anders te formuleren.");
    }
    if (res.stop_reason === "max_tokens" || !res.parsed_output) {
      throw new AiOutputError("De AI gaf geen bruikbaar antwoord. Probeer opnieuw.");
    }
    return {
      data: res.parsed_output as z.infer<S>,
      model: res.model,
      usage: { input: res.usage.input_tokens, output: res.usage.output_tokens },
    };
  }
}

/** Builds a client from the environment. AI is disabled when no key is set. */
export function createClaudeClient(env: Record<string, string | undefined> = process.env): ClaudeClient {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return new ClaudeClient(null);
  return new ClaudeClient(new Anthropic({ apiKey }), env.TANKWIJZER_AI_MODEL || DEFAULT_MODEL);
}
