import type { DocumentKind, Tank, VaultDocument } from "./model.ts";

/** Documents an inspector will ask for, and how they are matched to a tank. */
export interface RequiredDocument {
  kind: DocumentKind;
  label_nl: string;
  why_nl: string;
  /** "site": one document for the whole site (permit); "tank": per tank. */
  scope: "site" | "tank";
  /** Only required when this returns true. */
  requiredFor: (tank: Tank) => boolean;
}

export const REQUIRED_DOCUMENTS: RequiredDocument[] = [
  {
    kind: "inspection_report",
    label_nl: "Vorig keuringsverslag",
    why_nl: "De milieudeskundige vergelijkt met de vorige keuring en kijkt of opmerkingen hersteld zijn.",
    scope: "tank",
    requiredFor: (t) => t.inspections.some((i) => i.type !== "commissioning"),
  },
  {
    kind: "commissioning_report",
    label_nl: "Verslag van de eerste keuring (ingebruikname)",
    why_nl: "Toont aan dat de tank gekeurd werd vóór het eerste gebruik.",
    scope: "tank",
    requiredFor: () => true,
  },
  {
    kind: "omgevingsvergunning",
    label_nl: "Omgevingsvergunning (met bijzondere voorwaarden)",
    why_nl: "Bepaalt welke opslag op uw site toegelaten is en of er extra voorwaarden gelden.",
    scope: "site",
    requiredFor: () => true,
  },
  {
    kind: "conformity_certificate",
    label_nl: "Conformiteitsattest van de tankbouwer",
    why_nl: "Bewijst dat de tank volgens een erkende norm gebouwd is.",
    scope: "tank",
    requiredFor: () => true,
  },
  {
    kind: "sds",
    label_nl: "Veiligheidsinformatieblad (VIB) van het product",
    why_nl: "Bepaalt de gevaren van het product en dus welke regels gelden (bv. ontvlambaarheid).",
    scope: "tank",
    requiredFor: () => true,
  },
];

export interface DocumentCheck {
  kind: DocumentKind;
  label_nl: string;
  why_nl: string;
  present: boolean;
  documentIds: string[];
}

function matches(doc: VaultDocument, tank: Tank, scope: "site" | "tank"): boolean {
  if (doc.tankIds.includes(tank.id)) return true;
  // A site-level document (e.g. the permit) linked to the tank's site counts for all its tanks.
  if (scope === "site" && doc.siteId === tank.siteId) return true;
  return false;
}

export function checkDocuments(tank: Tank, docs: VaultDocument[]): DocumentCheck[] {
  return REQUIRED_DOCUMENTS.filter((r) => r.requiredFor(tank)).map((r) => {
    const found = docs.filter((d) => d.kind === r.kind && matches(d, tank, r.scope));
    return {
      kind: r.kind,
      label_nl: r.label_nl,
      why_nl: r.why_nl,
      present: found.length > 0,
      documentIds: found.map((d) => d.id),
    };
  });
}

export const DOCUMENT_KIND_LABELS_NL: Record<DocumentKind, string> = {
  omgevingsvergunning: "Omgevingsvergunning",
  conformity_certificate: "Conformiteitsattest tankbouwer",
  inspection_report: "Keuringsverslag",
  commissioning_report: "Verslag eerste keuring",
  sds: "Veiligheidsinformatieblad (VIB)",
  repair_proof: "Bewijs van herstelling",
  other: "Ander document",
};
