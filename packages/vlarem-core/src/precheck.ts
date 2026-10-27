/** "Klaar voor de keuring?" — the guided walk-around. Each step lists the rules a photo can say something about. */
export interface PrecheckStep {
  id: string;
  title_nl: string;
  instruction_nl: string;
  ruleIds: string[];
}

export const PRECHECK_STEPS: PrecheckStep[] = [
  {
    id: "bund",
    title_nl: "De inkuiping",
    instruction_nl: "Neem een foto van de hele inkuiping (opvangbak) rond de tank, met de tank erin.",
    ruleIds: ["VL-BUND-SINGLE-WALL"],
  },
  {
    id: "filling_point",
    title_nl: "De vulplaats",
    instruction_nl: "Neem een foto van de vulplaats: de vulaansluiting en de vloer of lekbak eronder.",
    ruleIds: ["VL-FILLING-POINT-LIQUID-TIGHT", "VL-IDENT-FILLING-POINT", "VL-IDENT-NO-FIRE"],
  },
  {
    id: "identification",
    title_nl: "De identificatie op de tank",
    instruction_nl: "Neem een foto van de tekst en symbolen op de tank (tanknummer, inhoud, product, gevarensymbolen).",
    ruleIds: ["VL-IDENT-TANK", "VL-IDENT-NO-FIRE"],
  },
  {
    id: "overfill",
    title_nl: "De overvulbeveiliging",
    instruction_nl: "Neem een foto van de overvulbeveiliging of het overvulalarm, en van de peilmeter als die er is.",
    ruleIds: ["VL-OVERFILL-PROTECTION", "VL-OVERFILL-SEPARATE-GAUGE", "VL-TRANS-OVERFILL-WHISTLE", "VL-PROTOTYPE-OVERFILL"],
  },
];
