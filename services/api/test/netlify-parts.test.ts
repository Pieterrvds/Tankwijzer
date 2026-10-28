import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ClaudeClient } from "@tankwijzer/ai";
import { createApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { SCHEMA } from "../src/db.ts";
import { toPgPlaceholders } from "../src/db-pg.ts";
import { openSqlite } from "../src/db-sqlite.ts";
import { BrevoMailer, LogMailer } from "../src/mailer.ts";
import { BlobStorage, FileStorage, type BlobStore } from "../src/storage.ts";

class MemoryBlobStore implements BlobStore {
  readonly data = new Map<string, ArrayBuffer>();
  async set(key: string, data: ArrayBuffer) {
    this.data.set(key, data);
  }
  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async delete(key: string) {
    this.data.delete(key);
  }
  async list({ prefix }: { prefix: string }) {
    return { blobs: [...this.data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
  }
}

describe("Netlify Database migration", () => {
  it("is the same schema the app uses locally", () => {
    const migration = readFileSync(new URL("../../../netlify/database/migrations/0001_initial.sql", import.meta.url), "utf8");
    expect(migration.replace(/^--.*\n/, "")).toBe(SCHEMA);
  });

  it("rewrites placeholders for Postgres", () => {
    expect(toPgPlaceholders("SELECT * FROM t WHERE a = ? AND b = ?")).toBe("SELECT * FROM t WHERE a = $1 AND b = $2");
  });
});

describe("Netlify Blobs storage", () => {
  it("saves, reads and deletes per company", async () => {
    const store = new MemoryBlobStore();
    const storage = new BlobStorage(store);
    const key = await storage.save("cmp_a", "doc_1", new Uint8Array([1, 2, 3]));
    await storage.save("cmp_b", "doc_2", new Uint8Array([4]));
    expect(key).toBe("cmp_a/doc_1");
    expect([...(await storage.read(key))]).toEqual([1, 2, 3]);
    await storage.removeCompany("cmp_a");
    expect([...store.data.keys()]).toEqual(["cmp_b/doc_2"]);
  });

  it("rejects paths outside a company folder", async () => {
    await expect(new BlobStorage(new MemoryBlobStore()).read("../x")).rejects.toThrow();
  });
});

describe("email", () => {
  it("sends through the Brevo API", async () => {
    const calls: { url: string; body: any; key: string }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)), key: (init.headers as Record<string, string>)["api-key"]! });
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;
    await new BrevoMailer("key-123", "Tankwijzer <noreply@voorbeeld.be>", fakeFetch).send({
      to: "jan@bedrijf.be",
      subject: "Test",
      text: "Hallo",
      attachments: [{ filename: "dossier.json", content: "{}" }],
    });
    expect(calls[0]!.url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(calls[0]!.key).toBe("key-123");
    expect(calls[0]!.body.sender).toEqual({ name: "Tankwijzer", email: "noreply@voorbeeld.be" });
    expect(calls[0]!.body.attachment[0].content).toBe(Buffer.from("{}").toString("base64"));
  });

  it("refuses to hand out login links when no email service and no test mode", async () => {
    const app = createApp({
      db: openSqlite(":memory:"),
      config: loadConfig({ DATA_DIR: "/tmp/tw-unused" }),
      mailer: new LogMailer(),
      ai: new ClaudeClient(null),
      storage: new FileStorage("/tmp/tw-unused/uploads"),
      today: () => "2026-10-28",
    });
    const res = await app.request("http://tankwijzer.test/api/auth/request-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.be" }),
    });
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toContain("e-maildienst");
  });
});
