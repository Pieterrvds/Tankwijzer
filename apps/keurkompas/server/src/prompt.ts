/**
 * Builds the requests to Claude. Pure functions, so they can be tested without calling the API.
 *
 * Caching: the instructions + knowledge (system) and the previous report (first user block)
 * are the same for every question during a visit, so they are marked for prompt caching;
 * everything that changes per question comes after them.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { AskRequest, ExtractRequest, Lesson, TagRequest } from '../../src/ai/schemas';
import {
  ASSISTANT_INSTRUCTIONS,
  EXTRACT_INSTRUCTIONS,
  TAG_INSTRUCTIONS,
} from '../../src/ai/instructions';
import { KNOWLEDGE } from './knowledge.generated';

type SystemBlock = Anthropic.Beta.BetaTextBlockParam;
type ContentBlock = Anthropic.Beta.BetaContentBlockParam;

/** The cached system prefix: instructions + knowledge. Identical for every request. */
function systemBlocks(instructions: string): SystemBlock[] {
  return [
    { type: 'text', text: instructions },
    {
      type: 'text',
      text: `<kennis>\n${KNOWLEDGE}\n</kennis>`,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

export function renderLessons(lessen: Lesson[]): string {
  if (lessen.length === 0) return '';
  const items = lessen
    .map(
      (l, n) =>
        `<les nr="${n + 1}">\nVraag: ${l.vraag}\nEerder (fout) antwoord: ${l.fout_antwoord}\nCorrectie van de keurder: ${l.correctie}\n</les>`,
    )
    .join('\n');
  return `<lessen>\n${items}\n</lessen>`;
}

export function buildAskRequest(req: AskRequest) {
  const system = systemBlocks(ASSISTANT_INSTRUCTIONS);
  const lessen = renderLessons(req.lessen);
  if (lessen) system.push({ type: 'text', text: lessen });

  const content: ContentBlock[] = [];
  if (req.vorigVerslag.trim()) {
    content.push({
      type: 'text',
      text: `<vorig_verslag>\n${req.vorigVerslag}\n</vorig_verslag>`,
      cache_control: { type: 'ephemeral' },
    });
  }

  const visit = [
    `<bezoek klant="${req.bezoek.klant}" datum="${req.bezoek.datum}" tank="${req.bezoek.tank}" />`,
  ];
  if (req.notities.length) {
    visit.push(
      `<notities>\n${req.notities.map((n) => `[${n.label}, ${n.tijd}] ${n.tekst}`).join('\n')}\n</notities>`,
    );
  }
  if (req.eerdereVragen.length) {
    visit.push(
      `<eerdere_vragen>\n${req.eerdereVragen.map((q) => `V: ${q.vraag}\nA: ${q.antwoord}`).join('\n\n')}\n</eerdere_vragen>`,
    );
  }
  content.push({ type: 'text', text: visit.join('\n') });

  for (const foto of req.fotos) {
    content.push({ type: 'text', text: `Foto: ${foto.label}` });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: foto.mediaType, data: foto.data },
    });
  }
  content.push({ type: 'text', text: `<vraag>\n${req.vraag}\n</vraag>` });

  return { system, content };
}

export function buildExtractRequest(req: ExtractRequest) {
  return {
    system: systemBlocks(EXTRACT_INSTRUCTIONS),
    content: [
      { type: 'text', text: `<vorig_verslag>\n${req.vorigVerslag}\n</vorig_verslag>` },
    ] satisfies ContentBlock[],
  };
}

export function buildTagRequest(req: TagRequest) {
  const content: ContentBlock[] = [];
  if (req.context) content.push({ type: 'text', text: `<context>\n${req.context}\n</context>` });
  if (req.foto) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: req.foto.mediaType, data: req.foto.data },
    });
  }
  if (req.tekst) content.push({ type: 'text', text: `<notitie>\n${req.tekst}\n</notitie>` });
  content.push({
    type: 'text',
    text: req.foto ? 'In welke sectie hoort deze foto?' : 'In welke sectie hoort deze notitie?',
  });
  return { system: systemBlocks(TAG_INSTRUCTIONS), content };
}
