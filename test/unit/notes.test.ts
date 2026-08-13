// Les notes normatives. Chacune paraît au moment que `CONTRACTS.md` fixe, et
// dit ce que la donnée porte.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { connect, corpusFetch } from "./_harness.js";
import { FIXED_NOW, site } from "./_corpus.js";

const notesOf = (structured: Record<string, unknown> | undefined): string[] =>
  (structured?.["notes"] ?? []) as string[];

const acme = site("acmerobotics").postings;
const sansSalaire = acme.filter((p) => !p.salaryRange).length;
const autrePeriode = acme.filter(
  (p) => p.salaryRange?.currency === "USD" && p.salaryRange.interval !== "per-year-salary",
).length;
const horsFenetre = acme.filter(
  (p) => Date.parse(FIXED_NOW) - p.createdAt > 7 * 24 * 60 * 60 * 1000,
).length;

const contientLeNombre = (notes: string[], n: number): boolean =>
  new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(notes.join(" ␟ "));

describe("les notes du serveur", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dit qu'une résolution sans trouvaille ne prouve pas une absence, et que la casse compte", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("resolve_company", { names: ["Mitek Systems"] });
    await harness.close();

    expect(((outcome.structured?.["resolved"] as { found: unknown[] }[])[0]?.found)).toEqual([]);
    const notes = notesOf(outcome.structured);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.join(" ")).toMatch(/case/i);
    expect(notes.join(" ")).toMatch(/prove|proof/i);
  });

  it("dit que les deux instances répondent, sans en élire une", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("resolve_company", { names: ["Duplex Labs"] });
    await harness.close();

    expect(((outcome.structured?.["resolved"] as { found: unknown[] }[])[0]?.found)).toHaveLength(2);
    expect(notesOf(outcome.structured).join(" ")).toMatch(/both Lever instances|global.*eu|eu.*global/i);
  });

  it("n'écrit aucune note d'absence quand une entreprise se résout", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("resolve_company", { names: ["Acme Robotics"] });
    await harness.close();

    expect(notesOf(outcome.structured).join(" ")).not.toMatch(/prove|proof/i);
  });

  it("annonce combien d'offres salary_min écarte faute de salaire publié", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      salary_min: 100000,
      currency: "USD",
      limit: 100,
    });
    await harness.close();

    const notes = notesOf(outcome.structured);
    expect(contientLeNombre(notes, sansSalaire)).toBe(true);
    expect(notes.join(" ")).toMatch(/salary/i);
  });

  it("annonce combien d'offres salary_min écarte pour une période différente", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      salary_min: 100000,
      currency: "USD",
      limit: 100,
    });
    await harness.close();

    const notes = notesOf(outcome.structured);
    expect(contientLeNombre(notes, autrePeriode)).toBe(true);
    expect(notes.join(" ")).toMatch(/period|per-hour-wage|per-year-salary/i);
  });

  it("n'annonce aucun écart de salaire quand salary_min n'est pas demandé", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", { companies: ["acmerobotics"], limit: 100 });
    await harness.close();

    expect(notesOf(outcome.structured).join(" ")).not.toMatch(/salary/i);
  });

  it("annonce combien d'offres posted_within_days écarte", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      posted_within_days: 7,
      limit: 100,
    });
    await harness.close();

    const notes = notesOf(outcome.structured);
    expect(contientLeNombre(notes, horsFenetre)).toBe(true);
    expect((outcome.structured?.["jobs"] as unknown[]).length).toBe(acme.length - horsFenetre);
  });

  it("nomme la valeur de filtre écartée et invite à lire le vocabulaire du site", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      team: ["Growth"],
    });
    await harness.close();

    expect(outcome.text).toContain("Growth");
    expect(outcome.text).toContain("list_filter_values");
  });

  it("nomme l'entreprise en panne et dit que la liste ne couvre donc pas tout", async () => {
    const stub = corpusFetch({ fail: { brokenco: { status: 500 } } });
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics", "brokenco"],
      limit: 100,
    });
    await harness.close();

    const notes = notesOf(outcome.structured).join(" ");
    expect(notes).toContain("brokenco");
    expect(notes).toMatch(/do not cover|does not cover|failed/i);
  });

  it("avertit qu'au-delà de dix entreprises chacune coûte une seconde", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const onze = [
      "acmerobotics",
      "Nimbus",
      "zephyrworks",
      "duplexlabs",
      "quietstudio",
      "alpha",
      "beta",
      "gamma",
      "delta",
      "epsilon",
      "zeta",
    ];
    const outcome = await harness.call("search_jobs", { companies: onze, limit: 5 });
    await harness.close();

    expect(outcome.ok).toBe(true);
    expect(notesOf(outcome.structured).join(" ")).toMatch(/second/i);
  });

  it("n'avertit pas du coût quand dix entreprises au plus sont demandées", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics", "Nimbus"],
      limit: 5,
    });
    await harness.close();

    expect(notesOf(outcome.structured).join(" ")).not.toMatch(/second/i);
  });
});
