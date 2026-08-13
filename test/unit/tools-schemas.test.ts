// Les schémas déclarés, et la sortie qui doit s'y conformer.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { connect, corpusFetch } from "./_harness.js";
import { FIXED_NOW, posting } from "./_corpus.js";
import { validate } from "./_schema.js";

const ORDRE = ["resolve_company", "search_jobs", "get_job", "list_filter_values"];

describe("les outils déclarés", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enregistre les quatre outils dans un ordre déterministe", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const first = await harness.listTools();
    const second = await harness.listTools();
    await harness.close();

    expect(first.map((t) => t.name)).toEqual(ORDRE);
    expect(second.map((t) => t.name)).toEqual(ORDRE);
  });

  it("déclare un outputSchema sur chaque outil", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const tools = await harness.listTools();
    await harness.close();

    for (const tool of tools) {
      expect(tool.outputSchema, `${tool.name} sans outputSchema`).toBeDefined();
      expect((tool.outputSchema as unknown as Record<string, unknown>)["type"]).toBe("object");
    }
  });

  it("déclare additionalProperties false sur les arguments de chaque outil", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const tools = await harness.listTools();
    await harness.close();

    for (const tool of tools) {
      const schema = tool.inputSchema as unknown as Record<string, unknown>;
      expect(schema["additionalProperties"], `${tool.name} accepte des arguments inconnus`).toBe(
        false,
      );
    }
  });

  it("rend une sortie de resolve_company conforme à son schéma", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const tools = await harness.listTools();
    const outcome = await harness.call("resolve_company", { names: ["Acme Robotics"] });
    await harness.close();

    const schema = tools.find((t) => t.name === "resolve_company")?.outputSchema;
    expect(outcome.structured).toBeDefined();
    expect(validate(outcome.structured, schema as unknown as Record<string, unknown>)).toEqual([]);
  });

  it("rend une sortie de search_jobs conforme à son schéma", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const tools = await harness.listTools();
    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      limit: 100,
    });
    await harness.close();

    const schema = tools.find((t) => t.name === "search_jobs")?.outputSchema;
    expect(outcome.structured).toBeDefined();
    expect(validate(outcome.structured, schema as unknown as Record<string, unknown>)).toEqual([]);
  });

  it("rend une sortie de search_jobs conforme quand une entreprise est en panne", async () => {
    const stub = corpusFetch({ fail: { brokenco: { status: 500 } } });
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const tools = await harness.listTools();
    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics", "brokenco", "Mitek Systems", "quietstudio"],
      limit: 100,
    });
    await harness.close();

    const schema = tools.find((t) => t.name === "search_jobs")?.outputSchema;
    expect(validate(outcome.structured, schema as unknown as Record<string, unknown>)).toEqual([]);
  });

  it("rend une sortie de get_job conforme à son schéma", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const tools = await harness.listTools();
    const outcome = await harness.call("get_job", {
      company_slug: "acmerobotics",
      job_id: posting("html_entities").id,
    });
    await harness.close();

    const schema = tools.find((t) => t.name === "get_job")?.outputSchema;
    expect(outcome.structured).toBeDefined();
    expect(validate(outcome.structured, schema as unknown as Record<string, unknown>)).toEqual([]);
  });

  it("rend une sortie de get_job conforme pour une offre sans salaire ni rubrique", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const tools = await harness.listTools();
    const outcome = await harness.call("get_job", {
      company_slug: "acmerobotics",
      job_id: posting("empty_lists").id,
    });
    await harness.close();

    const schema = tools.find((t) => t.name === "get_job")?.outputSchema;
    expect(validate(outcome.structured, schema as unknown as Record<string, unknown>)).toEqual([]);
  });

  it("rend une sortie de list_filter_values conforme à son schéma", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const tools = await harness.listTools();
    const outcome = await harness.call("list_filter_values", {
      company_slug: "acmerobotics",
    });
    await harness.close();

    const schema = tools.find((t) => t.name === "list_filter_values")?.outputSchema;
    expect(outcome.structured).toBeDefined();
    expect(validate(outcome.structured, schema as unknown as Record<string, unknown>)).toEqual([]);
  });

  it("rend le vocabulaire réel du site, avec un compte par valeur", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("list_filter_values", {
      company_slug: "acmerobotics",
      fields: ["team"],
    });
    await harness.close();

    const fields = outcome.structured?.["fields"] as Record<string, { value: string; count: number }[]>;
    const engineering = fields["team"]?.find((v) => v.value === "Engineering");
    expect(engineering?.count).toBeGreaterThan(0);
  });

  it("ne lit qu'un regroupement quand un seul champ est demandé", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    await harness.call("list_filter_values", { company_slug: "acmerobotics", fields: ["team"] });
    await harness.close();

    const groupes = stub
      .urls()
      .map((u) => new URL(u).searchParams.get("group"))
      .filter((g): g is string => g !== null);
    expect(groupes).toEqual(["team"]);
  });
});
