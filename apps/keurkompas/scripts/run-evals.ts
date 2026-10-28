/**
 * Runs evals/cases/*.json against Claude with the real instructions and knowledge.
 * Usage: ANTHROPIC_API_KEY=... npm run evals   (costs a few cents per case)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { createClaudeAssistant } from '../server/src/assistant';
import { checkAnswer, EvalCase } from '../evals/eval-case';

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error('Set ANTHROPIC_API_KEY first.');
  process.exit(1);
}
const assistant = createClaudeAssistant(key, process.env.CLAUDE_MODEL || undefined);
const dir = new URL('../evals/cases/', import.meta.url);
let failed = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const c = EvalCase.parse(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
  try {
    const answer = await assistant.ask({
      vraag: c.vraag,
      bezoek: { klant: 'Eval', datum: new Date().toISOString().slice(0, 10), tank: 'Eval-tank' },
      vorigVerslag: c.vorigVerslag,
      notities: c.notities.map((tekst, n) => ({ label: `notitie ${n + 1}`, tijd: '10:00', tekst })),
      fotos: [],
      eerdereVragen: [],
      lessen: [],
    });
    const fails = checkAnswer(c, answer);
    if (fails.length) failed++;
    console.log(
      `${fails.length ? '✘' : '✔'} ${c.id}${fails.length ? ` — ${fails.join('; ')}` : ''}`,
    );
    if (fails.length) console.log(`  antwoord: ${answer.antwoord}`);
  } catch (e) {
    failed++;
    console.log(`✘ ${c.id} — ${e instanceof Error ? e.message : e}`);
  }
}
console.log(failed ? `\n${failed} case(s) failed.` : '\nAll cases passed.');
process.exit(failed ? 1 : 0);
