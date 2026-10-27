import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderRulesDoc } from './doc';
import { RULES } from './engine';

describe('docs/rules.md', () => {
  it('is up to date with knowledge/rules (run `npm run docs:rules`)', () => {
    const committed = readFileSync(new URL('../../docs/rules.md', import.meta.url), 'utf8');
    expect(committed).toBe(renderRulesDoc(RULES));
  });
});
