import { remindersDue } from "@tankwijzer/vlarem-core";
import { all, get, run } from "./db.ts";
import { listDocuments, listSites, listTanks } from "./repo.ts";
import type { Deps } from "./context.ts";
import { evaluate } from "./routes/tanks.ts";

/** Sends due reminders to every member of every company; each reminder is sent once. */
export async function sendReminders(deps: Deps): Promise<number> {
  const today = deps.today();
  let sent = 0;
  for (const { id: companyId } of await all<{ id: string }>(deps.db, "SELECT id FROM companies")) {
    const sites = await listSites(deps.db, companyId);
    const docs = await listDocuments(deps.db, companyId);
    const tanks = await listTanks(deps.db, companyId);
    const due = tanks.flatMap((t) =>
      remindersDue(evaluate(deps, t, sites, docs).deadlines, today).map((r) => ({ ...r, tank: t })),
    );
    const fresh = [];
    for (const r of due) {
      if (!(await get(deps.db, "SELECT 1 FROM reminders_sent WHERE key = ?", r.key))) fresh.push(r);
    }
    if (fresh.length === 0) continue;

    const emails = await all<{ email: string }>(
      deps.db,
      "SELECT u.email FROM company_members m JOIN owner_users u ON u.id = m.user_id WHERE m.company_id = ?",
      companyId,
    );
    const lines = fresh.map(
      (r) => `- ${r.tank.label}: ${r.item.title_nl} — uiterlijk ${r.item.dueDate} (over ongeveer ${r.offsetMonths} maand${r.offsetMonths > 1 ? "en" : ""})`,
    );
    for (const { email } of emails) {
      await deps.mailer.send({
        to: email,
        subject: `Tankwijzer: ${fresh.length} deadline(s) komen eraan`,
        text: [
          "Goedendag,",
          "",
          "Deze deadlines voor uw tanks komen eraan:",
          ...lines,
          "",
          deps.config.appUrl
            ? `Plan uw keuring via ${deps.config.appUrl}/keuring-aanvragen`
            : "Plan uw keuring in Tankwijzer onder 'Keuring aanvragen'.",
          "",
          "Tankwijzer vervangt geen keuring door een erkend milieudeskundige.",
        ].join("\n"),
      });
    }
    for (const r of fresh) {
      await run(
        deps.db,
        "INSERT INTO reminders_sent (key, company_id, sent_at) VALUES (?, ?, ?)",
        r.key,
        companyId,
        new Date().toISOString(),
      );
    }
    sent += fresh.length;
  }
  return sent;
}
