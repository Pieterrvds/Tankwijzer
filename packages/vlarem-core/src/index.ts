export * from "./model.ts";
export * from "./dates.ts";
export * from "./facts.ts";
export * from "./deadlines.ts";
export * from "./documents.ts";
export * from "./guards.ts";
export * from "./ics.ts";
export * from "./reminders.ts";
export * from "./dossier.ts";
export * from "./rules/schema.ts";
export * from "./rules/engine.ts";
export * from "./rules/index.ts";

export const LABELS_NL = {
  placement: { above_ground: "Bovengronds", underground: "Ondergronds", unknown: "Onbekend" },
  wall: { single: "Enkelwandig", double: "Dubbelwandig", unknown: "Onbekend" },
  material: {
    steel: "Staal",
    stainless_steel: "Roestvrij staal",
    gvk: "GVK (glasvezelversterkte kunststof)",
    pe: "PE (polyetheen)",
    other: "Ander materiaal",
    unknown: "Onbekend",
  },
  product: {
    heating_oil: "Stookolie",
    diesel: "Diesel",
    gasoline: "Benzine",
    adblue: "AdBlue",
    lubricating_oil: "Smeerolie",
    waste_oil: "Afgewerkte olie",
    other: "Ander product",
    unknown: "Onbekend",
  },
  sticker: { green: "Groen", orange: "Oranje", red: "Rood" },
  inspectionType: {
    commissioning: "Eerste keuring (ingebruikname)",
    limited: "Beperkt onderzoek",
    general: "Algemeen onderzoek",
  },
  leakDetection: {
    none: "Geen",
    single_signal: "Eén signaal",
    continuous: "Continue bewaking",
    other: "Ander systeem",
    unknown: "Onbekend",
  },
  overfillAlarm: {
    none: "Geen",
    whistle: "Fluit",
    electronic: "Elektronisch alarm",
    other: "Ander systeem",
    unknown: "Onbekend",
  },
  tri: { yes: "Ja", no: "Nee", unknown: "Weet ik niet" },
} as const;
export * from "./precheck.ts";
