// La traduction des pannes. Six codes, et aucune panne rendue comme une liste
// vide.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getJson } from "../../src/lever/http.js";
import { Client } from "../../src/lever/client.js";
import { codeOfRejection, settle } from "./_harness.js";
import { FIXED_NOW } from "./_corpus.js";

const URL_UNDER_TEST = "https://api.lever.co/v0/postings/acmerobotics?limit=25";

const options = (fetchImpl: typeof fetch, timeoutMs = 10_000) => ({
  timeoutMs,
  userAgent: "mcp-lever/0.1.0 (+https://github.com/smeet666/mcp-lever)",
  fetchImpl,
});

const respondWith = (status: number, body: string): typeof fetch =>
  (async () =>
    new Response(body, {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;

const cutConnection: typeof fetch = (async () => {
  throw new TypeError("fetch failed");
}) as unknown as typeof fetch;

const neverAnswers: typeof fetch = (async (_input: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) {
      return;
    }
    signal.addEventListener("abort", () => {
      const abort = new Error("The operation was aborted.");
      abort.name = "AbortError";
      reject(abort);
    });
  })) as unknown as typeof fetch;

describe("la traduction des pannes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rend not_found sur un 404", async () => {
    const code = await codeOfRejection(() =>
      getJson(
        URL_UNDER_TEST,
        options(respondWith(404, JSON.stringify({ ok: false, error: "Document not found" }))),
      ),
    );
    expect(code).toBe("not_found");
  });

  it("rend rate_limited sur un 429", async () => {
    const code = await codeOfRejection(() =>
      getJson(URL_UNDER_TEST, options(respondWith(429, "{}"))),
    );
    expect(code).toBe("rate_limited");
  });

  it("rend network_error sur un 500", async () => {
    const code = await codeOfRejection(() =>
      getJson(URL_UNDER_TEST, options(respondWith(500, "{}"))),
    );
    expect(code).toBe("network_error");
  });

  it("rend network_error sur un 503", async () => {
    const code = await codeOfRejection(() =>
      getJson(URL_UNDER_TEST, options(respondWith(503, "{}"))),
    );
    expect(code).toBe("network_error");
  });

  it("rend network_error sur une coupure", async () => {
    const code = await codeOfRejection(() => getJson(URL_UNDER_TEST, options(cutConnection)));
    expect(code).toBe("network_error");
  });

  it("rend parse_failure sur une charge illisible", async () => {
    const code = await codeOfRejection(() =>
      getJson(URL_UNDER_TEST, options(respondWith(200, "<html>pas du json</html>"))),
    );
    expect(code).toBe("parse_failure");
  });

  it("rend timeout quand la réponse n'arrive pas dans le délai", async () => {
    const code = await codeOfRejection(() => getJson(URL_UNDER_TEST, options(neverAnswers, 5_000)));
    expect(code).toBe("timeout");
  });

  it("ne rend jamais une liste vide à la place d'une panne", async () => {
    const pannes: [string, typeof fetch][] = [
      ["404", respondWith(404, JSON.stringify({ ok: false, error: "Document not found" }))],
      ["429", respondWith(429, "{}")],
      ["500", respondWith(500, "{}")],
      ["coupure", cutConnection],
      ["charge illisible", respondWith(200, "<html/>")],
    ];

    for (const [nom, fetchImpl] of pannes) {
      let resolved: unknown = Symbol("aucune valeur");
      try {
        resolved = await settle(getJson(URL_UNDER_TEST, options(fetchImpl)));
      } catch {
        continue;
      }
      expect.unreachable(`${nom} a rendu ${JSON.stringify(resolved)} au lieu de lever`);
    }
  });

  it("fait remonter le code d'une panne jusqu'au client, sans liste vide", async () => {
    const client = new Client({ fetchImpl: respondWith(500, "{}") });
    const code = await codeOfRejection(() =>
      client.listPostings({ slug: "acmerobotics", instance: "global" }),
    );
    expect(code).toBe("network_error");
  });

  it("fait remonter un 429 jusqu'au client", async () => {
    const client = new Client({ fetchImpl: respondWith(429, "{}") });
    const code = await codeOfRejection(() =>
      client.getPosting("acmerobotics", "6f97a19f-c047-426e-9237-9c67829eacbf", "global"),
    );
    expect(code).toBe("rate_limited");
  });
});
