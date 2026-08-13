// `search_jobs` : l'agrégation, et ce qu'elle a le droit d'affirmer.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { connect, corpusFetch } from "./_harness.js";
import { FIXED_NOW, site } from "./_corpus.js";

interface PerCompany {
  input: string;
  slug: string | null;
  instance: string | null;
  status: string;
  returned: number;
  error?: string;
}

const perCompany = (structured: Record<string, unknown> | undefined): PerCompany[] =>
  (structured?.["per_company"] ?? []) as PerCompany[];

describe("l'agrégation par entreprise", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marque lue une entreprise dont les offres ont été lues", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", { companies: ["acmerobotics"] });
    await harness.close();

    const entry = perCompany(outcome.structured)[0];
    expect(entry?.status).toBe("read");
    expect(entry?.slug).toBe("acmerobotics");
    expect(entry?.instance).toBe("global");
    expect(entry?.returned).toBeGreaterThan(0);
  });

  it("marque non résolue une entreprise dont aucune forme ne répond", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", { companies: ["Mitek Systems"] });
    await harness.close();

    const entry = perCompany(outcome.structured)[0];
    expect(entry?.status).toBe("unresolved");
    expect(entry?.slug).toBeNull();
    expect(entry?.returned).toBe(0);
  });

  it("marque sans offre une entreprise résolue qui ne publie rien", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", { companies: ["quietstudio"] });
    await harness.close();

    const entry = perCompany(outcome.structured)[0];
    expect(entry?.status).toBe("empty");
    expect(entry?.slug).toBe("quietstudio");
    expect(entry?.returned).toBe(0);
  });

  it("marque en panne une entreprise dont la lecture a échoué", async () => {
    const stub = corpusFetch({ fail: { brokenco: { status: 500 } } });
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", { companies: ["brokenco"] });
    await harness.close();

    const entry = perCompany(outcome.structured)[0];
    expect(entry?.status).toBe("failed");
    expect(entry?.error).toBeDefined();
  });

  it("distingue les quatre états dans un même appel", async () => {
    const stub = corpusFetch({ fail: { brokenco: { status: 500 } } });
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics", "Mitek Systems", "quietstudio", "brokenco"],
    });
    await harness.close();

    const statuses = Object.fromEntries(perCompany(outcome.structured).map((e) => [e.input, e.status]));
    expect(statuses).toEqual({
      acmerobotics: "read",
      "Mitek Systems": "unresolved",
      quietstudio: "empty",
      brokenco: "failed",
    });
  });

  it("rend les offres des autres entreprises quand l'une est en panne", async () => {
    const stub = corpusFetch({ fail: { brokenco: { status: 500 } } });
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics", "brokenco"],
      limit: 100,
    });
    await harness.close();

    const jobs = outcome.structured?.["jobs"] as unknown[];
    expect(jobs.length).toBe(site("acmerobotics").postings.length);
  });

  it("nomme l'entreprise en panne dans une note", async () => {
    const stub = corpusFetch({ fail: { brokenco: { status: 500 } } });
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics", "brokenco"],
    });
    await harness.close();

    const notes = (outcome.structured?.["notes"] ?? []) as string[];
    expect(notes.join(" ")).toContain("brokenco");
  });

  it("rend total_available à null, puisque Lever ne publie aucun compteur", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", { companies: ["acmerobotics"] });
    await harness.close();

    expect(outcome.structured?.["total_available"]).toBeNull();
  });

  it("rend total_available à null même quand rien ne se résout", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", { companies: ["Mitek Systems"] });
    await harness.close();

    expect(outcome.structured?.["total_available"]).toBeNull();
    expect(outcome.structured?.["jobs"]).toEqual([]);
  });

  it("rassemble les offres de deux entreprises en une seule liste", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics", "Nimbus"],
      limit: 100,
    });
    await harness.close();

    const jobs = outcome.structured?.["jobs"] as { company_slug: string }[];
    expect(new Set(jobs.map((j) => j.company_slug))).toEqual(new Set(["acmerobotics", "Nimbus"]));
  });

  it("applique le mot-clé chez nous, sur le texte déjà reçu", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      keyword: "backend",
      limit: 100,
    });
    await harness.close();

    const jobs = outcome.structured?.["jobs"] as { title: string }[];
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((j) => j.title.toLowerCase().includes("backend"))).toBe(true);
    expect(stub.urls().some((u) => u.includes("keyword"))).toBe(false);
  });

  it("filtre le type de poste chez nous, que Lever accepte et ignore", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      workplace_type: ["onsite"],
      limit: 100,
    });
    await harness.close();

    const jobs = outcome.structured?.["jobs"] as { workplace_type: string }[];
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((j) => j.workplace_type === "onsite")).toBe(true);
    expect(stub.urls().some((u) => u.includes("workplaceType"))).toBe(false);
  });

  it("laisse passer une valeur de type de poste que le corpus ne montre pas", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      workplace_type: ["unspecified"],
    });
    await harness.close();

    expect(outcome.ok).toBe(true);
    expect(outcome.structured?.["jobs"]).toEqual([]);
  });

  it("lit une entreprise européenne sur son instance", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", { companies: ["zephyrworks"] });
    await harness.close();

    const entry = perCompany(outcome.structured)[0];
    expect(entry?.instance).toBe("eu");
    expect(entry?.status).toBe("read");
  });
});
