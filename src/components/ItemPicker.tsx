import { checklistFor } from '../checklist';
import type { Inspection } from '../domain/schemas';

/**
 * Native <select> grouped by T-section. On phones this opens the OS picker,
 * which is the most reliable large-target list there is.
 */
export function ItemPicker({
  inspection,
  label,
  value,
  onChange,
}: {
  inspection: Inspection;
  label: string;
  value: string | null;
  onChange: (itemId: string | null) => void;
}) {
  const checklist = checklistFor(inspection);
  return (
    <label className="block">
      <span className="mb-1 block font-semibold">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-14 w-full rounded-xl border-2 border-gray-400 bg-white px-3 text-lg"
      >
        <option value="">— Ongesorteerd —</option>
        {checklist.sections.map((s) => (
          <optgroup key={s.code} label={`${s.code} ${s.title}`}>
            {s.items.map((i) => (
              <option key={i.id} value={i.id}>
                {s.code} · {i.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
