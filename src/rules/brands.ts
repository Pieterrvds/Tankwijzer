/**
 * Independence rule: proposed texts must never mention brands, products or suppliers.
 * `findBrandNames` is applied to every rule output (and later to AI output, M4/M5);
 * a text containing a blocked name is not proposed.
 */
import blocklist from '../../knowledge/brand-blocklist.json';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word, case-insensitive. Unicode-aware so "Schütz" matches but "Rothschild" does not. */
function brandPattern(brand: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(brand)}(?![\\p{L}\\p{N}])`, 'iu');
}

export function findBrandNames(text: string, brands: string[] = blocklist.brands): string[] {
  return brands.filter((b) => brandPattern(b).test(text));
}
