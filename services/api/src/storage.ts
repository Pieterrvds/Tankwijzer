import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

/** Uploaded files (documents, photos). Paths stored in the DB are relative: `<companyId>/<id>`. */
export interface Storage {
  save(companyId: string, id: string, data: Uint8Array): Promise<string>;
  read(path: string): Promise<Uint8Array>;
  remove(path: string): Promise<void>;
  removeCompany(companyId: string): Promise<void>;
}

/** Local disk, one folder per company: for local development and tests. */
export class FileStorage implements Storage {
  constructor(private readonly root: string) {
    mkdirSync(root, { recursive: true });
  }

  private abs(rel: string): string {
    const p = resolve(this.root, rel);
    if (!p.startsWith(resolve(this.root) + sep)) throw new Error("Invalid storage path");
    return p;
  }

  async save(companyId: string, id: string, data: Uint8Array): Promise<string> {
    const rel = join(companyId, id);
    mkdirSync(this.abs(companyId), { recursive: true });
    writeFileSync(this.abs(rel), data);
    return rel;
  }

  async read(rel: string): Promise<Uint8Array> {
    return new Uint8Array(readFileSync(this.abs(rel)));
  }

  async remove(rel: string): Promise<void> {
    const p = this.abs(rel);
    if (existsSync(p)) rmSync(p);
  }

  async removeCompany(companyId: string): Promise<void> {
    rmSync(this.abs(companyId), { recursive: true, force: true });
  }
}

/** The part of a Netlify Blobs store we use (see ./netlify.ts). */
export interface BlobStore {
  set(key: string, data: ArrayBuffer): Promise<unknown>;
  get(key: string, opts: { type: "arrayBuffer" }): Promise<ArrayBuffer | null>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string }): Promise<{ blobs: { key: string }[] }>;
}

/** Netlify Blobs: object storage that works inside Netlify Functions without setup. */
export class BlobStorage implements Storage {
  constructor(private readonly store: BlobStore) {}

  private static check(key: string): string {
    if (key.includes("..") || key.startsWith("/")) throw new Error("Invalid storage path");
    return key;
  }

  async save(companyId: string, id: string, data: Uint8Array): Promise<string> {
    const key = BlobStorage.check(`${companyId}/${id}`);
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    await this.store.set(key, copy.buffer);
    return key;
  }

  async read(key: string): Promise<Uint8Array> {
    const buf = await this.store.get(BlobStorage.check(key), { type: "arrayBuffer" });
    if (!buf) throw new Error("File not found");
    return new Uint8Array(buf);
  }

  async remove(key: string): Promise<void> {
    await this.store.delete(BlobStorage.check(key));
  }

  async removeCompany(companyId: string): Promise<void> {
    const { blobs } = await this.store.list({ prefix: `${BlobStorage.check(companyId)}/` });
    for (const b of blobs) await this.store.delete(b.key);
  }
}
