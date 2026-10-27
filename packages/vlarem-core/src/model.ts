import { z } from "zod";

/**
 * Shared data model for tanks, sites and companies.
 *
 * Design choices:
 * - Every fact an owner may not know is nullable or a tri-state ("yes" | "no" | "unknown").
 *   `null` means "aan te vullen" in the UI; the rules engine treats it as unknown and never guesses.
 * - Dates are ISO strings (YYYY-MM-DD) so the same JSON works in the browser, the API and KeurKompas.
 * - The model is region-aware so Brussels, Wallonia and the Netherlands can be added later.
 */

export const Region = z.enum(["VL", "BR", "WAL", "NL"]);
export type Region = z.infer<typeof Region>;

export const TriState = z.enum(["yes", "no", "unknown"]);
export type TriState = z.infer<typeof TriState>;

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum moet JJJJ-MM-DD zijn");
export type IsoDate = z.infer<typeof IsoDate>;

export const StickerColour = z.enum(["green", "orange", "red"]);
export type StickerColour = z.infer<typeof StickerColour>;

export const Placement = z.enum(["above_ground", "underground", "unknown"]);
export const Wall = z.enum(["single", "double", "unknown"]);
export const Material = z.enum(["steel", "stainless_steel", "gvk", "pe", "other", "unknown"]);

/** Stored products. Flammability is derived in the rules engine, not stored. */
export const Product = z.enum([
  "heating_oil",
  "diesel",
  "gasoline",
  "adblue",
  "lubricating_oil",
  "waste_oil",
  "other",
  "unknown",
]);
export type Product = z.infer<typeof Product>;

export const LeakDetectionType = z.enum(["none", "single_signal", "continuous", "other", "unknown"]);
export const OverfillAlarmType = z.enum(["none", "whistle", "electronic", "other", "unknown"]);

export const InspectionType = z.enum(["commissioning", "limited", "general"]);
export type InspectionType = z.infer<typeof InspectionType>;

/** Where a value came from. Owner data shared with an inspector is always "volgens exploitant". */
export const DataSource = z.enum(["owner", "ai_photo", "official_report"]);

export const InspectionRecord = z.object({
  date: IsoDate,
  type: InspectionType,
  sticker: StickerColour.nullable(),
  /** Next inspection date as printed on the sticker, if known. */
  nextDueDate: IsoDate.nullable().default(null),
  remarks: z.array(z.string()).default([]),
  source: DataSource.default("owner"),
});
export type InspectionRecord = z.infer<typeof InspectionRecord>;

export const OrangeFinding = z.object({
  id: z.string(),
  text: z.string().min(1),
  resolved: z.boolean().default(false),
  proofDocumentIds: z.array(z.string()).default([]),
});
export type OrangeFinding = z.infer<typeof OrangeFinding>;

export const Nameplate = z.object({
  fabricationNumber: z.string().nullable().default(null),
  builder: z.string().nullable().default(null),
  buildYear: z.number().int().min(1900).max(2100).nullable().default(null),
  /** Exact build date when known; matters for the 01/01/2025 cut-off. */
  buildDate: IsoDate.nullable().default(null),
  standard: z.string().nullable().default(null),
});

export const Tank = z.object({
  id: z.string(),
  companyId: z.string(),
  siteId: z.string(),
  region: Region.default("VL"),
  /** Tank number as used on site, e.g. "T1". */
  label: z.string().min(1),
  capacityL: z.number().positive().nullable().default(null),
  placement: Placement.default("unknown"),
  wall: Wall.default("unknown"),
  material: Material.default("unknown"),
  product: Product.default("unknown"),
  productName: z.string().nullable().default(null),
  nameplate: Nameplate.default({
    fabricationNumber: null,
    builder: null,
    buildYear: null,
    buildDate: null,
    standard: null,
  }),
  commissioningDate: IsoDate.nullable().default(null),
  /** Expected lifespan from the builder, needed for tanks built from 01/01/2025. */
  expectedLifespanYears: z.number().positive().nullable().default(null),

  inBund: TriState.default("unknown"),
  bundCapacityL: z.number().positive().nullable().default(null),

  leakDetection: LeakDetectionType.default("unknown"),
  leakDetectionPrototypeApproval: TriState.default("unknown"),
  overfillProtection: TriState.default("unknown"),
  overfillAlarm: OverfillAlarmType.default("unknown"),
  overfillPrototypeApproval: TriState.default("unknown"),
  levelGaugeSeparateFromOverfill: TriState.default("unknown"),

  fillingPointLiquidTight: TriState.default("unknown"),
  identificationAtTank: TriState.default("unknown"),
  identificationAtFillingPoint: TriState.default("unknown"),
  noFireSignsPresent: TriState.default("unknown"),

  inspections: z.array(InspectionRecord).default([]),
  orangeFindings: z.array(OrangeFinding).default([]),

  /** Which fields were proposed by AI from a photo and not yet confirmed by the owner. */
  unconfirmedFields: z.array(z.string()).default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Tank = z.infer<typeof Tank>;

/** Input for creating/updating a tank: server assigns id and companyId. */
export const TankInput = Tank.omit({ id: true, companyId: true, createdAt: true, updatedAt: true });
export type TankInput = z.input<typeof TankInput>;

export const Site = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string().min(1),
  address: z.string().nullable().default(null),
  region: Region.default("VL"),
  /** Water catchment area (waterwingebied) or protection zone (beschermingszone type I, II or III). */
  inWaterProtectionZone: TriState.default("unknown"),
  /** Hydrocarbon (KWS) separator present on the site's drainage. */
  kwsSeparatorPresent: TriState.default("unknown"),
});
export type Site = z.infer<typeof Site>;
export const SiteInput = Site.omit({ id: true, companyId: true });

export const Plan = z.enum(["free", "pro"]);
export type Plan = z.infer<typeof Plan>;

export const Company = z.object({
  id: z.string(),
  name: z.string().min(1),
  vatNumber: z.string().nullable().default(null),
  plan: Plan.default("free"),
  createdAt: z.string(),
});
export type Company = z.infer<typeof Company>;

/** Free plan limit (business model: free up to 3 tanks). */
export const FREE_PLAN_TANK_LIMIT = 3;

export const DocumentKind = z.enum([
  "omgevingsvergunning",
  "conformity_certificate",
  "inspection_report",
  "commissioning_report",
  "sds",
  "repair_proof",
  "other",
]);
export type DocumentKind = z.infer<typeof DocumentKind>;

export const DocumentFacts = z.object({
  permitNumber: z.string().nullable().default(null),
  documentDate: IsoDate.nullable().default(null),
  product: z.string().nullable().default(null),
  quantity: z.string().nullable().default(null),
  sticker: StickerColour.nullable().default(null),
  nextInspectionDate: IsoDate.nullable().default(null),
  openRemarks: z.array(z.string()).default([]),
  specialConditions: z.array(z.string()).default([]),
  fabricationNumber: z.string().nullable().default(null),
});
export type DocumentFacts = z.infer<typeof DocumentFacts>;

export const VaultDocument = z.object({
  id: z.string(),
  companyId: z.string(),
  kind: DocumentKind,
  title: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  tankIds: z.array(z.string()).default([]),
  siteId: z.string().nullable().default(null),
  facts: DocumentFacts.nullable().default(null),
  /** AI-extracted facts are unconfirmed until the owner checks them. */
  factsConfirmed: z.boolean().default(false),
  uploadedAt: z.string(),
});
export type VaultDocument = z.infer<typeof VaultDocument>;
