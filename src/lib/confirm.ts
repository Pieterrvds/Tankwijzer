/**
 * In-app confirmation instead of window.confirm(): the native dialog is blocked in some
 * embedded views (and looks out of place in an installed app). `ConfirmHost` renders it.
 */
export interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
}

let show: ((request: ConfirmRequest) => void) | null = null;

export function registerConfirmHost(fn: typeof show): void {
  show = fn;
}

/** Resolves true when the inspector confirms. Resolves false when no host is mounted. */
export function askConfirm(message: string, confirmLabel = 'Verwijderen'): Promise<boolean> {
  return new Promise((resolve) => {
    if (show) show({ message, confirmLabel, resolve });
    else resolve(false);
  });
}
