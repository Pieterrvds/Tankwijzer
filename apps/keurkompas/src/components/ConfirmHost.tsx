import { useEffect, useState } from 'react';
import { registerConfirmHost, type ConfirmRequest } from '../lib/confirm';

/** Renders the dialog for `askConfirm()`. Mounted once in App. */
export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    registerConfirmHost(setRequest);
    return () => registerConfirmHost(null);
  }, []);

  if (!request) return null;
  const close = (ok: boolean) => {
    request.resolve(ok);
    setRequest(null);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="alertdialog"
      aria-modal
      aria-labelledby="confirm-message"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl">
        <p id="confirm-message" className="mb-5 text-lg font-semibold">
          {request.message}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => close(false)}
            className="min-h-14 rounded-xl border-2 border-gray-900 text-lg font-semibold"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className="min-h-14 rounded-xl bg-nok text-lg font-semibold text-white"
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
