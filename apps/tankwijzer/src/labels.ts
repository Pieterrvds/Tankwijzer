import type { DeadlineKind, RuleCategory } from "@tankwijzer/vlarem-core";

export const CATEGORY_LABELS: Record<RuleCategory, string> = {
  frequency: "keuringsfrequentie",
  sticker: "keuringsklever",
  construction: "constructie",
  equipment: "uitrusting",
  identification: "identificatie",
  transition: "overgangstermijn",
  documents: "documenten",
};

export const DEADLINE_KIND_LABELS: Record<DeadlineKind, string> = {
  commissioning: "Eerste keuring",
  limited: "Beperkt onderzoek",
  general: "Algemeen onderzoek",
  orange_reinspection: "Herkeuring oranje klever",
  red_repair: "Rode klever",
  transition: "Overgangstermijn",
  end_of_life: "Einde levensduur",
};
