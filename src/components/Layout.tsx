import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useOnline } from '../lib/hooks';

interface Props {
  title: string;
  subtitle?: string;
  /** Where the back arrow goes. Omit on the home screen. */
  back?: string;
  children: ReactNode;
  /** Sticky bar at the bottom (thumb zone) for the main actions. */
  bottom?: ReactNode;
}

export function Layout({ title, subtitle, back, children, bottom }: Props) {
  const online = useOnline();
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-brand px-2 pt-[env(safe-area-inset-top)] text-white shadow">
        {back ? (
          <Link
            to={back}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-3xl"
            aria-label="Terug"
          >
            ‹
          </Link>
        ) : (
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center text-2xl"
            aria-hidden
          >
            🧭
          </span>
        )}
        <div className="min-w-0 flex-1 py-2">
          <h1 className="truncate text-xl leading-tight font-bold">{title}</h1>
          {subtitle && <p className="truncate text-sm text-white/85">{subtitle}</p>}
        </div>
        <span
          className={`mr-2 shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
            online ? 'bg-white/15 text-white' : 'bg-amber-300 text-gray-950'
          }`}
          title={online ? 'Online' : 'Offline — alles wordt lokaal bewaard'}
        >
          {online ? 'online' : 'offline'}
        </span>
      </header>
      <main className="flex-1 px-4 pt-4 pb-6">{children}</main>
      {bottom && (
        <div className="sticky bottom-0 z-20 border-t border-gray-300 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {bottom}
        </div>
      )}
    </div>
  );
}
