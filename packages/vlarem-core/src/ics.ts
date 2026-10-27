import type { DeadlineItem } from "./deadlines.ts";
import { addDays } from "./dates.ts";

/** RFC 5545 calendar export of deadlines (all-day events with reminders 3 months and 1 month before). */

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets as required by RFC 5545. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentLen = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (currentLen + len > limit) {
      parts.push(current);
      current = "";
      currentLen = 0;
    }
    current += ch;
    currentLen += len;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const compact = (iso: string) => iso.replace(/-/g, "");

export interface IcsOptions {
  calendarName: string;
  /** Label per tank id, e.g. "T1 — Site Gent". */
  tankLabels: Record<string, string>;
  /** Timestamp for DTSTAMP, e.g. new Date().toISOString(). */
  now: string;
}

export function deadlinesToIcs(items: DeadlineItem[], opts: IcsOptions): string {
  const stamp = opts.now.replace(/[-:]/g, "").replace(/\.\d+/, "").replace(/Z?$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tankwijzer//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.calendarName)}`,
  ];
  for (const item of items) {
    if (!item.dueDate) continue;
    const tank = opts.tankLabels[item.tankId] ?? item.tankId;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.id.replace(/[^A-Za-z0-9:-]/g, "")}@tankwijzer`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(item.dueDate)}`,
      `DTEND;VALUE=DATE:${compact(addDays(item.dueDate, 1))}`,
      `SUMMARY:${escapeText(`${tank}: ${item.title_nl}`)}`,
      `DESCRIPTION:${escapeText(`${item.basis_nl}\nRegel: ${item.ruleId}\nTankwijzer vervangt geen keuring door een erkend milieudeskundige.`)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(item.title_nl)}`,
      "TRIGGER:-P90D",
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(item.title_nl)}`,
      "TRIGGER:-P30D",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
