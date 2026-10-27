import { LABELS_NL, type InspectionRecord } from "@tankwijzer/vlarem-core";

export type InspectionDraft = Pick<InspectionRecord, "date" | "type" | "sticker" | "nextDueDate">;

export const emptyInspection = (): InspectionDraft => ({ date: "", type: "limited", sticker: "green", nextDueDate: null });

/** Date, type and sticker of an inspection, as read from the sticker or the report. */
export function InspectionFields({ value, onChange }: { value: InspectionDraft; onChange: (v: InspectionDraft) => void }) {
  return (
    <div className="grid-2">
      <label className="field">
        <span>Datum van de keuring</span>
        <input type="date" value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} />
      </label>
      <label className="field">
        <span>Soort keuring</span>
        <select value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value as InspectionDraft["type"] })}>
          {Object.entries(LABELS_NL.inspectionType).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Kleur van de klever</span>
        <select
          value={value.sticker ?? ""}
          onChange={(e) => onChange({ ...value, sticker: (e.target.value || null) as InspectionDraft["sticker"] })}
        >
          <option value="green">Groen</option>
          <option value="orange">Oranje</option>
          <option value="red">Rood</option>
          <option value="">Weet ik niet</option>
        </select>
      </label>
      <label className="field">
        <span>Volgende keuring (op de klever)</span>
        <input
          type="date"
          value={value.nextDueDate ?? ""}
          onChange={(e) => onChange({ ...value, nextDueDate: e.target.value || null })}
        />
      </label>
    </div>
  );
}
