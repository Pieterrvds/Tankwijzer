import type { Inspection, SectionCode } from '../domain/schemas';

/** An extra structured value captured on a check item (serial number, type, …). */
export interface ItemField {
  key: string;
  label: string;
  /** Choice fields render as big buttons; text fields as a text input. */
  kind: 'text' | 'choice';
  options?: string[];
  /** Hint for the mobile keyboard. */
  inputMode?: 'text' | 'numeric' | 'decimal';
}

export interface ItemDefinition {
  /** Stable id, `<section>.<slug>`, e.g. "T10.dichtheid". Never rename: stored data refers to it. */
  id: string;
  section: SectionCode;
  /** Short slug used in file names, e.g. "inkuiping" → T10_inkuiping_01.jpg. */
  slug: string;
  label: string;
  /** What to look at on site. */
  hint?: string;
  fields?: ItemField[];
  /**
   * Returns a reason when this item is very likely NVT for this tank, or null.
   * This is only a *suggestion*: the inspector confirms it with one tap.
   */
  suggestNvt?: (inspection: Inspection) => string | null;
}

export interface SectionDefinition {
  code: SectionCode;
  title: string;
  /** Short explanation shown at the top of the section page. */
  intro?: string;
  /** Sections T2–T4 mainly hold data from the tank/product forms. */
  editsGegevens?: 'algemeen' | 'tank' | 'product';
  items: ItemDefinition[];
}

export interface Checklist {
  id: string;
  title: string;
  sections: SectionDefinition[];
}
