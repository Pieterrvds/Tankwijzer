/**
 * Small shared UI building blocks. Every control is at least 48 px high (glove-friendly),
 * labels are always visible (no placeholder-only inputs), and contrast is high for sunlight.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'bg-brand text-white active:bg-brand-light',
    secondary: 'border-2 border-gray-900 bg-white text-gray-950 active:bg-gray-100',
    danger: 'border-2 border-nok bg-white text-nok active:bg-red-50',
  }[variant];
  return (
    <button
      type="button"
      className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-4 text-lg font-semibold disabled:opacity-40 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border-2 border-gray-200 bg-white p-4 ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-6 mb-2 text-sm font-bold tracking-wide text-gray-600 uppercase">
      {children}
    </h2>
  );
}

export function TextField({
  label,
  value,
  onChange,
  inputMode,
  placeholder,
  type = 'text',
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: 'text' | 'numeric' | 'decimal';
  placeholder?: string;
  type?: 'text' | 'date';
  error?: string | null;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block font-semibold">{label}</span>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`h-14 w-full rounded-xl border-2 bg-white px-3 text-lg ${
          error ? 'border-nok' : 'border-gray-400'
        }`}
      />
      {error && <span className="mt-1 block text-sm font-semibold text-nok">{error}</span>}
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block font-semibold">{label}</span>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border-2 border-gray-400 bg-white p-3 text-lg"
      />
    </label>
  );
}

/** Big segmented buttons for a single choice. Tapping the active option clears it. */
export function ChoiceField<T extends string>({
  label,
  options,
  value,
  onChange,
  allowClear = true,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  allowClear?: boolean;
}) {
  return (
    <fieldset className="mb-3">
      <legend className="mb-1 font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active && allowClear ? null : o.value)}
              className={`min-h-12 rounded-xl border-2 px-4 text-base font-semibold ${
                active
                  ? 'border-brand bg-brand text-white'
                  : 'border-gray-400 bg-white text-gray-950 active:bg-gray-100'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Ja / Nee / ? — `null` means "not known yet", which is different from "nee". */
export function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <ChoiceField
      label={label}
      options={[
        { value: 'ja', label: 'Ja' },
        { value: 'nee', label: 'Nee' },
      ]}
      value={value === null ? null : value ? 'ja' : 'nee'}
      onChange={(v) => onChange(v === null ? null : v === 'ja')}
    />
  );
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div className="h-full bg-ok" style={{ width: `${pct}%` }} />
    </div>
  );
}
