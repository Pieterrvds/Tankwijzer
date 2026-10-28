/**
 * Renders the knowledge the assistant receives with every question: domain context, the BEPO
 * sections, standard sentences (verbatim), the rules, corrections policy and the VLAREM texts the
 * inspector added to knowledge/text. Uses Vite's import.meta.glob, so it runs at build time
 * (vite-node / Vitest), never on the server itself.
 */
import { BEPO_BOVENGRONDS } from '../checklist/bepo-bovengronds';
import { describeCondition } from '../rules/describe';
import { RULES, STANDARD_SENTENCES } from '../rules/engine';
import vocabularyJson from '../../knowledge/vocabulary.json';
import contextMd from '../../knowledge/context.md?raw';
import lessonsMd from '../../knowledge/lessons.md?raw';

const VLAREM_TEXTS = import.meta.glob<string>('../../knowledge/text/*.{md,txt}', {
  eager: true,
  query: '?raw',
  import: 'default',
});

export function renderKnowledgeBundle(): { text: string; vocabulary: string[] } {
  const sections = BEPO_BOVENGRONDS.sections
    .map((s) => `- ${s.code} ${s.title}: ${s.items.map((i) => i.label).join('; ')}`)
    .concat('- T20 Resultaat: tekortkomingen, opmerkingen, informatie, klever')
    .join('\n');

  const sentences = Object.entries(STANDARD_SENTENCES)
    .map(
      ([id, s]) => `- [${id}] (${s.section}, ${s.severity ?? 'soort te bevestigen'}) ${s.text_nl}`,
    )
    .join('\n');

  const rules = RULES.map((r) => {
    const text = r.standard_sentence ? `standaardzin [${r.standard_sentence}]` : `“${r.text_nl}”`;
    const result = r.suggest_status ? `voorstel ${r.suggest_status}` : r.severity;
    const geldig = r.valid_until ? ` (geldig t.e.m. ${r.valid_until})` : '';
    const status = r.verified_by_user
      ? 'bevestigd door keurder'
      : 'nog niet bevestigd door keurder';
    return `- [${r.id}] ${r.section} — als ${describeCondition(r.trigger)} → ${result}: ${text}; artikel: ${r.article}${geldig}; ${status}`;
  }).join('\n');

  const texts = Object.entries(VLAREM_TEXTS)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([path, content]) =>
        `<document bron="${path.split('/').pop()}">\n${content.trim()}\n</document>`,
    );

  const text = [
    contextMd.trim(),
    '## BEPO sections (T-codes)\n\n' + sections,
    '## Standard sentences (use verbatim)\n\n' + sentences,
    '## Rules (deterministic; cite by id)\n\n' + rules,
    '## Approved lessons (from the inspector, permanent)\n\n' +
      lessonsMd.replace(/^#.*\n/, '').trim(),
    '## VLAREM II source texts\n\n' +
      (texts.length
        ? texts.join('\n\n')
        : 'No official VLAREM text has been added yet. Article numbers in the rules and standard sentences above are the only legal references available. For anything they do not cover, answer "Niet zeker — controleer ter plaatse."'),
  ].join('\n\n');

  return { text, vocabulary: vocabularyJson.words.slice(0, 100) };
}
