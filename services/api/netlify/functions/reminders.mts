/** Daily email reminders (3 months and 1 month before each deadline). Runs at 06:17 UTC. */
import { runDailyReminders } from "../dist/server.mjs";

export default async () => {
  await runDailyReminders();
};

export const config = {
  schedule: "17 6 * * *",
};
