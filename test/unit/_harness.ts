// Le gréement des tests : un `fetch` simulé qui sert le corpus engendré, un
// serveur MCP branché sur un transport en mémoire, et l'avance d'horloge que le
// rythme d'une seconde impose.
//
// Aucun appel réseau réel ne part d'ici, et aucune durée réelle ne se mesure.

import { vi, expect } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { createServer } from "../../src/server.js";
import { corpus, type RawGroup, type RawPosting } from "./_corpus.js";

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  startedAt: number;
}

export type Failure = { status: number } | { kind: "network" } | { kind: "invalid-json" };

export interface StubOptions {
  /** Sites que le corpus porte mais que l'instance doit ignorer, par `slug@instance`. */
  hide?: string[];
  /** Pannes à provoquer, par `slug` ou par `slug@instance`. */
  fail?: Record<string, Failure>;
}

export interface FetchStub {
  fetchImpl: typeof fetch;
  calls: RecordedCall[];
  urls: () => string[];
  hosts: () => string[];
}

const INSTANCE_BY_HOST: Record<string, "global" | "eu"> = {
  "api.lever.co": "global",
  "api.eu.lever.co": "eu",
};

function headersOf(init?: RequestInit): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = init?.headers;
  if (!raw) return out;
  if (Array.isArray(raw)) {
    for (const [k, v] of raw) out[String(k).toLowerCase()] = String(v);
  } else if (typeof (raw as Headers).forEach === "function") {
    (raw as Headers).forEach((v, k) => {
      out[k.toLowerCase()] = v;
    });
  } else {
    for (const [k, v] of Object.entries(raw as Record<string, string>)) {
      out[k.toLowerCase()] = String(v);
    }
  }
  return out;
}

function groupsOf(postings: RawPosting[], key: "team" | "location" | "commitment"): RawGroup[] {
  const buckets = new Map<string, RawPosting[]>();
  for (const p of postings) {
    const values =
      key === "location" ? p.categories.allLocations : [p.categories[key] as string | undefined];
    for (const value of values) {
      if (value === undefined) continue;
      const list = buckets.get(value) ?? [];
      list.push(p);
      buckets.set(value, list);
    }
  }
  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([title, ps]) => ({ title, postings: ps }));
}

function matchesFilters(p: RawPosting, params: URLSearchParams): boolean {
  const exact = (values: string[], candidates: (string | undefined)[]) =>
    values.length === 0 || values.some((v) => candidates.includes(v));
  return (
    exact(params.getAll("team"), [p.categories.team]) &&
    exact(params.getAll("department"), [p.categories.department]) &&
    exact(params.getAll("commitment"), [p.categories.commitment]) &&
    exact(params.getAll("location"), [p.categories.location, ...p.categories.allLocations])
  );
}

const notFound = () =>
  new Response(JSON.stringify({ ok: false, error: "Document not found" }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });

/** Un `fetch` qui sert le corpus sur les deux instances autorisées. */
export function corpusFetch(options: StubOptions = {}): FetchStub {
  const calls: RecordedCall[] = [];
  const hidden = new Set(options.hide ?? []);

  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers: headersOf(init),
      startedAt: Date.now(),
    });

    const parsed = new URL(url);
    const instance = INSTANCE_BY_HOST[parsed.hostname];
    if (!instance) throw new Error(`hôte hors liste blanche demandé au fetch : ${parsed.hostname}`);

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments[0] !== "v0" || segments[1] !== "postings") return notFound();
    const slug = segments[2];
    if (!slug) return notFound();
    const jobId = segments[3];

    const failure = options.fail?.[`${slug}@${instance}`] ?? options.fail?.[slug];
    if (failure) {
      if ("kind" in failure && failure.kind === "network") throw new TypeError("fetch failed");
      if ("kind" in failure && failure.kind === "invalid-json") {
        return new Response("<html>not json</html>", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if ("status" in failure) {
        return new Response(JSON.stringify({ ok: false, error: "upstream" }), {
          status: failure.status,
          headers: { "content-type": "application/json" },
        });
      }
    }

    if (hidden.has(`${slug}@${instance}`)) return notFound();
    const site = corpus.sites.find((s) => s.slug === slug && s.instance === instance);
    if (!site) return notFound();

    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    if (jobId) {
      const one = site.postings.find((p) => p.id === jobId);
      return one ? json(one) : notFound();
    }

    const group = parsed.searchParams.get("group");
    if (group === "team" || group === "location" || group === "commitment") {
      return json(groupsOf(site.postings, group));
    }

    const kept = site.postings.filter((p) => matchesFilters(p, parsed.searchParams));
    const skip = Number(parsed.searchParams.get("skip") ?? "0");
    const limitParam = parsed.searchParams.get("limit");
    const limit = limitParam === null ? kept.length : Number(limitParam);
    return json(kept.slice(skip, skip + limit));
  };

  return {
    fetchImpl: impl as unknown as typeof fetch,
    calls,
    urls: () => calls.map((c) => c.url),
    hosts: () => calls.map((c) => new URL(c.url).hostname),
  };
}

