import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";

/** Uploaded files on local disk, one folder per company. Paths stored in the DB are relative. */
export class FileStorage {
  constructor(private readonly root: string) {
    mkdirSync(root, { recursive: true });
  }

  private abs(rel: string): string {
    const p = resolve(this.root, rel);
    if (!p.startsWith(resolve(this.root) + sep)) throw new Error("Invalid storage path");
    return p;
  }

  save(companyId: string, id: string, data: Uint8Array): string {
    const rel = join(companyId, id);
    mkdirSync(this.abs(companyId), { recursive: true });
    writeFileSync(this.abs(rel), data);
    return rel;
  }

  read(rel: string): Buffer {
    return readFileSync(this.abs(rel));
  }

  remove(rel: string): void {
    const p = this.abs(rel);
    if (existsSync(p)) rmSync(p);
  }

  removeCompany(companyId: string): void {
    rmSync(this.abs(companyId), { recursive: true, force: true });
  }
}
