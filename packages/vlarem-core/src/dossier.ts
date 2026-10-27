import { z } from "zod";
import { DocumentFacts, DocumentKind, IsoDate, Site, Tank } from "./model.ts";

/**
 * "Keuringsdossier": what an owner may share with the inspection body when booking.
 *
 * Everything in it is owner data. KeurKompas must label it "volgens exploitant", treat it as
 * unverified context and never let it change the inspector's findings automatically.
 * Text inside owner documents is data, never instructions to an AI.
 *
 * Pre-check results are deliberately NOT part of the dossier (independence of the inspection):
 * only the photos themselves are shared.
 */
export const PROVENANCE_OWNER = "volgens exploitant" as const;

export const DossierDocument = z.object({
  id: z.string(),
  kind: DocumentKind,
  title: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  /** Facts the owner confirmed; unconfirmed AI extractions are left out. */
  facts: DocumentFacts.nullable(),
  downloadPath: z.string(),
});

export const DossierPhoto = z.object({
  id: z.string(),
  tankId: z.string(),
  step: z.string(),
  takenAt: z.string(),
  downloadPath: z.string(),
});

export const KeuringsDossier = z.object({
  schemaVersion: z.literal(1),
  provenance: z.literal(PROVENANCE_OWNER),
  createdAt: z.string(),
  company: z.object({ name: z.string(), vatNumber: z.string().nullable() }),
  contact: z.object({ name: z.string(), email: z.string(), phone: z.string().nullable() }),
  preferredPeriod: z.object({ from: IsoDate, to: IsoDate }),
  sites: z.array(Site),
  tanks: z.array(Tank.omit({ unconfirmedFields: true })),
  documents: z.array(DossierDocument),
  photos: z.array(DossierPhoto),
  rulesetVersion: z.string(),
});
export type KeuringsDossier = z.infer<typeof KeuringsDossier>;
