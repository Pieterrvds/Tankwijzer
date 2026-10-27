import type { DeadlineItem } from "./deadlines.ts";
import { addMonths, compareIso } from "./dates.ts";

/** Email reminders 3 months and 1 month before each deadline. */
export const REMINDER_OFFSETS_MONTHS = [3, 1] as const;

export interface ReminderDue {
  item: DeadlineItem;
  offsetMonths: number;
  /** Stable key so the same reminder is never sent twice. */
  key: string;
}

/**
 * Reminders whose send date has arrived and whose deadline has not passed yet.
 * When both are due (e.g. a tank added late), only the closest one is returned.
 */
export function remindersDue(items: DeadlineItem[], today: string): ReminderDue[] {
  const out: ReminderDue[] = [];
  for (const item of items) {
    if (!item.dueDate || compareIso(today, item.dueDate) > 0) continue;
    const due = REMINDER_OFFSETS_MONTHS.filter((m) => compareIso(addMonths(item.dueDate!, -m), today) <= 0);
    if (due.length === 0) continue;
    const offset = Math.min(...due);
    out.push({ item, offsetMonths: offset, key: `${item.id}:${item.dueDate}:-${offset}m` });
  }
  return out;
}
