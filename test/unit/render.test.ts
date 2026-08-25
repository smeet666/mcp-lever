// Les règles de rendu. Elles portent tout ce que le serveur a le droit
// d'affirmer sur une offre.

import { describe, it, expect } from "vitest";
import { toRow, toRecord, decodeEntities, listItems } from "../../src/tools/render.js";
import { posting, site } from "./_corpus.js";

const row = (caseName: string) => toRow(posting(caseName), "acmerobotics", "global");
const record = (caseName: string) => toRecord(posting(caseName), "acmerobotics", "global");

describe("le salaire", () => {
  it("vaut null quand l'offre ne publie aucune fourchette", () => {
    const rendered = row("no_salary") as unknown as Record<string, unknown>;
    expect(rendered["salary"]).toBeNull();
    expect(rendered["salary"]).not.toBe(0);
    expect("salary" in rendered).toBe(true);
  });

  it("vaut null quand l'offre publie une description de salaire sans fourchette", () => {
    const rendered = row("salary_description_only") as unknown as Record<string, unknown>;
    expect(rendered["salary"]).toBeNull();
  });

  it("rend un montant unique quand min égale max, sans fabriquer une fourchette", () => {
    const rendered = row("salary_equal") as unknown as Record<string, unknown>;
    const salary = rendered["salary"] as unknown as Record<string, unknown>;
    expect(salary["min"]).toBe(42_000);
    expect(salary["max"]).toBe(42_000);
    expect(salary["currency"]).toBe("GBP");
    expect(salary["interval"]).toBe("per-year-salary");
  });

  it("laisse passer une période horaire sans l'annualiser", () => {
    const rendered = row("salary_hour") as unknown as Record<string, unknown>;
    const salary = rendered["salary"] as unknown as Record<string, unknown>;
    expect(salary["interval"]).toBe("per-hour-wage");
    expect(salary["min"]).toBe(63.09);
    expect(salary["max"]).toBe(81.5);
  });

  it("laisse passer une période annuelle telle que Lever l'écrit", () => {
    const salary = (row("salary_year") as unknown as Record<string, unknown>)["salary"] as Record<
      string,
      unknown
    >;
    expect(salary["interval"]).toBe("per-year-salary");
    expect(Object.keys(salary).sort()).toEqual(["currency", "interval", "max", "min"]);
  });
});

describe("le lieu et le pays", () => {
  it("laisse country à null quand Lever l'ignore", () => {
    const rendered = row("country_null") as unknown as Record<string, unknown>;
    expect(rendered["country"]).toBeNull();
    expect(rendered["country"]).not.toBe("");
    expect(rendered["country"]).not.toBe("unknown");
  });

  it("rend les neuf lieux en tableau de neuf, jamais recollés en chaîne", () => {
    const rendered = row("nine_locations") as unknown as Record<string, unknown>;
    expect(Array.isArray(rendered["all_locations"])).toBe(true);
    expect(rendered["all_locations"]).toHaveLength(9);
    expect(rendered["all_locations"]).toContain("Stockholm");
  });

  it("garde le lieu principal que Lever désigne", () => {
    const rendered = row("nine_locations") as unknown as Record<string, unknown>;
    expect(rendered["location"]).toBe("Paris");
  });
});

describe("les clés que le site ne renseigne pas", () => {
  it("omet commitment quand categories ne le porte pas", () => {
    const rendered = row("no_commitment") as unknown as Record<string, unknown>;
    expect("commitment" in rendered).toBe(false);
  });

  it("omet department quand categories ne le porte pas", () => {
    const rendered = row("no_department") as unknown as Record<string, unknown>;
    expect("department" in rendered).toBe(false);
  });

  it("rend commitment et department quand le site les renseigne", () => {
    const rendered = row("no_salary") as unknown as Record<string, unknown>;
    expect(rendered["commitment"]).toBe("Full-time");
    expect(rendered["department"]).toBe("Platform");
  });
});

