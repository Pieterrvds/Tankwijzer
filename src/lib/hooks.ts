import { useEffect, useRef, useState } from 'react';

/** Object URL for a Blob, revoked automatically when the blob changes or on unmount. */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return blob ? url : undefined;
}

/** Tracks navigator.onLine. Offline is the normal case on site, so this is informational. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/**
 * Autosave: calls `save(value)` 500 ms after the last change, and immediately when the
 * component unmounts (e.g. the inspector taps "back"), so typing is never lost.
 */
export function useAutosave<T>(value: T, save: (value: T) => Promise<unknown>, delayMs = 500) {
  const saveRef = useRef(save);
  saveRef.current = save;
  const pending = useRef<{ value: T } | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pending.current = { value };
    const t = setTimeout(() => {
      if (pending.current) void saveRef.current(pending.current.value);
      pending.current = null;
    }, delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  useEffect(
    () => () => {
      if (pending.current) void saveRef.current(pending.current.value);
    },
    [],
  );
}