/** Un `fetch` qui n'est jamais censé partir : tout appel fait échouer le test. */
export function forbiddenFetch(): FetchStub {
  const calls: RecordedCall[] = [];
  const impl = async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, method: "GET", headers: {}, startedAt: Date.now() });
    throw new Error(`connexion ouverte alors que le test l'interdit : ${url}`);
  };
  return {
    fetchImpl: impl as unknown as typeof fetch,
    calls,
    urls: () => calls.map((c) => c.url),
    hosts: () => calls.map((c) => new URL(c.url).hostname),
  };
}

/**
 * Fait avancer l'horloge simulée jusqu'à ce que la promesse se dénoue. Le rythme
 * impose une seconde entre deux départs, donc une lecture attend des minuteurs.
 */
export async function settle<T>(promise: Promise<T>, maxSteps = 400): Promise<T> {
  let done = false;
  const watched = promise.then(
    (v) => {
      done = true;
      return v;
    },
    (e) => {
      done = true;
      throw e;
    },
  );
  watched.catch(() => undefined);
  for (let i = 0; i < maxSteps && !done; i += 1) {
    await vi.advanceTimersByTimeAsync(1000);
  }
  return watched;
}

export interface ToolOutcome {
  ok: boolean;
  structured: Record<string, unknown> | undefined;
  text: string;
}

export interface Harness {
  mcp: McpClient;
  listTools: () => Promise<{ name: string; inputSchema: unknown; outputSchema: unknown }[]>;
  call: (name: string, args: Record<string, unknown>) => Promise<ToolOutcome>;
  close: () => Promise<void>;
}

/**
 * Branche le serveur sur un transport en mémoire et rend de quoi l'interroger.
 * Le `fetch` simulé entre par les options du client, comme `ClientOptions` le
 * prévoit.
 */
export async function connect(clientOptions: Record<string, unknown>): Promise<Harness> {
  const server = await (createServer as (o: Record<string, unknown>) => unknown)(clientOptions);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const mcp = new McpClient({ name: "mcp-lever-tests", version: "0.0.0" });
  await Promise.all([
    (server as { connect: (t: unknown) => Promise<void> }).connect(serverSide),
    mcp.connect(clientSide),
  ]);

  const timeout = { timeout: 3_600_000 };

  return {
    mcp,
    listTools: async () => {
      const listed = await settle(mcp.listTools(undefined, timeout));
      return listed.tools as unknown as {
        name: string;
        inputSchema: unknown;
        outputSchema: unknown;
      }[];
    },
    call: async (name, args) => {
      try {
        const result = await settle(
          mcp.callTool({ name, arguments: args }, undefined, timeout) as Promise<
            Record<string, unknown>
          >,
        );
        const content = (result["content"] ?? []) as { type: string; text?: string }[];
        return {
          ok: result["isError"] !== true,
          structured: result["structuredContent"] as unknown as Record<string, unknown> | undefined,
          text: content
            .map((c) => c.text ?? "")
            .join("\n")
            .concat(JSON.stringify(result["structuredContent"] ?? "")),
        };
      } catch (error) {
        return { ok: false, structured: undefined, text: String((error as Error)?.message ?? error) };
      }
    },
    close: async () => {
      await mcp.close();
    },
  };
}

/** Le code d'erreur porté par ce qu'une fonction de la couche basse a levé. */
export async function codeOfRejection(run: () => Promise<unknown>): Promise<string> {
  try {
    await settle(Promise.resolve(run()));
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    return typeof code === "string" ? code : `sans code : ${String(error)}`;
  }
  throw new Error("aucune erreur levée alors que le contrat en promet une");
}

/** Le code d'erreur porté par ce qu'une fonction synchrone a levé. */
export function codeOfThrow(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    return typeof code === "string" ? code : `sans code : ${String(error)}`;
  }
  throw new Error("aucune erreur levée alors que le contrat en promet une");
}

/** Toute adresse demandée porte un hôte de la liste blanche. */
export function expectOnlyAllowedHosts(stub: FetchStub): void {
  for (const host of stub.hosts()) {
    expect(["api.lever.co", "api.eu.lever.co"]).toContain(host);
  }
}
