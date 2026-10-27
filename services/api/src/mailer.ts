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
  send(mail: Mail): Promise<void>;
}

/**
 * v1 mailer: writes every email to the outbox folder and logs it. Swap for an SMTP or
 * EU-hosted email API implementation without touching the routes.
 */
export class OutboxMailer implements Mailer {
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
