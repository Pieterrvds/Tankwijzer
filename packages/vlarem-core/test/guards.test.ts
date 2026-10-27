import { describe, expect, it } from "vitest";
import { checkOwnerText, findBrandMentions, redactBrands } from "../src/index.ts";

describe("brand guard", () => {
  it("finds brand names case-insensitively on word boundaries", () => {
    expect(findBrandMentions("Plaats een overvulbeveiliging van afriso.")).toEqual(["Afriso"]);
    expect(findBrandMentions("Een Schütz-tank")).toEqual(["Schütz"]);
  });

  it("does not match inside other words", () => {
    expect(findBrandMentions("Een rothweiler en een gokje")).toEqual([]);
  });

  it("redacts brand names", () => {
    expect(redactBrands("Neem een Afriso of Werit.")).toBe("Neem een [merknaam verwijderd] of [merknaam verwijderd].");
  });
});

describe("claim guard", () => {
  it("blocks inspection claims", () => {
    expect(checkOwnerText("Uw tank is conform.").ok).toBe(false);
    expect(checkOwnerText("De tank zal groen krijgen.").ok).toBe(false);
  });
  it("allows careful wording", () => {
    expect(checkOwnerText("Waarschijnlijk in orde; laat dit nakijken.").ok).toBe(true);
    expect(checkOwnerText("een overvulbeveiliging conform bijlage 5.17.7").ok).toBe(true);
  });
});
