import { describe, expect, it } from 'vitest';
import { findBrandNames } from './brands';

describe('brand blocklist', () => {
  it('finds whole-word brand names, case-insensitive', () => {
    expect(findBrandNames('Lekdetectie van Afriso geplaatst', ['Afriso'])).toEqual(['Afriso']);
    expect(findBrandNames('schütz ibc', ['Schütz'])).toEqual(['Schütz']);
  });

  it('does not match inside other words', () => {
    expect(findBrandNames('Rothschild', ['Roth'])).toEqual([]);
  });
});
