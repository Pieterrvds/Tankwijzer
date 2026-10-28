import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: string }[];
}

export interface Mailer {
  /** false when the mail was only logged (no email service configured). */
  readonly delivers: boolean;
  send(mail: Mail): Promise<void>;
}

/** Local development: writes every email to the outbox folder (and keeps it in memory for tests). */
export class OutboxMailer implements Mailer {
  /** The developer reads the outbox, so login links do arrive. */
  readonly delivers = true;
  readonly sent: Mail[] = [];
  constructor(private readonly dir: string | null) {
    if (dir) mkdirSync(dir, { recursive: true });
  }

  async send(mail: Mail): Promise<void> {
    this.sent.push(mail);
    if (!this.dir) return;
    const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
    const body = [`To: ${mail.to}`, `Subject: ${mail.subject}`, "", mail.text].join("\n");
    writeFileSync(join(this.dir, `${id}.txt`), body);
    for (const a of mail.attachments ?? []) writeFileSync(join(this.dir, `${id}-${a.filename}`), a.content);
    console.log(`[mail] → ${mail.to}: ${mail.subject}`);
  }
}

/** No email service configured (e.g. a first Netlify deploy): only logs who would get what. */
export class LogMailer implements Mailer {
  readonly delivers = false;
  async send(mail: Mail): Promise<void> {
    console.log(`[mail niet verstuurd — geen e-maildienst ingesteld] → ${mail.to}: ${mail.subject}`);
  }
}

function parseSender(from: string): { name?: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1] || undefined, email: m[2]! } : { email: from.trim() };
}

/** Brevo (EU-based email service) transactional API. Set BREVO_API_KEY and MAIL_FROM. */
export class BrevoMailer implements Mailer {
  readonly delivers = true;
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(mail: Mail): Promise<void> {
    const res = await this.fetchImpl("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": this.apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: parseSender(this.from),
        to: [{ email: mail.to }],
        subject: mail.subject,
        textContent: mail.text,
        ...(mail.attachments?.length && {
          attachment: mail.attachments.map((a) => ({
            name: a.filename,
            content: Buffer.from(a.content).toString("base64"),
          })),
        }),
      }),
    });
    if (!res.ok) throw new Error(`E-mail versturen mislukt (${res.status}): ${await res.text()}`);
  }
}

/** Picks the email service from the environment. */
export function mailerFromEnv(env: Record<string, string | undefined>, from: string): Mailer {
  return env.BREVO_API_KEY ? new BrevoMailer(env.BREVO_API_KEY, from) : new LogMailer();
}
