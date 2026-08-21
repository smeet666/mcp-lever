import { INSTANCES, MAX_SLUG_FORMS } from "./config.js";
import { invalidInput } from "./errors.js";
import type { Instance, Resolution, ResolvedSite } from "../types.js";
import { probeSite, type Requester } from "./postings.js";

/**
 * The forms a company name can take as a Lever site name, most likely first.
 *
 * Lever site names distinguish case: Flex answers where flex returns 404. They
 * do not always derive from the company name either. Measured on the
 * companies Lever presents in its own case studies, the lowercase joined form
 * hits 14 times out of 18, and the remaining forms recover part of the rest.
 */
export function slugForms(name: string): string[] {
  const trimmed = name.trim();
  if (trimmed === "") return [];

  const words = trimmed.split(/[\s._/-]+/u).filter((w) => w !== "");
  const cleaned = words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).filter((w) => w !== "");
  if (cleaned.length === 0) return [];

  const joined = cleaned.join("").toLowerCase();
  const forms: string[] = [];

  // A name already shaped like a site name is tried as typed, so a caller who
  // knows the exact spelling pays one request instead of four.
  if (words.length === 1 && /^[\p{L}\p{N}]+$/u.test(trimmed)) forms.push(trimmed);

  forms.push(joined);
  forms.push(joined.charAt(0).toUpperCase() + joined.slice(1));
  forms.push((cleaned[0] ?? "").toLowerCase());
  forms.push(cleaned.map((w) => w.toLowerCase()).join("-"));

  const seen = new Set<string>();
  const unique = forms.filter((f) => f !== "" && !seen.has(f) && seen.add(f));
  return unique.slice(0, Math.max(MAX_SLUG_FORMS, 1));
}

/**
 * Probes each form on each instance and stops at the first form an instance
 * confirms, while still asking the other instance: a handful of site names live
 * on both, and electing one would hide the other.
 */
export async function resolveCompany(name: string, requester: Requester): Promise<Resolution> {
  const forms = slugForms(name);
  if (forms.length === 0) {
    throw invalidInput(
      `"${name}" carries no letter or digit, so no Lever site name can be built from it. Nothing was asked of Lever, and this says nothing about what Lever holds.`,
    );
  }
  const tried: string[] = [];
  const found: ResolvedSite[] = [];
  // A resolution costs what its probes cost, so it is cached only when every
  // one of them was.
  let everyProbeCached = true;

  for (const instance of INSTANCES) {
    for (const form of forms) {
      tried.push(`${form} (${instance})`);
      const probe = await probeSite(form, instance as Instance, requester);
      if (!probe.cached) everyProbeCached = false;
      if (probe.site) {
        found.push({
          slug: form,
          instance: instance as Instance,
          publishes: probe.site.publishes,
        });
        break;
      }
    }
  }

  return { input: name, found, tried, cached: everyProbeCached };
}

/**
 * The confirmed site name a failed spelling is closest to.
 *
 * Lever publishes no directory, so the only names this server can vouch for are
 * the ones it has already confirmed. Two edits is the widest miss that still
 * points at one name rather than at a different company.
 */
export function nearestKnown(name: string, known: Iterable<string>): string | undefined {
  const written = (slugForms(name)[0] ?? name).toLowerCase();
  let best: { slug: string; apart: number } | undefined;
  for (const slug of known) {
    const apart = editDistance(written, slug.toLowerCase());
    if (apart === 0 || apart > 2) continue;
    if (best === undefined || apart < best.apart) best = { slug, apart };
  }
  return best?.slug;
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(substitution, (previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1);
    }
    previous = current;
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}
