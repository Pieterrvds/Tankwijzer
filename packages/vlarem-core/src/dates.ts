/** Small date helpers on ISO dates (YYYY-MM-DD), computed in UTC so results never shift by a day. */

export function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number): string {
  const d = toDate(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // Clamp to the last day of the target month (31 Aug + 6 months = 28/29 Feb).
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return toIso(d);
}

export function addYears(iso: string, years: number): string {
  // Fractional years (e.g. 75 % of a 30-year lifespan = 22.5) are rounded down to whole months.
  return addMonths(iso, Math.floor(years * 12));
}

export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function yearsBetween(fromIso: string, toIsoDate: string): number {
  const ms = toDate(toIsoDate).getTime() - toDate(fromIso).getTime();
  return ms / (365.2425 * 24 * 3600 * 1000);
}

export function todayIso(): string {
  return toIso(new Date());
}

/** Belgian notation (DD/MM/YYYY) for dates inside Dutch sentences. */
export function formatDateNl(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
