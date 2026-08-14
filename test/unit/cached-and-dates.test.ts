// Ce qu'une lecture dit d'elle-même : d'où vient sa date, et si elle a été
// servie par le cache plutôt que demandée.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Client } from "../../src/lever/client.js";
import { listPostings } from "../../src/lever/postings.js";
import { resolveCompany } from "../../src/lever/resolve.js";
import { connect, corpusFetch, settle } from "./_harness.js";
import { FIXED_NOW } from "./_corpus.js";

const notesOf = (structured: Record<string, unknown> | undefined): string[] =>
  (structured?.["notes"] ?? []) as string[];

describe("ce qu'une recherche par fraîcheur dit de sa date", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dit que la date est celle de l'enregistrement, la seule que Lever publie", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", {
      companies: ["acmerobotics"],
      posted_within_days: 7,
      limit: 100,
    });
    await harness.close();

    const notes = notesOf(outcome.structured).join(" ");
    expect(notes).toMatch(/recorded/i);
    expect(notes).toMatch(/republish|refresh|re-post|updated/i);
  });

  it("ne parle pas de la date quand la fraîcheur n'est pas demandée", async () => {
    const stub = corpusFetch();
    const harness = await connect({ fetchImpl: stub.fetchImpl });

    const outcome = await harness.call("search_jobs", { companies: ["acmerobotics"], limit: 5 });
    await harness.close();

    expect(notesOf(outcome.structured).join(" ")).not.toMatch(/republish|refresh/i);
  });
});

describe("ce qu'une lecture dit du cache qui l'a servie", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("déclare cachée une absence rejouée depuis le cache", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    const first = await settle(listPostings({ slug: "nimbus", instance: "global" }, client));
    const second = await settle(listPostings({ slug: "nimbus", instance: "global" }, client));

    expect(first.data).toBeNull();
    expect(first.cached).toBe(false);
    expect(second.data).toBeNull();
    expect(second.cached).toBe(true);
  });

  it("déclare cachée une résolution dont toutes les sondes venaient du cache", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    const first = await settle(resolveCompany("Acme Robotics", client));
    const second = await settle(resolveCompany("Acme Robotics", client));

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.found).toEqual(first.found);
  });

  it("déclare fraîche une résolution dont une sonde a été demandée", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    await settle(resolveCompany("Acme Robotics", client));
    const other = await settle(resolveCompany("Zephyr Works", client));

    expect(other.cached).toBe(false);
  });
});
