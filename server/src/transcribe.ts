/**
 * Speech-to-text, behind a small interface so the provider can be swapped.
 *
 * Both providers use the same OpenAI-style endpoint (multipart upload to
 * /v1/audio/transcriptions). Default: Mistral (EU company, Voxtral). The jargon list from
 * knowledge/vocabulary.json is passed as context so words like "kijkglas" are spelled right.
 */
import type { TranscribeResponse } from '../../src/ai/schemas';
import { AssistantError } from './assistant';

export interface Transcriber {
  transcribe(audio: Blob, fileName: string): Promise<TranscribeResponse>;
}

export interface TranscriberConfig {
  provider: 'mistral' | 'openai';
  apiKey: string;
  model?: string;
  vocabulary: string[];
  fetchImpl?: typeof fetch;
}

const ENDPOINTS = {
  mistral: { url: 'https://api.mistral.ai/v1/audio/transcriptions', model: 'voxtral-mini-latest' },
  openai: { url: 'https://api.openai.com/v1/audio/transcriptions', model: 'gpt-4o-transcribe' },
} as const;

export function createTranscriber(config: TranscriberConfig): Transcriber {
  const endpoint = ENDPOINTS[config.provider];
  const doFetch = config.fetchImpl ?? fetch;

  function form(audio: Blob, fileName: string, withVocabulary: boolean): FormData {
    const f = new FormData();
    f.append('model', config.model ?? endpoint.model);
    f.append('file', audio, fileName);
    f.append('language', 'nl');
    if (withVocabulary) {
      if (config.provider === 'mistral') {
        for (const word of config.vocabulary) f.append('context_bias', word);
      } else {
        f.append('prompt', `Vaktermen: ${config.vocabulary.join(', ')}.`);
      }
    }
    return f;
  }

  async function post(audio: Blob, fileName: string, withVocabulary: boolean) {
    return doFetch(endpoint.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form(audio, fileName, withVocabulary),
    });
  }

  return {
    async transcribe(audio, fileName) {
      let res = await post(audio, fileName, true);
      // If the provider rejects the vocabulary field, transcribe without it rather than fail.
      if (res.status === 400 || res.status === 422) res = await post(audio, fileName, false);
      if (!res.ok) throw new AssistantError(`Transcriptie mislukt (fout ${res.status}).`);
      const json = (await res.json()) as { text?: unknown };
      if (typeof json.text !== 'string')
        throw new AssistantError('Transcriptie gaf geen tekst terug.');
      return {
        text: json.text.trim(),
        provider: `${config.provider}:${config.model ?? endpoint.model}`,
      };
    },
  };
}
