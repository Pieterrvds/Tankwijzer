import { useRegisterSW } from 'virtual:pwa-register/react';

/** Shows a one-time notice when the app is cached for offline use. Updates install silently. */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
  } = useRegisterSW();

  if (!offlineReady) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-gray-950 p-4 text-white shadow-lg"
    >
      <span className="flex-1">KeurKompas werkt nu ook zonder netwerk.</span>
      <button
        className="h-12 rounded-lg bg-white px-4 font-semibold text-gray-950"
        onClick={() => setOfflineReady(false)}
      >
        OK
      </button>
    </div>
  );
}
