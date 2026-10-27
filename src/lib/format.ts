/** Parse a number typed with a Belgian comma ("1,5") or dot ("1.5"). Empty/invalid → null. */
export function parseDecimal(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.');
  if (cleaned === '' || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Show a number back with a comma, the way it was typed in Belgium. */
export function formatDecimal(n: number | null): string {
  return n === null ? '' : String(n).replace('.', ',');
}

export function parseInteger(input: string): number | null {
  const n = parseDecimal(input);
  return n !== null && Number.isInteger(n) ? n : null;
}

/** yyyy-mm-dd → dd/mm/jjjj, the notation used in the report. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' });
}
