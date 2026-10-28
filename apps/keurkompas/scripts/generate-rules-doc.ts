/** Writes docs/rules.md. Run with `npm run docs:rules`. */
import { writeFileSync } from 'node:fs';
import { renderRulesDoc } from '../src/rules/doc';
import { OWNER_ONLY_RULES, RULES } from '../src/rules/engine';

writeFileSync(
  new URL('../docs/rules.md', import.meta.url),
  renderRulesDoc(RULES, OWNER_ONLY_RULES),
);
console.log(
  `docs/rules.md: ${RULES.length} inspector rules, ${OWNER_ONLY_RULES.length} owner-only`,
);
