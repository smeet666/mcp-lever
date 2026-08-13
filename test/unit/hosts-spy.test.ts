// L'espion global : chaque outil tourne sur le corpus, et toute adresse remise
// au `fetch` doit porter un hôte de la liste blanche.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { connect, corpusFetch, expectOnlyAllowedHosts } from "./_harness.js";
import { FIXED_NOW, posting, site } from "./_corpus.js";

describe("l'espion sur la couche HTTP", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ne laisse partir aucune requête hors de api.lever.co et api.eu.lever.co", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    await harness.call("resolve_company", { name: "Acme Robotics" });
    await harness.call("search_jobs", { companies: ["acmerobotics"], limit: 25 });
    await harness.call("get_job", {
      company_slug: "acmerobotics",
      job_id: posting("no_salary").id,
    });
    await harness.call("list_filter_values", { company_slug: "acmerobotics" });
    await harness.close();

    expect(stub.calls.length).toBeGreaterThan(0);
    expectOnlyAllowedHosts(stub);
  });

  it("ne demande jamais jobs.lever.co, dont hostedUrl et applyUrl portent l'adresse", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const searched = await harness.call("search_jobs", { companies: ["acmerobotics"] });
    const read = await harness.call("get_job", {
      company_slug: "acmerobotics",
      job_id: posting("recent").id,
    });
    await harness.close();

    expect(stub.urls().some((u) => u.includes("jobs.lever.co"))).toBe(false);
    expect(searched.text).toContain("https://jobs.lever.co/acmerobotics/");
    expect(read.text).toContain("https://jobs.lever.co/acmerobotics/");
  });

  it("interroge les deux instances sans jamais viser un troisième hôte", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    await harness.call("resolve_company", { name: "Zephyr Works" });
    await harness.close();

    expect(new Set(stub.hosts())).toEqual(new Set(["api.lever.co", "api.eu.lever.co"]));
  });

  it("lit chaque site du corpus sans quitter la liste blanche", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    for (const entry of site("acmerobotics").postings.slice(0, 3)) {
      await harness.call("get_job", { company_slug: "acmerobotics", job_id: entry.id });
    }
    await harness.close();

    expectOnlyAllowedHosts(stub);
  });
});
