import { useCallback, useEffect, useState, type ReactNode } from "react";
import { DISCLAIMER_NL, STATUS_LABELS_NL, type ObligationStatus } from "@tankwijzer/vlarem-core";
import { sendFeedback } from "../api.ts";

/** Loads data on mount and exposes a reload function. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(fn, deps);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await load());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

export function Loading() {
  return <div className="loading" aria-busy="true">Laden…</div>;
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="alert alert-error" role="alert">
      {message}
    </div>
  );
}

export function Disclaimer() {
  return <p className="disclaimer">{DISCLAIMER_NL}</p>;
}

const STATUS_CLASS: Record<string, string> = {
  likely_ok: "ok",
  attention: "warn",
  possible_attention: "warn",
  unknown: "unknown",
  cannot_assess: "unknown",
  info: "info",
};

const PRECHECK_LABELS: Record<string, string> = {
  likely_ok: "waarschijnlijk in orde",
  possible_attention: "mogelijk aandachtspunt",
  cannot_assess: "kan niet beoordelen op deze foto",
};

export function StatusBadge({ status }: { status: ObligationStatus | "possible_attention" | "cannot_assess" }) {
  const label = (STATUS_LABELS_NL as Record<string, string>)[status] ?? PRECHECK_LABELS[status] ?? status;
  return <span className={`badge badge-${STATUS_CLASS[status] ?? "info"}`}>{label}</span>;
}

const STICKER_LABEL = { green: "Groene klever", orange: "Oranje klever", red: "Rode klever" } as const;

export function StickerDot({ colour }: { colour: "green" | "orange" | "red" | null }) {
  return (
    <span className={`sticker sticker-${colour ?? "none"}`} title={colour ? STICKER_LABEL[colour] : "Geen klever bekend"}>
      <span className="sr-only">{colour ? STICKER_LABEL[colour] : "Geen klever bekend"}</span>
    </span>
  );
}

/** 👍/👎 on an AI answer; feeds the shared lessons/evals flow. */
export function Feedback({ logId }: { logId: string }) {
  const [sent, setSent] = useState<1 | -1 | null>(null);
  const send = async (r: 1 | -1) => {
    setSent(r);
    try {
      await sendFeedback(logId, r);
    } catch {
      setSent(null);
    }
  };
  return (
    <span className="feedback">
      {sent ? (
        <span className="muted">Bedankt voor uw feedback.</span>
      ) : (
        <>
          <span className="muted">Was dit nuttig?</span>
          <button type="button" className="icon-btn" onClick={() => send(1)} aria-label="Nuttig">
            👍
          </button>
          <button type="button" className="icon-btn" onClick={() => send(-1)} aria-label="Niet nuttig">
            👎
          </button>
        </>
      )}
    </span>
  );
}

export interface Choice<T extends string> {
  value: T;
  label: string;
  picture?: ReactNode;
}

/** Large tap targets with pictures: the "plain questions with pictures as answer options". */
export function ChoiceGrid<T extends string>({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: T;
  options: Choice<T>[];
  onChange: (v: T) => void;
  help?: string;
}) {
  return (
    <fieldset className="choice-group">
      <legend>{label}</legend>
      {help && <p className="help">{help}</p>}
      <div className="choices">
        {options.map((o) => (
          <label key={o.value} className={`choice ${value === o.value ? "selected" : ""}`}>
            <input type="radio" checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.picture && <span className="choice-pic">{o.picture}</span>}
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}
