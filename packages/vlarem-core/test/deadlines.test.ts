import { describe, expect, it } from "vitest";
import { addMonths, computeDeadlines, generalIntervalYears, limitedIntervalYears, remindersDue, deadlinesToIcs } from "../src/index.ts";
import { makeSite, makeTank } from "./fixtures.ts";

describe("dates", () => {
  it("clamps month ends", () => {
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonths("2027-08-31", 6)).toBe("2028-02-29");
  });
});

describe("intervals", () => {
  it("above ground: limited every 3 years", () => {
    expect(limitedIntervalYears(makeTank({ placement: "above_ground" }), makeSite())?.years).toBe(3);
  });

  it("underground: 2 years, yearly in protection zone, yearly when unknown (conservative)", () => {
    const t = makeTank({ placement: "underground" });
    expect(limitedIntervalYears(t, makeSite({ inWaterProtectionZone: "no" }))?.years).toBe(2);
    expect(limitedIntervalYears(t, makeSite({ inWaterProtectionZone: "yes" }))?.years).toBe(1);
    expect(limitedIntervalYears(t, makeSite())?.years).toBe(1);
  });

  it("above ground general only above 20,000 l", () => {
    expect(generalIntervalYears(makeTank({ placement: "above_ground", capacityL: 20000 }), null)).toBeNull();
    expect(generalIntervalYears(makeTank({ placement: "above_ground", capacityL: 20001 }), null)?.years).toBe(20);
  });

  it("above ground built from 2025: 75 % of lifespan or 20 years if shorter", () => {
    const t = (life: number) =>
      makeTank({ placement: "above_ground", capacityL: 30000, nameplate: { buildYear: 2025 }, expectedLifespanYears: life });
    expect(generalIntervalYears(t(20), null)?.years).toBe(15);
    expect(generalIntervalYears(t(40), null)?.years).toBe(20);
  });

  it("underground GVK is exempt from general inspection", () => {
    expect(generalIntervalYears(makeTank({ placement: "underground", material: "gvk" }), makeSite())).toBeNull();
  });

  it("underground general: 15 years, 10 in protection zone", () => {
    const t = makeTank({ placement: "underground", material: "steel" });
    expect(generalIntervalYears(t, makeSite({ inWaterProtectionZone: "no" }))?.years).toBe(15);
    expect(generalIntervalYears(t, makeSite({ inWaterProtectionZone: "yes" }))?.years).toBe(10);
  });
});

describe("computeDeadlines", () => {
  it("prefers the date on the sticker over the computed one", () => {
    const t = makeTank({
      placement: "above_ground",
      inspections: [{ date: "2025-01-01", type: "limited", sticker: "green", nextDueDate: "2027-12-01" }],
    });
    const d = computeDeadlines(t, makeSite(), "2026-10-27").find((i) => i.kind === "limited");
    expect(d?.dueDate).toBe("2027-12-01");
  });

  it("red sticker produces an overdue repair item", () => {
    const t = makeTank({ placement: "above_ground", inspections: [{ date: "2026-10-01", type: "limited", sticker: "red" }] });
    const d = computeDeadlines(t, makeSite(), "2026-10-27").find((i) => i.kind === "red_repair");
    expect(d?.overdue).toBe(true);
  });

  it("PE tank end of life after 25 years", () => {
    const t = makeTank({ material: "pe", nameplate: { buildYear: 2003 } });
    const d = computeDeadlines(t, makeSite(), "2026-10-27").find((i) => i.kind === "end_of_life");
    expect(d?.dueDate).toBe("2028-01-01");
  });
});

describe("reminders", () => {
  const t = makeTank({
    placement: "above_ground",
    inspections: [{ date: "2024-03-15", type: "limited", sticker: "green" }],
  });
  const items = computeDeadlines(t, makeSite(), "2026-10-27");

  it("nothing before 3 months", () => {
    expect(remindersDue(items, "2026-12-14").filter((r) => r.item.kind === "limited")).toHaveLength(0);
  });
  it("3-month reminder", () => {
    const r = remindersDue(items, "2026-12-15").find((x) => x.item.kind === "limited");
    expect(r?.offsetMonths).toBe(3);
  });
  it("1-month reminder replaces the 3-month one", () => {
    const r = remindersDue(items, "2027-02-20").find((x) => x.item.kind === "limited");
    expect(r?.offsetMonths).toBe(1);
  });
  it("nothing after the deadline", () => {
    expect(remindersDue(items, "2027-03-16").filter((r) => r.item.kind === "limited")).toHaveLength(0);
  });
});

describe("ics", () => {
  it("produces a valid calendar with folded CRLF lines", () => {
    const t = makeTank({ placement: "above_ground", inspections: [{ date: "2024-03-15", type: "limited", sticker: "green" }] });
    const ics = deadlinesToIcs(computeDeadlines(t, makeSite(), "2026-10-27"), {
      calendarName: "Tankwijzer",
      tankLabels: { t1: "T1, Hoofdsite" },
      now: "2026-10-27T10:00:00.000Z",
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20270315");
    expect(ics).toContain("SUMMARY:T1\\, Hoofdsite: Volgend beperkt onderzoek");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
