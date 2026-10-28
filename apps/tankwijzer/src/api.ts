import type {
  Company,
  DeadlineItem,
  DocumentCheck,
  Site,
  Tank,
  TankEvaluation,
  VaultDocument,
} from "@tankwijzer/vlarem-core";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body !== undefined && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) throw new ApiError(data?.error ?? `Fout ${res.status}`, res.status);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};

export interface Me {
  user: { id: string; email: string };
  company: Company | null;
  limits: { plan: string; tankLimit: number | null; tankCount: number } | null;
  aiEnabled: boolean;
  /** Test mode: login without email check — never for real customer data. */
  testMode: boolean;
  uploadLimitBytes: number;
}

export interface TankSummary {
  tank: Tank;
  site: Site | null;
  latestSticker: "green" | "orange" | "red" | null;
  nextDeadline: DeadlineItem | null;
  counts: { attention: number; unknown: number; missingDocuments: number };
}

export interface TankDetail extends TankSummary {
  evaluation: TankEvaluation;
}

export interface DocumentsResponse {
  documents: VaultDocument[];
  checklist: { tankId: string; label: string; documents: DocumentCheck[] }[];
}

export interface PrecheckPoint {
  ruleId: string;
  article: string;
  status: "likely_ok" | "possible_attention" | "cannot_assess";
  observation_nl: string;
  requirement_nl: string;
}

export interface PrecheckResult {
  photoQuality: "ok" | "retake";
  retakeReason: string | null;
  points: PrecheckPoint[];
}

export interface AskResponse {
  logId: string;
  answer_nl: string;
  covered: boolean;
  citations: { type: string; id: string; label: string }[];
  rulesetVersion: string;
  disclaimer: string;
}

export const sendFeedback = (logId: string, rating: 1 | -1) => api.post("/ai/feedback", { logId, rating });

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
