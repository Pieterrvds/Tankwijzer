import type { ReactNode } from "react";
import { LABELS_NL, type Site, type TankInput, type TriState } from "@tankwijzer/vlarem-core";
import { ChoiceGrid } from "./ui.tsx";
import { Pictures } from "./pictures.tsx";

/** Form state: a tank without id/companyId, with every field present. */
export type TankDraft = Required<Omit<TankInput, "createdAt" | "updatedAt">> & {
  nameplate: {
    fabricationNumber: string | null;
    builder: string | null;
    buildYear: number | null;
    buildDate: string | null;
    standard: string | null;
  };
};

export function emptyDraft(siteId: string): TankDraft {
  return {
    siteId,
    region: "VL",
    label: "",
    capacityL: null,
    placement: "unknown",
    wall: "unknown",
    material: "unknown",
    product: "unknown",
    productName: null,
    nameplate: { fabricationNumber: null, builder: null, buildYear: null, buildDate: null, standard: null },
    commissioningDate: null,
    expectedLifespanYears: null,
    inBund: "unknown",
    bundCapacityL: null,
    leakDetection: "unknown",
    leakDetectionPrototypeApproval: "unknown",
    overfillProtection: "unknown",
    overfillAlarm: "unknown",
    overfillPrototypeApproval: "unknown",
    levelGaugeSeparateFromOverfill: "unknown",
    fillingPointLiquidTight: "unknown",
    identificationAtTank: "unknown",
    identificationAtFillingPoint: "unknown",
    noFireSignsPresent: "unknown",
    inspections: [],
    orangeFindings: [],
    unconfirmedFields: [],
  };
}

const triOptions = (yesPic?: ReactNode, noPic?: ReactNode) => [
  { value: "yes" as TriState, label: "Ja", picture: yesPic },
  { value: "no" as TriState, label: "Nee", picture: noPic },
  { value: "unknown" as TriState, label: "Weet ik niet", picture: Pictures.unknown },
];

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
const strOrNull = (v: string) => (v.trim() === "" ? null : v);