describe("la date de publication", () => {
  it("convertit createdAt en ISO 8601 UTC sans décaler l'instant", () => {
    const source = posting("salary_hour");
    const rendered = row("salary_hour") as unknown as Record<string, unknown>;
    expect(rendered["posted_at"]).toBe(new Date(source.createdAt).toISOString());
    expect(rendered["posted_at"]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("rend une offre de 2017 avec sa date de 2017", () => {
    const rendered = row("ancient") as unknown as Record<string, unknown>;
    expect(String(rendered["posted_at"]).startsWith("2017-08-30T")).toBe(true);
  });

  it("convertit chaque offre du corpus sans perdre la milliseconde", () => {
    for (const p of site("acmerobotics").postings) {
      const rendered = toRow(p, "acmerobotics", "global") as unknown as Record<string, unknown>;
      expect(Date.parse(String(rendered["posted_at"]))).toBe(p.createdAt);
    }
  });
});

describe("les adresses", () => {
  it("reprend hostedUrl et applyUrl tels que Lever les publie", () => {
    const source = posting("recent");
    const rendered = row("recent") as unknown as Record<string, unknown>;
    expect(rendered["url"]).toBe(source.hostedUrl);
    expect(rendered["apply_url"]).toBe(source.applyUrl);
    expect(rendered["apply_url"]).toBe(`${source.hostedUrl}/apply`);
  });

  it("porte l'identifiant du site et l'instance lue", () => {
    const rendered = row("recent") as unknown as Record<string, unknown>;
    expect(rendered["company_slug"]).toBe("acmerobotics");
    expect(rendered["instance"]).toBe("global");
  });
});

describe("la fiche complète", () => {
  it("tire la description de descriptionPlain, même quand openingPlain est vide", () => {
    const source = posting("empty_opening");
    expect(source.openingPlain).toBe("");
    const rendered = record("empty_opening") as unknown as Record<string, unknown>;
    expect(String(rendered["description"]).length).toBeGreaterThan(0);
    expect(String(rendered["description"])).toContain("reliability team");
  });

  it("ne bâtit jamais la description sur openingPlain", () => {
    for (const p of site("acmerobotics").postings) {
      const rendered = toRecord(p, "acmerobotics", "global") as unknown as Record<string, unknown>;
      expect(String(rendered["description"]).length).toBeGreaterThan(0);
    }
  });

  it("déséchappe les entités HTML des rubriques", () => {
    const rendered = record("html_entities") as unknown as Record<string, unknown>;
    const sections = rendered["sections"] as { heading: string; items: string[] }[];
    const items = sections.flatMap((s) => s.items);
    expect(items.join(" ")).not.toContain("&nbsp;");
    expect(items.join(" ")).not.toContain("&amp;");
    expect(items.join(" ")).not.toContain("&#39;");
    expect(items.some((i) => i.includes("qualitative & quantitative"))).toBe(true);
    expect(items.some((i) => i.includes("You've run a study"))).toBe(true);
  });

  it("rend une rubrique par entrée de lists, avec son intitulé", () => {
    const rendered = record("html_entities") as unknown as Record<string, unknown>;
    const sections = rendered["sections"] as { heading: string; items: string[] }[];
    expect(sections).toHaveLength(2);
    expect(sections[0]?.heading).toBe("Required Qualifications:");
    expect(sections[0]?.items).toHaveLength(3);
  });

  it("rend une liste de rubriques vide quand lists vaut le tableau vide", () => {
    const rendered = record("empty_lists") as unknown as Record<string, unknown>;
    expect(rendered["sections"]).toEqual([]);
  });

  it("rend salary_note à null quand salaryDescriptionPlain est absent", () => {
    const rendered = record("no_salary") as unknown as Record<string, unknown>;
    expect(rendered["salary_note"]).toBeNull();
  });

  it("rend salary_note quand le site publie une description de salaire", () => {
    const rendered = record("salary_description_only") as unknown as Record<string, unknown>;
    expect(rendered["salary_note"]).toContain("Compensation is set by level");
  });

  it("nomme Lever comme site et l'adresse d'API comme provenance", () => {
    const rendered = record("recent") as unknown as Record<string, unknown>;
    const source = rendered["source"] as unknown as Record<string, unknown>;
    expect(source["site"]).toBe("Lever");
    expect(new URL(String(source["retrieved_from"])).hostname).toBe("api.lever.co");
  });

  it("nomme l'instance européenne dans la provenance d'une offre lue là-bas", () => {
    const p = posting("recent");
    const rendered = toRecord(p, "acmerobotics", "eu") as unknown as Record<string, unknown>;
    const source = rendered["source"] as unknown as Record<string, unknown>;
    expect(new URL(String(source["retrieved_from"])).hostname).toBe("api.eu.lever.co");
  });

  it("porte tous les champs de la ligne", () => {
    const line = row("salary_year") as unknown as Record<string, unknown>;
    const full = record("salary_year") as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(line)) {
      expect(full[key]).toEqual(value);
    }
  });
});

describe("le déséchappement et le découpage", () => {
  it("rend l'esperluette pour &amp;", () => {
    expect(decodeEntities("Sales &amp; Marketing")).toBe("Sales & Marketing");
  });

  it("rend une apostrophe pour &#39;", () => {
    expect(decodeEntities("You&#39;ve shipped")).toBe("You've shipped");
  });

  it("ne laisse subsister aucun &nbsp;", () => {
    const decoded = decodeEntities("end&nbsp;to&nbsp;end");
    expect(decoded).not.toContain("&nbsp;");
    expect(decoded).toMatch(/end\sto\send/);
  });

  it("rend les chevrons échappés sans rouvrir de balise", () => {
    expect(decodeEntities("&lt;script&gt;")).toBe("<script>");
  });

  it("découpe le contenu d'une rubrique en un élément par li", () => {
    const items = listItems("<li>Premier</li><li>Second</li>");
    expect(items).toEqual(["Premier", "Second"]);
  });

  it("rend une liste vide pour un contenu sans li", () => {
    expect(listItems("")).toEqual([]);
  });

  it("retire le balisage interne d'un élément", () => {
    expect(listItems("<li><strong>Gras</strong> et suite</li>")).toEqual(["Gras et suite"]);
  });
});
