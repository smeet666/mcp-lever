// Les lectures : la liste, l'annonce seule, les regroupements.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { listPostings, getPosting, listGroups } from "../../src/lever/postings.js";
import { Client } from "../../src/lever/client.js";
import { codeOfRejection, corpusFetch, settle } from "./_harness.js";
import { FIXED_NOW, posting, site } from "./_corpus.js";

describe("la lecture d'une liste d'offres", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rend null quand le site est inconnu sur cette instance", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    const read = await settle(listPostings({ slug: "nimbus", instance: "global" }, client));

    expect(read.data).toBeNull();
  });

  it("rend un tableau vide quand le site existe et ne publie rien", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    const read = await settle(listPostings({ slug: "quietstudio", instance: "global" }, client));

    expect(read.data).toEqual([]);
  });

  it("ne confond jamais le site inconnu et le site sans offre", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    const inconnu = await settle(listPostings({ slug: "nimbus", instance: "global" }, client));
    const sansOffre = await settle(
      listPostings({ slug: "quietstudio", instance: "global" }, client),
    );

    expect(inconnu.data).toBeNull();
    expect(sansOffre.data).not.toBeNull();
    expect(sansOffre.data).toHaveLength(0);
  });

  it("envoie toujours limit, même quand l'appelant n'en donne pas", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    await settle(listPostings({ slug: "acmerobotics", instance: "global" }, client));

    const asked = new URL(stub.urls()[0] as string);
    expect(asked.searchParams.get("limit")).not.toBeNull();
    expect(Number(asked.searchParams.get("limit"))).toBeGreaterThan(0);
  });

  it("envoie le limit demandé quand l'appelant en donne un", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    await settle(listPostings({ slug: "acmerobotics", instance: "global", limit: 5 }, client));

    const asked = new URL(stub.urls()[0] as string);
    expect(asked.searchParams.get("limit")).toBe("5");
    expect(stub.calls).toHaveLength(1);
  });

  it("rend les offres du site lu, dans une enveloppe Read", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    const read = await settle(
      listPostings({ slug: "acmerobotics", instance: "global", limit: 100 }, client),
    );

    expect(read.data).toHaveLength(site("acmerobotics").postings.length);
    expect(read.cached).toBe(false);
  });

  it("lit l'instance européenne sur api.eu.lever.co", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    const read = await settle(listPostings({ slug: "zephyrworks", instance: "eu" }, client));

    expect(read.data).not.toBeNull();
    expect(new URL(stub.urls()[0] as string).hostname).toBe("api.eu.lever.co");
  });
});

describe("la lecture d'une annonce seule", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rend l'offre demandée", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });
    const wanted = posting("salary_year");

    const read = await settle(getPosting("acmerobotics", wanted.id, "global", client));

    expect(read.data.id).toBe(wanted.id);
    expect(read.data.text).toBe(wanted.text);
  });

  it("rend not_found sur un identifiant d'offre inconnu", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    const code = await codeOfRejection(() =>
      getPosting("acmerobotics", "00000000-0000-4000-8000-000000000000", "global", client),
    );

    expect(code).toBe("not_found");
  });
});

describe("la lecture d'un vocabulaire", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rend les catégories d'un regroupement", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    const read = await settle(listGroups("acmerobotics", "global", "team", client));

    expect(read.data.map((g) => g.title)).toContain("Engineering");
    expect(new URL(stub.urls()[0] as string).searchParams.get("group")).toBe("team");
  });
});
