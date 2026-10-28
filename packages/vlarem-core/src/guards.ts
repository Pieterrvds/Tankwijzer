import blocklist from "../knowledge/brand-blocklist.json" with { type: "json" };

/**
 * Guards on any text shown to owners (rule texts and AI output).
 *
 * 1. Independence: never name or recommend brands, products, suppliers or installers.
 * 2. Not an inspection: never claim a tank "is conform" or "will get green".
 */

/**
 * Known brand names, shared with KeurKompas (knowledge/brand-blocklist.json).
 * Matched case-insensitively on whole words. Extend the file when a new brand shows up in logs.
 */
export const BRAND_BLOCKLIST: string[] = blocklist.brands;

/** Phrases that would make Tankwijzer sound like an inspection. */
export const FORBIDDEN_CLAIMS: RegExp[] = [
  /\bis\s+(volledig\s+)?conform\b/i,
  /\bzal\s+groen\s+krijgen\b/i,
  /\bkrijgt\s+(zeker\s+)?(een\s+)?groen(e)?\b/i,
  /\bzeker\s+in\s+orde\b/i,
  /\bgoedgekeurd\s+door\s+tankwijzer\b/i,
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BRAND_REGEXES = BRAND_BLOCKLIST.map(
  (b) => [b, new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(b)}(?=$|[^\\p{L}\\p{N}])`, "iu")] as const,
);

export function findBrandMentions(text: string): string[] {
  return BRAND_REGEXES.filter(([, re]) => re.test(text)).map(([b]) => b);
}

export function findForbiddenClaims(text: string): string[] {
  return FORBIDDEN_CLAIMS.filter((re) => re.test(text)).map((re) => re.source);
}

export interface GuardResult {
  ok: boolean;
  brands: string[];
  claims: string[];
}

export function checkOwnerText(text: string): GuardResult {
  const brands = findBrandMentions(text);
  const claims = findForbiddenClaims(text);
  return { ok: brands.length === 0 && claims.length === 0, brands, claims };
}

/** Replace brand names so generated text stays usable without naming them. */
export function redactBrands(text: string): string {
  let out = text;
  for (const [, re] of BRAND_REGEXES) {
    const global = new RegExp(re.source, "giu");
    out = out.replace(global, (_m, pre: string) => `${pre}[merknaam verwijderd]`);
  }
  return out;
}

/** Shown on every check result. */
export const DISCLAIMER_NL = "Tankwijzer vervangt geen keuring door een erkend milieudeskundige.";

/** Fallback when sources do not cover a question. */
export const NOT_SURE_NL = "Dit kan ik niet met zekerheid zeggen — vraag het aan uw milieudeskundige.";
