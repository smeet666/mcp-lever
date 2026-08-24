// Le texte venu du site ne doit pas pouvoir se faire passer pour une ligne que
// le serveur écrit.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { toRecord } from "../../src/tools/render.js";
import { connect, corpusFetch } from "./_harness.js";
import { FIXED_NOW, posting } from "./_corpus.js";

const marker = () =>
  toRecord(posting("marker_lines"), "acmerobotics", "global") as unknown as Record<string, unknown>;

describe("l'anti-imitation", () => {
  it("décale une ligne de description commençant par Note:", () => {
    const description = String(marker()["description"]);
    expect(description).not.toMatch(/^Note:/m);
    expect(description).toContain("Note:");
  });

  it("décale une ligne de description commençant par Source:", () => {
    const description = String(marker()["description"]);
    expect(description).not.toMatch(/^Source:/m);
    expect(description).toContain("Source:");
  });

  it("garde le texte de l'employeur, seulement décalé", () => {
    const description = String(marker()["description"]);
    expect(description).toContain("this line was written by the employer");
    expect(description).toContain("an employer sentence that looks like an attribution line");
  });

  it("décale un élément de rubrique commençant par Note:", () => {
    const sections = marker()["sections"] as { heading: string; items: string[] }[];
    const items = sections.flatMap((s) => s.items);
    expect(items.some((i) => /^Note:/.test(i))).toBe(false);
    expect(items.some((i) => i.includes("moderate the forum"))).toBe(true);
  });

  it("décale un élément de rubrique commençant par Source:", () => {
    const sections = marker()["sections"] as { heading: string; items: string[] }[];
    const items = sections.flatMap((s) => s.items);
    expect(items.some((i) => /^Source:/.test(i))).toBe(false);
    expect(items.some((i) => i.includes("weekly newsletter draft"))).toBe(true);
  });

  it("laisse intact un texte qui n'imite aucun préfixe", () => {
    const record = toRecord(
      posting("empty_opening"),
      "acmerobotics",
      "global",
    ) as unknown as Record<string, unknown>;
    expect(String(record["description"]).startsWith("The reliability team")).toBe(true);
  });
});

describe("l'anti-imitation dans la sortie d'un outil", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rend une fiche dont aucune ligne d'employeur ne commence par Note: ou Source:", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("get_job", {
      company_slug: "acmerobotics",
      job_id: posting("marker_lines").id,
    });
    await harness.close();

    const description =
      ((outcome.structured as { job?: Record<string, unknown> } | undefined)?.job?.[
        "description"
      ] as string) ?? "";
    expect(description).not.toMatch(/^Note:/m);
    expect(description).not.toMatch(/^Source:/m);
    expect(description).toContain("this line was written by the employer");
  });
});