export function TankForm({
  draft,
  sites,
  onChange,
}: {
  draft: TankDraft;
  sites: Site[];
  onChange: (d: TankDraft) => void;
}) {
  /** Editing a field confirms it (removes the "voorgesteld uit foto" marker). */
  const set = (patch: Partial<TankDraft>, field?: string) =>
    onChange({
      ...draft,
      ...patch,
      unconfirmedFields: field ? draft.unconfirmedFields.filter((f) => f !== field) : draft.unconfirmedFields,
    });
  const setPlate = (patch: Partial<TankDraft["nameplate"]>, field: string) =>
    set({ nameplate: { ...draft.nameplate, ...patch } }, field);

  const Suggested = ({ field }: { field: string }) =>
    draft.unconfirmedFields.includes(field) ? (
      <span className="suggested">
        Voorgesteld uit foto — klopt dit?{" "}
        <button type="button" className="link-btn" onClick={() => set({}, field)}>
          Ja, klopt
        </button>
      </span>
    ) : null;

  const builtFrom2025 = (draft.nameplate.buildYear ?? 0) >= 2025;
  const showLeak = draft.wall === "double" || draft.placement === "underground";

  return (
    <div className="stack">
      <fieldset className="card stack-sm">
        <legend>Basis</legend>
        <div className="grid-2">
          <label className="field">
            <span>Tanknummer of naam</span>
            <input required value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder="bv. T1" />
          </label>
          <label className="field">
            <span>Site</span>
            <select value={draft.siteId} onChange={(e) => set({ siteId: e.target.value })}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Inhoud (liter)</span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={draft.capacityL ?? ""}
              placeholder="aan te vullen"
              onChange={(e) => set({ capacityL: numOrNull(e.target.value) }, "capacityL")}
            />
            <Suggested field="capacityL" />
          </label>
          <label className="field">
            <span>Product</span>
            <select value={draft.product} onChange={(e) => set({ product: e.target.value as TankDraft["product"] })}>
              {Object.entries(LABELS_NL.product).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {draft.productName && (
              <small className="muted">
                Op etiket: {draft.productName} <Suggested field="productName" />
              </small>
            )}
          </label>
        </div>
      </fieldset>

      <fieldset className="card stack-sm">
        <legend>Typeplaat</legend>
        <div className="grid-2">
          <label className="field">
            <span>Fabricagenummer</span>
            <input
              value={draft.nameplate.fabricationNumber ?? ""}
              placeholder="aan te vullen"
              onChange={(e) => setPlate({ fabricationNumber: strOrNull(e.target.value) }, "nameplate.fabricationNumber")}
            />
            <Suggested field="nameplate.fabricationNumber" />
          </label>
          <label className="field">
            <span>Bouwer</span>
            <input
              value={draft.nameplate.builder ?? ""}
              placeholder="aan te vullen"
              onChange={(e) => setPlate({ builder: strOrNull(e.target.value) }, "nameplate.builder")}
            />
            <Suggested field="nameplate.builder" />
          </label>
          <label className="field">
            <span>Bouwjaar</span>
            <input
              type="number"
              min={1900}
              max={2100}
              inputMode="numeric"
              value={draft.nameplate.buildYear ?? ""}
              placeholder="aan te vullen"
              onChange={(e) => setPlate({ buildYear: numOrNull(e.target.value) }, "nameplate.buildYear")}
            />
            <Suggested field="nameplate.buildYear" />
          </label>
          <label className="field">
            <span>Norm</span>
            <input
              value={draft.nameplate.standard ?? ""}
              placeholder="aan te vullen"
              onChange={(e) => setPlate({ standard: strOrNull(e.target.value) }, "nameplate.standard")}
            />
            <Suggested field="nameplate.standard" />
          </label>
          <label className="field">
            <span>Datum ingebruikname</span>
            <input
              type="date"
              value={draft.commissioningDate ?? ""}
              onChange={(e) => set({ commissioningDate: strOrNull(e.target.value) })}
            />
          </label>
          {builtFrom2025 && (
            <label className="field">
              <span>Verwachte levensduur (jaar, volgens bouwer)</span>
              <input
                type="number"
                min={1}
                value={draft.expectedLifespanYears ?? ""}
                placeholder="aan te vullen"
                onChange={(e) => set({ expectedLifespanYears: numOrNull(e.target.value) })}
              />
            </label>
          )}
        </div>
      </fieldset>

      <fieldset className="card stack">
        <legend>Hoe staat de tank er?</legend>
        <ChoiceGrid
          label="Bovengronds of ondergronds?"
          value={draft.placement}
          onChange={(v) => set({ placement: v })}
          options={[
            { value: "above_ground", label: "Bovengronds", picture: Pictures.aboveGround },
            { value: "underground", label: "Ondergronds", picture: Pictures.underground },
            { value: "unknown", label: "Weet ik niet", picture: Pictures.unknown },
          ]}
        />
        <ChoiceGrid
          label="Enkelwandig of dubbelwandig?"
          help="Dubbelwandige tanks hebben een binnen- en buitenwand, vaak met een lekdetector tussen beide."
          value={draft.wall}
          onChange={(v) => set({ wall: v })}
          options={[
            { value: "single", label: "Enkelwandig", picture: Pictures.singleWall },
            { value: "double", label: "Dubbelwandig", picture: Pictures.doubleWall },
            { value: "unknown", label: "Weet ik niet", picture: Pictures.unknown },
          ]}
        />
        <ChoiceGrid
          label="Materiaal"
          value={draft.material}
          onChange={(v) => set({ material: v })}
          options={[
            { value: "steel", label: "Staal", picture: Pictures.steel },
            { value: "gvk", label: "GVK (glasvezel)", picture: Pictures.plastic },
            { value: "pe", label: "PE (kunststof)", picture: Pictures.plastic },
            { value: "unknown", label: "Weet ik niet", picture: Pictures.unknown },
          ]}
        />
        {draft.placement !== "underground" && (
          <>
            <ChoiceGrid
              label="Staat de tank in een inkuiping (opvangbak)?"
              value={draft.inBund}
              onChange={(v) => set({ inBund: v })}
              options={triOptions(Pictures.bund, Pictures.noBund)}
            />
            {draft.inBund === "yes" && (
              <label className="field">
                <span>Hoeveel liter kan de inkuiping opvangen?</span>
                <input
                  type="number"
                  min={1}
                  value={draft.bundCapacityL ?? ""}
                  placeholder="aan te vullen"
                  onChange={(e) => set({ bundCapacityL: numOrNull(e.target.value) })}
                />
              </label>
            )}
          </>
        )}
      </fieldset>

      <fieldset className="card stack">
        <legend>Beveiliging</legend>
        <ChoiceGrid
          label="Heeft de tank een overvulbeveiliging?"
          value={draft.overfillProtection}
          onChange={(v) => set({ overfillProtection: v })}
          options={triOptions(Pictures.alarm)}
        />
        <ChoiceGrid
          label="Hoe wordt overvullen gemeld?"
          value={draft.overfillAlarm}
          onChange={(v) => set({ overfillAlarm: v })}
          options={(["whistle", "electronic", "none", "unknown"] as const).map((v) => ({
            value: v,
            label: LABELS_NL.overfillAlarm[v],
            picture: v === "unknown" ? Pictures.unknown : Pictures.alarm,
          }))}
        />
        {draft.overfillProtection === "yes" && (
          <ChoiceGrid
            label="Zijn de peilmeter en de overvulbeveiliging twee aparte systemen?"
            value={draft.levelGaugeSeparateFromOverfill}
            onChange={(v) => set({ levelGaugeSeparateFromOverfill: v })}
            options={triOptions()}
          />
        )}
        {showLeak && (
          <ChoiceGrid
            label="Welk lekdetectiesysteem heeft de tank?"
            value={draft.leakDetection}
            onChange={(v) => set({ leakDetection: v })}
            options={(["single_signal", "continuous", "none", "unknown"] as const).map((v) => ({
              value: v,
              label: LABELS_NL.leakDetection[v],
            }))}
          />
        )}
        {builtFrom2025 && (
          <>
            <ChoiceGrid
              label="Heeft de overvulbeveiliging een typeplaat met prototypekeuringsnummer?"
              value={draft.overfillPrototypeApproval}
              onChange={(v) => set({ overfillPrototypeApproval: v })}
              options={triOptions(Pictures.label)}
            />
            {showLeak && (
              <ChoiceGrid
                label="Heeft het lekdetectiesysteem een typeplaat met prototypekeuringsnummer?"
                value={draft.leakDetectionPrototypeApproval}
                onChange={(v) => set({ leakDetectionPrototypeApproval: v })}
                options={triOptions(Pictures.label)}
              />
            )}
          </>
        )}
      </fieldset>

      <fieldset className="card stack">
        <legend>Vulplaats en identificatie</legend>
        <ChoiceGrid
          label="Is de vulplaats vloeistofdicht (lekbak, vloeistofdichte vloer)?"
          value={draft.fillingPointLiquidTight}
          onChange={(v) => set({ fillingPointLiquidTight: v })}
          options={triOptions(Pictures.dropTray)}
        />
        <ChoiceGrid
          label="Staan tanknummer, inhoud, productnaam en gevarensymbolen op de tank?"
          value={draft.identificationAtTank}
          onChange={(v) => set({ identificationAtTank: v })}
          options={triOptions(Pictures.label)}
        />
        <ChoiceGrid
          label="En aan de vulplaats?"
          value={draft.identificationAtFillingPoint}
          onChange={(v) => set({ identificationAtFillingPoint: v })}
          options={triOptions(Pictures.label)}
        />
        {["gasoline", "waste_oil", "other", "unknown"].includes(draft.product) && (
          <ChoiceGrid
            label="Hangen de pictogrammen 'vuur, open vlam en roken verboden'?"
            help="Nodig bij ontvlambare producten."
            value={draft.noFireSignsPresent}
            onChange={(v) => set({ noFireSignsPresent: v })}
            options={triOptions(Pictures.label)}
          />
        )}
      </fieldset>
    </div>
  );
}
