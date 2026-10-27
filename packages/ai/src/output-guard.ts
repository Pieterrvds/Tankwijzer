import { checkOwnerText, redactBrands } from "@tankwijzer/vlarem-core";

/**
 * Last line of defence on generated owner-facing text:
 * - brand names are redacted (independence of the inspection body);
 * - sentences claiming conformity are replaced (Tankwijzer is not an inspection).
 * Returns the cleaned text and what was changed, for the AI log.
 */
export function guardOwnerText(text: string): { text: string; flags: string[] } {
  const flags: string[] = [];
  const check = checkOwnerText(text);
  let out = text;
  if (check.brands.length) {
    flags.push(`brands:${check.brands.join(",")}`);
    out = redactBrands(out);
  }
  if (check.claims.length) {
    flags.push(`claims:${check.claims.length}`);
    out = out
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => (checkOwnerText(sentence).claims.length ? "Laat dit nakijken door uw milieudeskundige." : sentence))
      .join(" ");
  }
  return { text: out, flags };
}
