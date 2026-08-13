/**
 * The shapes every layer agrees on. Nothing here imports the MCP SDK, so the
 * low-level client can be consumed as an ordinary library.
 */

/** Every read reports whether it came from the cache and what it left out. */
export interface Read<T> {
  data: T;
  cached: boolean;
  skipped?: string[];
}

/** The two Lever instances. A site lives on one, and a few live on both. */
export type Instance = "global" | "eu";

/** A posting as Lever publishes it. Optional keys are absent, never null. */
export interface RawPosting {
  id: string;
  text: string;
  categories: RawCategories;
  country: string | null;
  workplaceType: string;
  createdAt: number;
  hostedUrl: string;
  applyUrl: string;
  description: string;
  descriptionPlain: string;
  descriptionBody: string;
  descriptionBodyPlain: string;
  opening: string;
  openingPlain: string;
  additional: string;
  additionalPlain: string;
  lists: RawList[];
  salaryRange?: RawSalaryRange;
  salaryDescription?: string;
  salaryDescriptionPlain?: string;
}

/** `commitment` and `department` are absent on sites that do not use them. */
export interface RawCategories {
  location: string;
  team: string;
  allLocations: string[];
  commitment?: string;
  department?: string;
}

export interface RawList {
  text: string;
  content: string;
}

/** Always four keys. `interval` carries the period, so amounts never need one. */
export interface RawSalaryRange {
  min: number;
  max: number;
  currency: string;
  interval: string;
}

/**
 * A grouping, as `group=team|location|commitment` returns it.
 *
 * `title` is absent on the group Lever fills with the openings carrying no
 * value for that field, so it names a gap rather than a wording.
 */
export interface RawGroup {
  title?: string;
  postings: RawPosting[];
}

/** The rendered row a search returns. */
export interface JobRow {
  id: string;
  title: string;
  company_slug: string;
  instance: Instance;
  location: string;
  all_locations: string[];
  country: string | null;
  workplace_type: string;
  commitment?: string;
  team: string;
  department?: string;
  salary: Salary | null;
  /** When Lever recorded the opening, in ISO 8601 UTC. */
  posted_at: string;
  url: string;
  apply_url: string;
}

/** Rendered as published: no annualising, no currency conversion. */
export interface Salary {
  min: number;
  max: number;
  currency: string;
  interval: string;
}

/** The full record a single-posting read returns. */
export interface JobRecord extends JobRow {
  description: string;
  sections: JobSection[];
  salary_note: string | null;
  source: { site: "Lever"; retrieved_from: string };
}

export interface JobSection {
  heading: string;
  items: string[];
}

/** What resolving one company name produced. */
export interface Resolution {
  input: string;
  /** Every instance that confirmed a slug. Empty when nothing answered. */
  found: ResolvedSite[];
  /** The forms actually sent, in order, so a caller can see the cost. */
  tried: string[];
  cached: boolean;
}

export interface ResolvedSite {
  slug: string;
  instance: Instance;
  /** False when the site exists and publishes nothing. */
  publishes: boolean;
}

/** Per-company outcome of a search, so an empty list is never ambiguous. */
export type CompanyStatus = "read" | "unresolved" | "empty" | "failed";

export interface CompanyOutcome {
  input: string;
  slug: string | null;
  instance: Instance | null;
  status: CompanyStatus;
  /** Openings Lever returned, before the filters applied here. */
  read: number;
  /** Openings kept after them. */
  returned: number;
  error?: string;
}
