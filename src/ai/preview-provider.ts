/**
 * Preview build only: asks Claude through the claude.ai page ("sample" capability), on the
 * viewer's own Claude account. No server, no transcription. Same instructions, knowledge and
 * answer schema as the server.
 */
import { renderKnowledgeBundle } from './knowledge-bundle';
import { ASSISTANT_INSTRUCTIONS, EXTRACT_INSTRUCTIONS, TAG_INSTRUCTIONS } from './instructions';
import { AiError, type AiProvider } from './provider';
import { Answer, PreviousReportFacts, TagResult, type AskRequest } from './schemas';

interface SampleError {
  code: string;
  message: string;
}
interface Sample {
  json<T = unknown>(
    input: string,
    options?: { images?: Blob[]; cache?: boolean; modelTier?: string },
  ): Promise<T>;
}
declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> };
  }
}

const MAX_PROMPT_CHARS = 200_000;

const ANSWER_SHAPE = `Reply with only one JSON object of this shape:
{"antwoord": string, "zekerheid": "hoog"|"middel"|"laag", "te_bevestigen": boolean,
 "bronnen": [{"bron": "vlarem"|"vorig_verslag"|"regel"|"standaardzin"|"foto"|"notitie"|"les"|"algemene_kennis", "referentie": string, "citaat": string}],
 "sectie": string|null, "voorstel_tekst": {"soort": "tekortkoming"|"opmerking"|"informatie", "tekst": string}|null,
 "nakijken": [string]}`;

const FACTS_SHAPE = `Reply with only one JSON object of this shape (null when unknown):
{"samenvatting": string, "verslagnummer": string|null, "datum": "yyyy-mm-dd"|null, "klever": "groen"|"oranje"|"rood"|null,
 "tank": {"materiaal": string|null, "wand": "enkelwandig"|"dubbelwandig"|null, "plaatsing": "bovengronds"|"ondergronds"|null,
   "inhoud_liter": number|null, "bouwjaar": number|null, "fabricagenr": string|null, "tankbouwer": string|null,
   "tanknr": string|null, "norm": string|null, "deel_van_tankenpark": boolean|null},
 "product": {"naam": string|null, "vlampunt_c": number|null, "dampdruk_kpa": number|null, "ghs": [string]},
 "lekdetectie": string|null, "overvulsysteem": string|null, "peilmeter": string|null,
 "aandachtspunten": [{"tekst": string, "soort": "tekortkoming"|"opmerking"|"informatie", "sectie": string|null, "tegen_volgende_keuring": boolean}]}`;

function base64ToBlob(data: string, type: string): Blob {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type });
}

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}\n[… ingekort voor het voorbeeld]` : text;
}

export async function createPreviewProvider(): Promise<AiProvider | null> {
  const sample = (await window.claude?.use('sample').catch(() => null)) as Sample | null;
  if (!sample) return null;
  const knowledge = renderKnowledgeBundle().text;

  async function json<T>(
    prompt: string,
    parse: (v: unknown) => T,
    images: Blob[] = [],
    modelTier?: 'quick',
  ): Promise<T> {
    let value: unknown;
    try {
      value = await sample!.json(prompt, {
        images: images.length ? images : undefined,
        modelTier,
        cache: false,
      });
    } catch (e) {
      const code = (e as SampleError).code;
      if (code === 'not_granted')
        throw new AiError('Je hebt Claude niet toegelaten op deze pagina.', false);
      if (code === 'rate_limited')
        throw new AiError('Even te veel vragen. Probeer zo opnieuw.', true);
      throw new AiError((e as SampleError).message || 'De assistent gaf geen antwoord.', false);
    }
    try {
      return parse(value);
    } catch {
      throw new AiError('Het antwoord had een onverwacht formaat. Probeer opnieuw.', false);
    }
  }

  return {
    name: 'Claude via deze pagina (voorbeeld)',
    ask(req: AskRequest) {
      const prompt = clip(
        [
          ASSISTANT_INSTRUCTIONS,
          `<kennis>\n${knowledge}\n</kennis>`,
          req.lessen.length
            ? `<lessen>\n${req.lessen.map((l) => `Vraag: ${l.vraag}\nFout: ${l.fout_antwoord}\nCorrectie: ${l.correctie}`).join('\n\n')}\n</lessen>`
            : '',
          req.vorigVerslag ? `<vorig_verslag>\n${req.vorigVerslag}\n</vorig_verslag>` : '',
          req.notities.length
            ? `<notities>\n${req.notities.map((n) => `[${n.label}, ${n.tijd}] ${n.tekst}`).join('\n')}\n</notities>`
            : '',
          req.eerdereVragen.length
            ? `<eerdere_vragen>\n${req.eerdereVragen.map((q) => `V: ${q.vraag}\nA: ${q.antwoord}`).join('\n\n')}\n</eerdere_vragen>`
            : '',
          req.fotos.length
            ? `Bijgevoegde foto's, in volgorde: ${req.fotos.map((f) => f.label).join('; ')}`
            : '',
          `<vraag>\n${req.vraag}\n</vraag>`,
          ANSWER_SHAPE,
        ]
          .filter(Boolean)
          .join('\n\n'),
        MAX_PROMPT_CHARS,
      );
      return json(
        prompt,
        (v) => Answer.parse(v),
        req.fotos.map((f) => base64ToBlob(f.data, f.mediaType)),
      );
    },
    extract(vorigVerslag: string) {
      const prompt = clip(
        [
          EXTRACT_INSTRUCTIONS,
          `<vorig_verslag>\n${vorigVerslag}\n</vorig_verslag>`,
          FACTS_SHAPE,
        ].join('\n\n'),
        MAX_PROMPT_CHARS,
      );
      return json(prompt, (v) => PreviousReportFacts.parse(v));
    },
    tag(req) {
      const prompt = [
        TAG_INSTRUCTIONS,
        `<kennis>\n${knowledge}\n</kennis>`,
        req.context ? `<context>\n${req.context}\n</context>` : '',
        req.tekst ? `<notitie>\n${req.tekst}\n</notitie>` : 'Zie de bijgevoegde foto.',
        'Reply with only one JSON object: {"sectie": "T2".."T20"|null, "omschrijving": string, "zekerheid": "hoog"|"middel"|"laag"}',
      ]
        .filter(Boolean)
        .join('\n\n');
      const images = req.foto ? [base64ToBlob(req.foto.data, req.foto.mediaType)] : [];
      return json(prompt, (v) => TagResult.parse(v), images, 'quick');
    },
    transcribe: null,
  };
}
