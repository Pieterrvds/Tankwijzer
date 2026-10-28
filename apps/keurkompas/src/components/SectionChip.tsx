import { BEPO_BOVENGRONDS } from '../checklist/bepo-bovengronds';
import type { Tag } from '../db/db';
import { SECTION_TITLES } from '../sync/notes-md';

/**
 * Shows the BEPO section a photo or note was sorted into, and lets the inspector change it
 * (a native select: big, reliable and familiar on phones). A manual choice is kept.
 */
export function SectionChip({
  tag,
  onChange,
}: {
  tag: Tag;
  onChange: (sectie: string | null) => void;
}) {
  const status = tag.tagStatus ?? 'wachtend';
  const label =
    tag.sectie && SECTION_TITLES[tag.sectie]
      ? `${tag.sectie} ${SECTION_TITLES[tag.sectie]}`
      : status === 'wachtend'
        ? 'Wordt ingedeeld…'
        : 'Niet ingedeeld';
  return (
    <label className="relative inline-flex min-h-10 max-w-full items-center rounded-full border-2 border-gray-300 bg-gray-50 px-3 text-sm font-semibold">
      <span className="truncate">
        {label}
        {status === 'handmatig' ? ' ✎' : ''}
      </span>
      <span className="ml-1" aria-hidden>
        ▾
      </span>
      <select
        aria-label="Sectie kiezen"
        className="absolute inset-0 opacity-0"
        value={tag.sectie ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">— Niet ingedeeld —</option>
        {BEPO_BOVENGRONDS.sections.map((s) => (
          <option key={s.code} value={s.code}>
            {s.code} {s.title}
          </option>
        ))}
        <option value="T20">T20 Resultaat</option>
      </select>
    </label>
  );
}
