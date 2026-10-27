import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderKnowledgeBundle } from './knowledge-bundle';

describe('server knowledge bundle', () => {
  it('is up to date with knowledge/ (run `npm run knowledge:bundle`)', () => {
    const committed = readFileSync(
      new URL('../../server/src/knowledge.generated.ts', import.meta.url),
      'utf8',
    );
    const { text, vocabulary } = renderKnowledgeBundle();
    expect(committed).toContain(`export const KNOWLEDGE = ${JSON.stringify(text)};`);
    expect(committed).toContain(
      `export const VOCABULARY: string[] = ${JSON.stringify(vocabulary)};`,
    );
  });

  it('contains the standard sentences verbatim and every rule id', () => {
    const { text } = renderKnowledgeBundle();
    expect(text).toContain(
      'Een lekdetectiesysteem conform bijlage 5.17.3 dient geplaatst te worden',
    );
    expect(text).toContain('[lospiste.nok]');
  });
});
