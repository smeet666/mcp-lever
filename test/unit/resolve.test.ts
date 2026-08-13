// La résolution d'un nom d'entreprise en identifiant de site.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { slugForms, resolveCompany } from "../../src/lever/resolve.js";
import { Client } from "../../src/lever/client.js";
import { corpusFetch, settle } from "./_harness.js";
import { FIXED_NOW } from "./_corpus.js";

describe("l'échelle des formes", () => {
  it("rend quatre formes ordonnées pour un nom de deux mots", () => {
    expect(slugForms("Basis Technologies")).toEqual([
      "basistechnologies",
      "Basistechnologies",
      "basis",
      "basis-technologies",
    ]);
  });

  it("rend moins de quatre formes pour un nom d'un seul mot", () => {
    const forms = slugForms("Mitek");
    expect(forms.length).toBeLessThan(4);
    expect(new Set(forms).size).toBe(forms.length);
  });

  it("essaie d'abord un nom déjà identifiant, sa casse conservée", () => {
    const forms = slugForms("Flex");
    expect(forms[0]).toBe("Flex");
    expect(forms).toContain("flex");
    expect(forms.indexOf("Flex")).toBeLessThan(forms.indexOf("flex"));
  });

  it("garde le premier rang quand deux règles produisent la même forme", () => {
    const forms = slugForms("Sprinto");
    expect(new Set(forms).size).toBe(forms.length);
    expect(forms[0]).toBe("Sprinto");
  });

  it("retire la ponctuation de la forme collée", () => {
    expect(slugForms("Match Group, Inc.")[0]).toBe("matchgroupinc");
  });

  it("ne demande rien au réseau", () => {
    expect(slugForms("Basis Technologies")).toHaveLength(4);
  });
});

describe("la résolution d'une entreprise", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("s'arrête à la première forme confirmée et n'essaie pas les suivantes", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    const resolution = await settle(client.resolveCompany("Acme Robotics"));

    expect(resolution.found).toContainEqual({
      slug: "acmerobotics",
      instance: "global",
      publishes: true,
    });
    const askedOnGlobal = stub
      .urls()
      .filter((u) => u.startsWith("https://api.lever.co/"))
      .map((u) => new URL(u).pathname);
    expect(askedOnGlobal).toEqual(["/v0/postings/acmerobotics"]);
  });

  it("rend deux entrées pour un site vivant sur les deux instances", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    const resolution = await settle(client.resolveCompany("Duplex Labs"));

    expect(resolution.found).toHaveLength(2);
    expect(resolution.found.map((f) => f.instance).sort()).toEqual(["eu", "global"]);
    expect(new Set(resolution.found.map((f) => f.slug))).toEqual(new Set(["duplexlabs"]));
  });

  it("rend publishes faux pour un site qui répond une liste vide", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    const resolution = await settle(client.resolveCompany("quietstudio"));

    expect(resolution.found).toHaveLength(1);
    expect(resolution.found[0]?.publishes).toBe(false);
    expect(resolution.found[0]?.slug).toBe("quietstudio");
  });

  it("distingue la casse : Nimbus répond là où nimbus ne répond pas", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    const resolution = await settle(client.resolveCompany("Nimbus"));

    expect(resolution.found.map((f) => f.slug)).toContain("Nimbus");
  });

  it("rend une liste trouvée vide et les formes essayées quand rien ne répond", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    const resolution = await settle(client.resolveCompany("Mitek Systems"));

    expect(resolution.found).toEqual([]);
    // Une entrée par requête réellement partie : les formes sont sondées sur les
    // deux instances, et `tried` doit montrer ce que la résolution a coûté.
    expect(resolution.tried).toEqual([
      ...slugForms("Mitek Systems").map((form) => `${form} (global)`),
      ...slugForms("Mitek Systems").map((form) => `${form} (eu)`),
    ]);
  });

  it("ne redemande rien pour une entreprise déjà résolue dans la session", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    await settle(client.resolveCompany("Acme Robotics"));
    const afterFirst = stub.calls.length;
    const second = await settle(client.resolveCompany("Acme Robotics"));

    expect(stub.calls.length).toBe(afterFirst);
    expect(second.found).toContainEqual({
      slug: "acmerobotics",
      instance: "global",
      publishes: true,
    });
  });

  it("ne redemande rien pour une entreprise dont aucune forme n'a répondu", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    await settle(client.resolveCompany("Mitek Systems"));
    const afterFirst = stub.calls.length;
    await settle(client.resolveCompany("Mitek Systems"));

    expect(stub.calls.length).toBe(afterFirst);
  });

  it("sonde les deux instances par la fonction autonome comme par le client", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    const resolution = await settle(resolveCompany("Zephyr Works", client));

    expect(resolution.found).toContainEqual({
      slug: "zephyrworks",
      instance: "eu",
      publishes: true,
    });
  });
});
