import {
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  REQUEST_TIMEOUT_MS,
  USER_AGENT,
  resolveInterval,
} from "./config.js";
import type { ClientOptions } from "./config.js";
import type { Instance, RawGroup, RawPosting, Read, Resolution } from "../types.js";
import { Cache } from "./cache.js";
import { isLeverError } from "./errors.js";
import { getJson, type HttpOptions } from "./http.js";
import { getPosting, listGroups, listPostings } from "./postings.js";
import type { GroupKey, ListParams } from "./postings.js";
import { RateLimiter } from "./rateLimiter.js";
import { nearestKnown, resolveCompany } from "./resolve.js";

/**
 * The published low-level client: pacing, cache and error taxonomy, with no
 * protocol attached. The interval it accepts widens the published floor and
 * never narrows it.
 */
export class Client {
  private readonly http: HttpOptions;
  private readonly limiter: RateLimiter;
  private readonly documents: Cache<unknown>;
  private readonly resolutions: Cache<Resolution>;
  private readonly inFlight = new Map<string, Promise<unknown>>();
  /** Site names Lever confirmed during this session, and nothing else. */
  private readonly confirmed = new Set<string>();

  constructor(options: ClientOptions = {}) {
    this.http = {
      timeoutMs: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
      userAgent: USER_AGENT,
      fetchImpl: options.fetchImpl ?? globalThis.fetch,
    };
    this.limiter = new RateLimiter(resolveInterval(options.minIntervalMs));
    const ttl = options.cacheTtlMs ?? CACHE_TTL_MS;
    this.documents = new Cache<unknown>(ttl, CACHE_MAX_ENTRIES);
    this.resolutions = new Cache<Resolution>(ttl, CACHE_MAX_ENTRIES);
  }

  /** Every read goes through here, so the allowlist and the pacing are unavoidable. */
  async read<T>(url: string): Promise<{ value: T; cached: boolean }> {
    const hit = this.documents.get(url);
    // An absence is cached like anything else: resolving one company probes up
    // to eight addresses, and re-asking for the same missing one costs a second.
    if (isLeverError(hit)) {
      throw Object.assign(hit, { cached: true });
    }
    if (hit !== undefined) {
      return { value: hit as T, cached: true };
    }

    // Two concurrent reads of one address are one read: the published client is
    // an ordinary library, and a consumer resolving in parallel would otherwise
    // pay each shared address twice.
    const pending = this.inFlight.get(url);
    if (pending) {
      return { value: (await pending) as T, cached: true };
    }

    try {
      const run = this.limiter.schedule(() => getJson<T>(url, this.http)).then((r) => r.body);
      this.inFlight.set(url, run);
      const body = await run;
      this.documents.set(url, body);
      return { value: body, cached: false };
    } catch (error) {
      if (isLeverError(error)) {
        if (error.code === "not_found") {
          this.documents.set(url, error);
        }
        error.cached = false;
        // Lever named a delay, so the next departure waits it out rather than
        // walking straight back into the wall.
        if (error.code === "rate_limited" && error.retryAfterMs) {
          this.limiter.pause(error.retryAfterMs);
        }
      }
      throw error;
    } finally {
      this.inFlight.delete(url);
    }
  }

  async resolveCompany(name: string): Promise<Resolution> {
    const key = name.trim();
    const hit = this.resolutions.get(key);
    if (hit) {
      return { ...hit, cached: true };
    }
    const resolution = await resolveCompany(name, this);
    for (const site of resolution.found) {
      this.confirmed.add(site.slug);
    }
    this.resolutions.set(key, resolution);
    return resolution;
  }

  /** A confirmed site name close to one that did not answer, when there is one. */
  suggestSlug(name: string): string | undefined {
    return nearestKnown(name, this.confirmed);
  }

  listPostings(params: ListParams): Promise<Read<RawPosting[] | null>> {
    return listPostings(params, this);
  }

  getPosting(slug: string, id: string, instance: Instance): Promise<Read<RawPosting>> {
    return getPosting(slug, id, instance, this);
  }

  listGroups(slug: string, instance: Instance, group: GroupKey): Promise<Read<RawGroup[]>> {
    return listGroups(slug, instance, group, this);
  }
}

export type { ClientOptions } from "./config.js";
export type { GroupKey, ListParams } from "./postings.js";
