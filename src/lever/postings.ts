import { DEFAULT_LIMIT, INSTANCE_BASE, MAX_LIMIT } from "./config.js";
import { invalidInput, isLeverError, notFound } from "./errors.js";

/** A name made of dots addresses the parent route rather than a board. */
function assertSiteName(slug: string): void {
  if (!/[\p{L}\p{N}]/u.test(slug)) {
    throw invalidInput(
      `"${slug}" carries no letter or digit, so it names no Lever site and would address a route this server never meant to read.`,
    );
  }
}
import type { Instance, RawGroup, RawPosting, Read } from "../types.js";

/** What these functions need: a reader that already paces, caches and validates. */
export interface Requester {
  read<T>(url: string): Promise<{ value: T; cached: boolean }>;
}

/** True for the one failure that means "this name does not exist here". */
function isMissing(error: unknown): boolean {
  return isLeverError(error) && error.code === "not_found";
}

/** An absence replayed from the cache cost no request, and says so. */
function isCached(error: unknown): boolean {
  return isLeverError(error) && error.cached === true;
}

export type GroupKey = "team" | "location" | "commitment";

export interface ListParams {
  slug: string;
  instance: Instance;
  limit?: number;
  skip?: number;
  location?: string[];
  team?: string[];
  department?: string[];
  commitment?: string[];
}

/**
 * `null` means the site name does not exist on this instance; `[]` means the
 * site exists and publishes nothing. Collapsing the two would turn a wrong
 * spelling into "this company is not hiring".
 */
export async function listPostings(
  params: ListParams,
  requester: Requester,
): Promise<Read<RawPosting[] | null>> {
  let read: { value: RawPosting[]; cached: boolean };
  try {
    read = await requester.read<RawPosting[]>(buildListUrl(params));
  } catch (error) {
    if (isMissing(error)) return { data: null, cached: isCached(error) };
    throw error;
  }
  if (!Array.isArray(read.value)) {
    throw invalidInput(`Lever answered an unexpected shape for the postings of ${params.slug}.`);
  }
  return { data: read.value, cached: read.cached };
}

export async function getPosting(
  slug: string,
  id: string,
  instance: Instance,
  requester: Requester,
): Promise<Read<RawPosting>> {
  assertSiteName(slug);
  const url = `${base(instance)}/${encodeURIComponent(slug)}/${encodeURIComponent(id)}?mode=json`;
  try {
    const { value, cached } = await requester.read<RawPosting>(url);
    return { data: value, cached };
  } catch (error) {
    if (isMissing(error))
      throw notFound(
        `Lever holds no posting ${id} on the ${slug} site of the ${instance} instance. A site name distinguishes case and a site can live on the other instance, so resolve_company shows which spelling and which instance answer.`,
      );
    throw error;
  }
}

export async function listGroups(
  slug: string,
  instance: Instance,
  group: GroupKey,
  requester: Requester,
): Promise<Read<RawGroup[]>> {
  assertSiteName(slug);
  const url = `${base(instance)}/${encodeURIComponent(slug)}?mode=json&group=${encodeURIComponent(group)}`;
  try {
    const { value, cached } = await requester.read<RawGroup[]>(url);
    return { data: Array.isArray(value) ? value : [], cached };
  } catch (error) {
    if (isMissing(error)) {
      throw notFound(`Lever holds no site named ${slug} on the ${instance} instance.`);
    }
    throw error;
  }
}

/** Confirms a site name exists. `site` is null when it does not. */
export async function probeSite(
  slug: string,
  instance: Instance,
  requester: Requester,
): Promise<{ site: { publishes: boolean } | null; cached: boolean }> {
  const read = await listPostings({ slug, instance, limit: 1 }, requester);
  if (read.data === null) return { site: null, cached: read.cached };
  return { site: { publishes: read.data.length > 0 }, cached: read.cached };
}

export function buildListUrl(params: ListParams): string {
  assertSiteName(params.slug);
  const query = new URLSearchParams();
  query.set("mode", "json");
  // A request without a limit returns the whole board, which has weighed 48 MB.
  query.set("limit", String(clampLimit(params.limit)));
  if (params.skip !== undefined && params.skip > 0) query.set("skip", String(params.skip));
  for (const key of ["location", "team", "department", "commitment"] as const) {
    for (const value of params[key] ?? []) query.append(key, value);
  }
  return `${base(params.instance)}/${encodeURIComponent(params.slug)}?${query.toString()}`;
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw invalidInput(
      `limit accepts a whole number from 1 to ${MAX_LIMIT}, and received ${limit}.`,
    );
  }
  return limit;
}

function base(instance: Instance): string {
  return INSTANCE_BASE[instance] ?? INSTANCE_BASE.global;
}
