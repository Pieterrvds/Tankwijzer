import type { ReactNode } from 'react';

/** Bottom sheet: thumb-reachable, full width on phones. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
      role="dialog"
      aria-modal
      aria-label={title}
    >
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-xl px-4 font-semibold"
            aria-label="Sluiten"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
