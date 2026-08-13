// La liste blanche d'hôtes. Le serveur ne lit que `api.lever.co` et
// `api.eu.lever.co`, et le refus tombe avant l'ouverture de la connexion.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { assertAllowedUrl, isAllowedHost } from "../../src/lever/hosts.js";
import { getJson } from "../../src/lever/http.js";
import { forbiddenFetch, codeOfThrow, codeOfRejection, settle } from "./_harness.js";
import { FIXED_NOW } from "./_corpus.js";

const httpOptions = (fetchImpl: typeof fetch) => ({
  timeoutMs: 10_000,
  userAgent: "mcp-lever/0.1.0 (+https://github.com/smeet666/mcp-lever)",
  fetchImpl,
});

describe("la liste blanche d'hôtes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepte api.lever.co", () => {
    expect(isAllowedHost("https://api.lever.co/v0/postings/acmerobotics")).toBe(true);
    expect(() => assertAllowedUrl("https://api.lever.co/v0/postings/acmerobotics")).not.toThrow();
  });

  it("accepte api.eu.lever.co", () => {
    expect(isAllowedHost("https://api.eu.lever.co/v0/postings/zephyrworks")).toBe(true);
    expect(() => assertAllowedUrl("https://api.eu.lever.co/v0/postings/zephyrworks")).not.toThrow();
  });

  it("accepte un hôte autorisé écrit en casse mixte, que l'adresse normalise", () => {
    expect(isAllowedHost("https://API.Lever.CO/v0/postings/acmerobotics")).toBe(true);
  });

  it("refuse jobs.lever.co avec invalid_input", () => {
    expect(isAllowedHost("https://jobs.lever.co/acmerobotics")).toBe(false);
    expect(codeOfThrow(() => assertAllowedUrl("https://jobs.lever.co/acmerobotics"))).toBe(
      "invalid_input",
    );
  });

  it("refuse jobs.lever.co écrit en casse mixte", () => {
    expect(codeOfThrow(() => assertAllowedUrl("https://JOBS.Lever.CO/acmerobotics"))).toBe(
      "invalid_input",
    );
  });

  it("refuse jobs.lever.co porté par un port explicite", () => {
    expect(codeOfThrow(() => assertAllowedUrl("https://jobs.lever.co:443/acmerobotics"))).toBe(
      "invalid_input",
    );
  });

  it("refuse un sous-domaine qui préfixe un hôte autorisé", () => {
    expect(isAllowedHost("https://api.lever.co.attacker.test/v0/postings/x")).toBe(false);
    expect(codeOfThrow(() => assertAllowedUrl("https://api.lever.co.attacker.test/v0/postings/x"))).toBe(
      "invalid_input",
    );
  });

  it("refuse une adresse dont le chemin seul imite un hôte autorisé", () => {
    expect(isAllowedHost("https://evil.test/api.lever.co/v0/postings/x")).toBe(false);
    expect(
      codeOfThrow(() => assertAllowedUrl("https://evil.test/api.lever.co/v0/postings/x")),
    ).toBe("invalid_input");
  });

  it("refuse un hôte autorisé placé en partie d'authentification", () => {
    expect(isAllowedHost("https://api.lever.co@evil.test/v0/postings/x")).toBe(false);
    expect(codeOfThrow(() => assertAllowedUrl("https://api.lever.co@evil.test/v0/postings/x"))).toBe(
      "invalid_input",
    );
  });

  it("refuse une chaîne qui n'est pas une adresse absolue", () => {
    expect(isAllowedHost("/v0/postings/acmerobotics")).toBe(false);
    expect(codeOfThrow(() => assertAllowedUrl("/v0/postings/acmerobotics"))).toBe("invalid_input");
  });

  it("refuse une adresse hors liste sans ouvrir la connexion", async () => {
    const stub = forbiddenFetch();
    const code = await codeOfRejection(() =>
      getJson("https://jobs.lever.co/acmerobotics", httpOptions(stub.fetchImpl)),
    );
    expect(code).toBe("invalid_input");
    expect(stub.calls).toHaveLength(0);
  });

  it("refuse un hôte trompeur sans ouvrir la connexion", async () => {
    const stub = forbiddenFetch();
    const code = await codeOfRejection(() =>
      getJson("https://api.lever.co.attacker.test/v0/postings/x", httpOptions(stub.fetchImpl)),
    );
    expect(code).toBe("invalid_input");
    expect(stub.calls).toHaveLength(0);
  });

  it("envoie un User-Agent qui nomme le projet et n'imite aucun navigateur", async () => {
    const seen: Record<string, string>[] = [];
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers as HeadersInit);
      const collected: Record<string, string> = {};
      headers.forEach((v, k) => {
        collected[k.toLowerCase()] = v;
      });
      seen.push(collected);
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;

    await settle(
      getJson("https://api.lever.co/v0/postings/acmerobotics?limit=25", httpOptions(fetchImpl)),
    );

    expect(seen).toHaveLength(1);
    const agent = seen[0]?.["user-agent"] ?? "";
    expect(agent).toContain("mcp-lever");
    expect(agent).not.toMatch(/Mozilla/i);
    expect(agent).not.toMatch(/Chrome/i);
    expect(agent).not.toMatch(/Safari/i);
  });
});
