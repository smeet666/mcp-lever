import type {
  Instance,
  JobRecord,
  JobRow,
  JobSection,
  RawPosting,
  Salary,
} from "../types.js";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

/** Lever ships list bodies with HTML entities, so rendering them raw shows markup. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code = body.startsWith("#x") || body.startsWith("#X")
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      // A lone surrogate is half a character, so the entity stays as written.
      const usable =
        Number.isFinite(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
      return usable ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * Turns published HTML into text.
 *
 * Entities are decoded first and tags removed second: the other order lets an
 * escaped tag survive the tag pass and come back as markup.
 */
function toText(html: string): string {
  return decodeEntities(html).replace(/<[^>]*>/g, " ");
}

function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The items of one Lever list block, as text. */
export function listItems(content: string): string[] {
  const matches = [...content.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
  const bodies = matches.length > 0 ? matches.map((m) => m[1] ?? "") : [content];
  return bodies.map((body) => tidy(toText(body))).filter((t) => t !== "");
}

/**
 * Text published by a company must not be able to imitate a line this server
 * writes, so a third-party line opening with one of those prefixes is indented.
 */
export function safeLine(text: string): string {
  // A newline inside a title or a heading would open a line of its own, and a
  // line of its own is all it takes to look like a line this server wrote.
  return indentMarkerLines(text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim());
}

export function indentMarkerLines(text: string): string {
  return text
    .split("\n")
    .map((line) => (/^\s*(Note|Source):/i.test(line) ? ` ${line}` : line))
    .join("\n");
}

function toSalary(posting: RawPosting): Salary | null {
  const range = posting.salaryRange;
  if (!range) return null;
  // Rendered as published: the interval carries the period, so no amount is
  // ever annualised and no currency is ever converted.
  return {
    min: range.min,
    max: range.max,
    currency: range.currency,
    interval: range.interval,
  };
}

export function toRow(posting: RawPosting, slug: string, instance: Instance): JobRow {
  const categories = posting.categories ?? { location: "", team: "", allLocations: [] };
  const row: JobRow = {
    id: posting.id,
    title: posting.text,
    company_slug: slug,
    instance,
    location: categories.location,
    all_locations: categories.allLocations ?? [],
    country: posting.country ?? null,
    workplace_type: posting.workplaceType,
    team: categories.team,
    salary: toSalary(posting),
    posted_at: new Date(posting.createdAt).toISOString(),
    url: posting.hostedUrl,
    apply_url: posting.applyUrl,
  };
  // A site that does not classify a posting leaves the key out, and so do we:
  // an absent key says "not recorded", where null would say "recorded as none".
  if (categories.commitment !== undefined) row.commitment = categories.commitment;
  if (categories.department !== undefined) row.department = categories.department;
  return row;
}

export function toRecord(posting: RawPosting, slug: string, instance: Instance): JobRecord {
  const sections: JobSection[] = (posting.lists ?? [])
    .map((list) => ({
      heading: tidy(toText(list.text)),
      items: listItems(list.content),
    }))
    .filter((section) => section.heading !== "" || section.items.length > 0);

  const note = posting.salaryDescriptionPlain?.trim();

  return {
    ...toRow(posting, slug, instance),
    // `openingPlain` is empty on 57% of postings, so the description reads from
    // `descriptionPlain`, which carries the whole advert.
    description: indentMarkerLines((posting.descriptionPlain ?? "").trim()),
    sections: sections.map((s) => ({
      heading: s.heading,
      items: s.items.map(indentMarkerLines),
    })),
    salary_note: note ? indentMarkerLines(note) : null,
    source: {
      site: "Lever",
      retrieved_from: `${instance === "eu" ? "https://api.eu.lever.co" : "https://api.lever.co"}/v0/postings/${slug}/${posting.id}`,
    },
  };
}
