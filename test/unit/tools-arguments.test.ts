// Les arguments refusés chez nous. Un refus tombe avant tout appel réseau, et
// une règle annoncée s'applique à l'exécution.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { connect, corpusFetch } from "./_harness.js";
import { FIXED_NOW, posting } from "./_corpus.js";

const twentySix = Array.from({ length: 26 }, (_, i) => `company-${i}`);

describe("les arguments que le serveur refuse", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refuse vingt-six entreprises avec invalid_input, avant tout appel réseau", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", { companies: twentySix });
    await harness.close();

    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("invalid_input");
    expect(stub.calls).toHaveLength(0);
  });

  it("refuse une liste d'entreprises vide", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", { companies: [] });
    await harness.close();

    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("invalid_input");
    expect(stub.calls).toHaveLength(0);
  });

  it("refuse un limit au-delà de cent, avant tout appel réseau", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      limit: 101,
    });
    await harness.close();

    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("invalid_input");
    expect(stub.calls).toHaveLength(0);
  });

  it("refuse un limit nul", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", { companies: ["acmerobotics"], limit: 0 });
    await harness.close();

    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("invalid_input");
  });

  it("refuse un salary_min négatif", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      salary_min: -1,
    });
    await harness.close();

    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("invalid_input");
    expect(stub.calls).toHaveLength(0);
  });

  it("refuse un posted_within_days inférieur à un", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      posted_within_days: 0,
    });
    await harness.close();

    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("invalid_input");
  });

  it("refuse un argument inconnu de search_jobs à l'exécution", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      remote_type: "remote",
    });
    await harness.close();

    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("invalid_input");
    expect(stub.calls).toHaveLength(0);
  });

  it("refuse un argument inconnu de resolve_company à l'exécution", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("resolve_company", {
      names: ["Acme Robotics"],
      instance: "global",
    });
    await harness.close();

    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("invalid_input");
    expect(stub.calls).toHaveLength(0);
  });

  it("refuse un argument inconnu de get_job à l'exécution", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("get_job", {
      company_slug: "acmerobotics",
      job_id: posting("recent").id,
      include_raw: true,
    });
    await harness.close();

    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("invalid_input");
    expect(stub.calls).toHaveLength(0);
  });

  it("refuse un argument inconnu de list_filter_values à l'exécution", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("list_filter_values", {
      company_slug: "acmerobotics",
      group: "team",
    });
    await harness.close();

    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("invalid_input");
    expect(stub.calls).toHaveLength(0);
  });

  it("refuse le filtre level, que Lever documente et ne rend sur aucune offre", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      level: ["senior"],
    });
    await harness.close();

    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("invalid_input");
  });

  it("refuse une valeur de filtre absente du site, avec les valeurs du site", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      team: ["Growth"],
    });
    await harness.close();

    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("invalid_input");
    expect(outcome.text).toContain("Engineering");
    expect(outcome.text).toContain("list_filter_values");
  });

  it("ne rend jamais une liste vide à la place d'une valeur de filtre refusée", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      team: ["Growth"],
    });
    await harness.close();

    expect(outcome.structured?.["jobs"]).toBeUndefined();
  });

  it("accepte les arguments que le contrat déclare", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      keyword: "engineer",
      workplace_type: ["remote"],
      country: ["US"],
      salary_min: 0,
      currency: "USD",
      posted_within_days: 3650,
      limit: 25,
      skip: 0,
    });
    await harness.close();

    expect(outcome.ok).toBe(true);
  });
});
