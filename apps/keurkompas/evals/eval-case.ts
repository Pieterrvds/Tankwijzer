/** Shape and checks of an eval case (see evals/README.md). Pure, so it is unit-tested. */
import { z } from 'zod/v4';
import type { Answer } from '../src/ai/schemas';

export const EvalCase = z.object({
  id: z.string(),
  vraag: z.string(),
  vorigVerslag: z.string(),
  notities: z.array(z.string()),
  verwacht: z.object({
    bevat: z.array(z.string()).optional(),
    bevat_niet: z.array(z.string()).optional(),
    zekerheid_in: z.array(z.enum(['hoog', 'middel', 'laag'])).optional(),
    bron_in: z.array(z.string()).optional(),
  }),
});
export type EvalCase = z.infer<typeof EvalCase>;

/** Returns the failed checks (empty = pass). Text checks look at answer + proposal + citations. */
export function checkAnswer(c: EvalCase, a: Answer): string[] {
  const text = [
    a.antwoord,
    a.voorstel_tekst?.tekst ?? '',
    ...a.bronnen.map((b) => `${b.referentie} ${b.citaat}`),
  ]
    .join('\n')
    .toLowerCase();
  const fails: string[] = [];
  for (const s of c.verwacht.bevat ?? [])
    if (!text.includes(s.toLowerCase())) fails.push(`mist “${s}”`);
  for (const s of c.verwacht.bevat_niet ?? [])
    if (text.includes(s.toLowerCase())) fails.push(`bevat “${s}”`);
  if (c.verwacht.zekerheid_in && !c.verwacht.zekerheid_in.includes(a.zekerheid))
    fails.push(`zekerheid ${a.zekerheid}, verwacht ${c.verwacht.zekerheid_in.join('/')}`);
  if (c.verwacht.bron_in && !a.bronnen.some((b) => c.verwacht.bron_in!.includes(b.bron)))
    fails.push(`geen bron van type ${c.verwacht.bron_in.join('/')}`);
  return fails;
}
