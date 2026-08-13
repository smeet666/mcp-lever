import type { Instance } from "../types.js";
import { PACKAGE_NAME, VERSION } from "../version.js";

/**
 * The hosts this server is allowed to read. `jobs.lever.co` is deliberately
 * absent: its robots.txt names six agents and refuses each of them, so the
 * server reads the API hosts only. `hostedUrl` and `applyUrl` point at
 * `jobs.lever.co` and travel through rendering as strings, never as requests.
 */
export const ALLOWED_HOSTS: readonly string[] = ["api.lever.co", "api.eu.lever.co"];

export const INSTANCE_BASE: Record<Instance, string> = {
  global: "https://api.lever.co/v0/postings",
  eu: "https://api.eu.lever.co/v0/postings",
};

/** Both instances are probed, so a site living on either one is found. */
export const INSTANCES: readonly Instance[] = ["global", "eu"];

/**
 * `Crawl-delay: 1` is published on both API hosts. Configuration may widen this
 * interval and never narrows it, including through the published client entry
 * point.
 */
export const MIN_INTERVAL_MS = 1000;

/** A single posting list has weighed 48 MB unbounded, so a limit is always sent. */
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

/** Each company costs at least one request and one second. */
export const DEFAULT_MAX_COMPANIES = 10;
export const MAX_COMPANIES = 25;

/** How many spellings a resolution probes per instance before giving up. */
export const MAX_SLUG_FORMS = 4;

/**
 * The most a single response may weigh. One board has answered 48 MB, and the
 * whole of it would land in memory twice, once as text and once parsed.
 */
export const MAX_BODY_BYTES = 24_000_000;

export const REQUEST_TIMEOUT_MS = 30_000;

export const CACHE_TTL_MS = 5 * 60_000;
export const CACHE_MAX_ENTRIES = 200;

export const CONTACT = "https://github.com/smeet666/mcp-lever";

/** Carries the project and a contact address, and imitates no browser. */
export const USER_AGENT = `${PACKAGE_NAME}/${VERSION} (+${CONTACT})`;

export interface ClientOptions {
  /** Widens the floor. A smaller value is ignored. */
  minIntervalMs?: number;
  timeoutMs?: number;
  cacheTtlMs?: number;
  fetchImpl?: typeof fetch;
}

export function resolveInterval(requested?: number): number {
  if (requested === undefined || !Number.isFinite(requested)) return MIN_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, requested);
}
