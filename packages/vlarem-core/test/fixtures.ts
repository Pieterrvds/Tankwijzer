import { Site, Tank, type TankInput } from "../src/index.ts";

export function makeTank(over: Partial<TankInput> & Record<string, unknown> = {}): Tank {
  return Tank.parse({ id: "t1", companyId: "c1", siteId: "s1", label: "T1", ...over });
}

export function makeSite(over: Partial<Site> = {}): Site {
  return Site.parse({ id: "s1", companyId: "c1", name: "Hoofdsite", ...over });
}
