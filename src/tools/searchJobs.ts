import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  DEFAULT_LIMIT,
  DEFAULT_MAX_COMPANIES,
  MAX_COMPANIES,
  MAX_LIMIT,
  MAX_RECENCY_PAGES,
  MAX_SLUG_FORMS,
} from "../lever/config.js";
import { invalidInput, isLeverError, type LeverError } from "../lever/errors.js";
import type { Client } from "../lever/client.js";
import type { GroupKey } from "../lever/postings.js";
import type { CompanyOutcome, Instance, JobRow, RawPosting, ResolvedSite } from "../types.js";
import {
  amount,
  codes,
  currencyCode,
  parseArgs,
  strictInput,
  text,
  values,
  wholeNumber,
} from "./arguments.js";
import { toolFailure } from "./errorShape.js";
import { safeLine, toRow } from "./render.js";
import { searchJobsOutputShape } from "./schemas.js";

/** The period a bare salary threshold is read against, since amounts carry their own. */
const DEFAULT_SALARY_INTERVAL = "per-year-salary";

/** The fields Lever publishes a vocabulary for through `group=`. */
const GROUPED_FIELDS: readonly GroupKey[] = ["team", "location", "commitment"];

/** Resolving one name probes every spelling on both instances before it gives up. */
const WORST_REQUESTS_PER_COMPANY = MAX_SLUG_FORMS * 2 + 1;

export const searchJobsDescription =
  "Search the openings published by named companies on Lever. " +
  "`companies` takes company names or Lever site names, and each name is turned into a site name here. " +
  `A name found on the first spelling costs 3 requests, and one that resists costs up to ${WORST_REQUESTS_PER_COMPANY}, at one second each. ` +
  "location, team, department and commitment are sent to Lever and need its exact wording. " +
  "keyword, workplace_type, country, salary and recency are applied here, because Lever accepts none of them as filters. " +
  "limit applies per company, so a company whose openings fill it may publish more. " +
  `posted_within_days walks up to ${MAX_RECENCY_PAGES} pages per company, because Lever pages by title and a recent opening sits anywhere.`;

export const searchJobsSchema = strictInput({
  companies: values("companies", "a company name or a Lever site name", MAX_COMPANIES),
  keyword: text("keyword", "words to look for in the title and the advert").optional(),
  location: values("location", "a location exactly as Lever writes it", 20).optional(),
  team: values("team", "a team exactly as Lever writes it", 20).optional(),
  department: values("department", "a department exactly as Lever writes it", 20).optional(),
  commitment: values("commitment", "a commitment exactly as Lever writes it", 20).optional(),
  workplace_type: values("workplace_type", "remote, hybrid, onsite or unspecified", 4).optional(),
  country: codes("country", "a two-letter country code, as in FR or US", 20).optional(),
  salary_min: amount("salary_min", "the lowest upper bound of a salary range to keep").optional(),
  salary_interval: text(
    "salary_interval",
    `the period salary_min is written in, as Lever writes it, such as ${DEFAULT_SALARY_INTERVAL} or per-hour-wage`,
  ).optional(),
  currency: currencyCode("currency").optional(),
  posted_within_days: wholeNumber("posted_within_days", 1, 3650, "how recent an opening must be").optional(),
  limit: wholeNumber("limit", 1, MAX_LIMIT, "how many openings to read per company").optional(),
  skip: wholeNumber("skip", 0, 100_000, "how many openings to step over per company").optional(),
});

export const searchJobsInput = searchJobsSchema.shape;

export interface SearchJobsArgs {
  companies: string[];
  keyword?: string;
  location?: string[];
  team?: string[];
  department?: string[];
  commitment?: string[];
  workplace_type?: string[];
  country?: string[];
  salary_min?: number;
  salary_interval?: string;
  currency?: string;
  posted_within_days?: number;
  limit?: number;
  skip?: number;
}

interface Counters {
  keyword: number;
  workplace: number;
  country: number;
  unknownCountry: number;
  tooOld: number;
  noSalary: number;
  otherInterval: number;
  otherCurrency: number;
  belowSalary: number;
  filled: string[];
  walked: string[];
}

export async function runSearchJobs(client: Client, args: SearchJobsArgs): Promise<CallToolResult> {
  try {
    args = parseArgs(searchJobsSchema, args) as typeof args;
    refuseIdleArguments(args);

    const notes: string[] = [];
    if (args.companies.length > DEFAULT_MAX_COMPANIES) {
      notes.push(
        `${args.companies.length} companies were asked for. Each one costs between 3 and ${WORST_REQUESTS_PER_COMPANY} requests at one second apiece, so this call may run for minutes.`,
      );
    }

    const jobs: JobRow[] = [];
    const perCompany: CompanyOutcome[] = [];
    const refusals: LeverError[] = [];
    const counters: Counters = {
      keyword: 0,
      workplace: 0,
      country: 0,
      unknownCountry: 0,
      tooOld: 0,
      noSalary: 0,
      otherInterval: 0,
      otherCurrency: 0,
      belowSalary: 0,
      filled: [],
      walked: [],
    };

    for (const input of args.companies) {
      perCompany.push(await readOne(client, args, input, jobs, counters, notes, refusals));
    }

    // A wrong filter wording belongs to the caller, so a call that produced
    // nothing but refusals is refused rather than answered with an empty list.
    // A company Lever failed to serve is reported instead, and the companies
    // that answered keep their openings.
    if (refusals.length > 0 && refusals.length === perCompany.length) {
      throw refusals[0];
    }

    addFilterNotes(args, counters, notes);
    addOutcomeNotes(args, perCompany, counters, notes);

    const payload = { jobs, per_company: perCompany, total_available: null, notes };
    return {
      content: [{ type: "text", text: summarise(payload) }],
      structuredContent: payload,
    };
  } catch (error) {
    return toolFailure(error);
  }
}

/**
 * An argument that is read and dropped produces an answer computed without it,
 * which a caller reads as the answer to the question they asked.
 */
function refuseIdleArguments(args: SearchJobsArgs): void {
  if (args.salary_min !== undefined) return;
  const idle = [
    args.currency === undefined ? undefined : "currency",
    args.salary_interval === undefined ? undefined : "salary_interval",
  ].filter((name): name is string => name !== undefined);
  if (idle.length > 0) {
    throw invalidInput(
      `${idle.join(" and ")} narrows a search that also carries salary_min, and would otherwise be read and dropped. Add salary_min, or remove ${idle.join(" and ")}.`,
    );
  }
}

async function readOne(
  client: Client,
  args: SearchJobsArgs,
  input: string,
  jobs: JobRow[],
  counters: Counters,
  notes: string[],
  refusals: LeverError[],
): Promise<CompanyOutcome> {
  let site: ResolvedSite | undefined;

  try {
    const resolution = await client.resolveCompany(input);
    site = chooseSite(resolution.found, input, notes);
    if (!site) {
      const near = client.suggestSlug(input);
      notes.push(
        `No Lever site was found for "${safeLine(input)}", so nothing here says whether that company is hiring. Site names distinguish case; resolve_company shows what was tried.` +
          (near
            ? ` The site "${near}", confirmed earlier in this session, is one edit away.`
            : ""),
      );
      return { input, slug: null, instance: null, status: "unresolved", read: 0, returned: 0 };
    }

    const limit = args.limit ?? DEFAULT_LIMIT;
    const found = await readBoard(client, args, site, limit);

    if (found.data === null) {
      // The probe confirmed this site moments ago, so a 404 here is a change on
      // Lever's side rather than a name that never existed.
      return {
        input,
        slug: site.slug,
        instance: site.instance,
        status: "failed",
        read: 0,
        returned: 0,
        error: `[not_found] The ${site.slug} site answered the probe and answered 404 on the read, so its openings could not be listed.`,
      };
    }

    if (found.data.length === 0 && hasSiteFilters(args)) {
      // Lever answers an unknown filter value with an empty list and no error,
      // so an empty answer is checked against the site's own vocabulary before
      // it is reported as an absence.
      await refuseUnknownFilterValue(client, site.slug, site.instance, args, limit);
    }
    if (found.data.length === 0) {
      return { input, slug: site.slug, instance: site.instance, status: "empty", read: 0, returned: 0 };
    }

    if (found.truncated) counters.filled.push(input);
    if (found.pages > 1) counters.walked.push(`${input} (${found.pages} pages)`);
    const kept = found.data.filter((posting) => keeps(posting, args, counters));
    for (const posting of kept) jobs.push(toRow(posting, site.slug, site.instance));
    return {
      input,
      slug: site.slug,
      instance: site.instance,
      status: "read",
      read: found.data.length,
      returned: kept.length,
    };
  } catch (error) {
    // One company's wrong filter wording leaves the others readable: the
    // vocabulary belongs to each company, so a value one of them does not
    // publish says nothing about the rest of the call.
    if (isLeverError(error) && error.code === "invalid_input") refusals.push(error);
    return {
      input,
      slug: site?.slug ?? null,
      instance: site?.instance ?? null,
      status: "failed",
      read: 0,
      returned: 0,
      error: isLeverError(error) ? `[${error.code}] ${error.message}` : String(error),
    };
  }
}

/**
 * Reads one board, walking pages when the question is about dates.
 *
 * Lever pages by title, so an opening published yesterday can sit on any page.
 * A recency filter applied to the first page alone measures the first page, and
 * a caller reads it as a measure of the company.
 */
async function readBoard(
  client: Client,
  args: SearchJobsArgs,
  site: ResolvedSite,
  limit: number,
): Promise<{ data: RawPosting[] | null; pages: number; truncated: boolean }> {
  const filters = {
    ...(args.location ? { location: args.location } : {}),
    ...(args.team ? { team: args.team } : {}),
    ...(args.department ? { department: args.department } : {}),
    ...(args.commitment ? { commitment: args.commitment } : {}),
  };
  const maxPages = args.posted_within_days === undefined ? 1 : MAX_RECENCY_PAGES;
  const collected: RawPosting[] = [];
  let skip = args.skip ?? 0;
  let pages = 0;

  for (; pages < maxPages; pages += 1) {
    const read = await client.listPostings({
      slug: site.slug,
      instance: site.instance,
      limit,
      ...(skip > 0 ? { skip } : {}),
      ...filters,
    });
    if (read.data === null) return { data: null, pages, truncated: false };
    collected.push(...read.data);
    if (read.data.length < limit) return { data: collected, pages: pages + 1, truncated: false };
    skip += limit;
  }

  return { data: collected, pages, truncated: true };
}

/**
 * A name answering on both instances is read on the one that publishes, and the
 * other is named rather than dropped.
 */
function chooseSite(
  found: ResolvedSite[],
  input: string,
  notes: string[],
): ResolvedSite | undefined {
  if (found.length === 0) return undefined;
  const chosen = found.find((site) => site.publishes) ?? found[0];
  if (found.length > 1 && chosen) {
    const others = found
      .filter((site) => site !== chosen)
      .map(
        (site) =>
          `the ${site.instance} instance holds ${site.slug} and ${site.publishes ? "publishes openings of its own" : "publishes nothing"}`,
      );
    notes.push(
      `"${safeLine(input)}" names a Lever site on ${found.length} instances. These openings come from the ${chosen.instance} instance; ${others.join(", ")}. Pass that instance to get_job to read the other.`,
    );
  }
  return chosen;
}

/** Every filter is judged on every opening read, so each count means what it says. */
function keeps(posting: RawPosting, args: SearchJobsArgs, counters: Counters): boolean {
  let kept = true;

  if (args.keyword !== undefined && !matchesKeyword(posting, args.keyword)) {
    counters.keyword += 1;
    kept = false;
  }

  if (args.workplace_type?.length) {
    const wanted = args.workplace_type.map((v) => v.toLowerCase());
    if (!wanted.includes((posting.workplaceType ?? "").toLowerCase())) {
      counters.workplace += 1;
      kept = false;
    }
  }

  if (args.country?.length) {
    const wanted = args.country.map((v) => v.toUpperCase());
    if (posting.country === null) {
      // Lever recording no country is not Lever recording another country.
      counters.unknownCountry += 1;
      kept = false;
    } else if (!wanted.includes(posting.country.toUpperCase())) {
      counters.country += 1;
      kept = false;
    }
  }

  if (
    args.posted_within_days !== undefined &&
    posting.createdAt < Date.now() - args.posted_within_days * 86_400_000
  ) {
    counters.tooOld += 1;
    kept = false;
  }

  if (args.salary_min !== undefined) {
    const range = posting.salaryRange;
    const wantedInterval = args.salary_interval ?? DEFAULT_SALARY_INTERVAL;
    if (!range) {
      counters.noSalary += 1;
      kept = false;
    } else if (range.interval !== wantedInterval) {
      counters.otherInterval += 1;
      kept = false;
    } else if (args.currency && range.currency.toUpperCase() !== args.currency.toUpperCase()) {
      counters.otherCurrency += 1;
      kept = false;
    } else if (range.max < args.salary_min) {
      counters.belowSalary += 1;
      kept = false;
    }
  }

  return kept;
}

function matchesKeyword(posting: RawPosting, keyword: string): boolean {
  const needle = keyword.toLowerCase();
  const haystack = [
    posting.text,
    posting.descriptionPlain,
    posting.categories?.team,
    posting.categories?.department,
  ]
    .filter((v): v is string => typeof v === "string")
    .join("\n")
    .toLowerCase();
  return haystack.includes(needle);
}

/** The filters applied here, after Lever has already cut the page. */
function hasLocalFilters(args: SearchJobsArgs): boolean {
  return (
    args.keyword !== undefined ||
    args.salary_min !== undefined ||
    args.posted_within_days !== undefined ||
    Boolean(args.workplace_type?.length) ||
    Boolean(args.country?.length)
  );
}

function hasSiteFilters(args: SearchJobsArgs): boolean {
  return Boolean(
    args.location?.length ||
      args.team?.length ||
      args.department?.length ||
      args.commitment?.length,
  );
}

/**
 * Turns Lever's silent empty answer into a refusal carrying the values the site
 * publishes.
 */
async function refuseUnknownFilterValue(
  client: Client,
  slug: string,
  instance: Instance,
  args: SearchJobsArgs,
  limit: number,
): Promise<void> {
  for (const field of GROUPED_FIELDS) {
    const wanted = args[field];
    if (!wanted?.length) continue;
    const read = await client.listGroups(slug, instance, field);
    refuseAgainst(
      field,
      wanted,
      read.data.map((group) => group.title).filter((t): t is string => typeof t === "string"),
      slug,
    );
  }

  if (args.department?.length) {
    // Lever groups by team, location and commitment only, so the departments a
    // company uses are read from the openings it publishes.
    const board = await client.listPostings({ slug, instance, limit });
    const published = [
      ...new Set(
        (board.data ?? [])
          .map((posting) => posting.categories?.department)
          .filter((value): value is string => typeof value === "string"),
      ),
    ];
    refuseAgainst("department", args.department, published, slug, true);
  }
}

/**
 * Lever matches a lone value in any case, and matches several values only when
 * each is written exactly, so the check mirrors what the site itself does.
 */
function refuseAgainst(
  field: string,
  wanted: string[],
  published: string[],
  slug: string,
  derived = false,
): void {
  const exact = wanted.length > 1;
  const unknown = wanted.filter((value) =>
    exact
      ? !published.includes(value)
      : !published.some((title) => title.toLowerCase() === value.toLowerCase()),
  );
  if (unknown.length === 0) return;

  const how = exact
    ? "Lever matches several values only when each is written exactly as it publishes it, and answers anything else with an empty list and no error."
    : "Lever answers an unknown filter value with an empty list and no error.";
  const where = derived
    ? `read from the openings ${slug} publishes right now, so a ${field} with no open role does not appear among them`
    : `published by ${slug}`;

  throw invalidInput(
    `The ${slug} site publishes no ${field} called ${unknown.map(safeLine).join(", ")}. ${how} This is refused rather than reported as "nothing found". The values are ${where}, and list_filter_values publishes them.`,
    published.map(safeLine),
  );
}

function addFilterNotes(args: SearchJobsArgs, counters: Counters, notes: string[]): void {
  // Each filter is judged on every opening read, so one opening turned away by
  // two of them is counted by both. Summed, the counts exceed what was read,
  // and a reader who adds them up concludes the arithmetic is wrong.
  const dropped =
    counters.keyword +
    counters.workplace +
    counters.country +
    counters.unknownCountry +
    counters.tooOld +
    counters.noSalary +
    counters.otherInterval +
    counters.otherCurrency +
    counters.belowSalary;
  if (dropped > 0) {
    notes.push(
      "Each count below is taken over every opening this call read, so an opening turned away by two filters appears in both counts. They are reasons, and adding them up counts openings twice.",
    );
  }

  if (args.keyword !== undefined && counters.keyword > 0) {
    notes.push(
      `${counters.keyword} opening(s) that were read do not carry "${safeLine(args.keyword)}" in their title or advert and were dropped. Lever offers no full-text search, so a keyword only reaches the openings this call read.`,
    );
  }
  if (args.workplace_type?.length) {
    notes.push(
      "workplace_type was applied here: Lever accepts it as a parameter and ignores it, so asking Lever to filter on it would return openings of every kind.",
    );
    if (counters.workplace > 0) {
      notes.push(`${counters.workplace} opening(s) of another workplace type were dropped.`);
    }
  }
  if (args.country?.length) {
    if (counters.country > 0) {
      notes.push(`${counters.country} opening(s) in another country were dropped.`);
    }
    if (counters.unknownCountry > 0) {
      notes.push(
        `${counters.unknownCountry} opening(s) were dropped because Lever records no country for them, which is not the same as recording another one.`,
      );
    }
    notes.push(
      "Lever records one country per opening, taken from its main location, while an opening can list several places. An opening open in two countries carries the country of the first, so all_locations is worth reading before concluding it is out of reach.",
    );
  }
  if (args.posted_within_days !== undefined && counters.tooOld > 0) {
    notes.push(
      `${counters.tooOld} opening(s) that were read are older than ${args.posted_within_days} day(s) and were dropped.`,
    );
  }
  if (args.salary_min !== undefined) {
    const interval = args.salary_interval ?? DEFAULT_SALARY_INTERVAL;
    notes.push(
      `salary_min was read as ${interval}, and an opening is kept when the upper bound of its range reaches it. Lever publishes a salary on a minority of openings, and an amount carries its own period, so amounts written in another period are never converted.`,
    );
    if (counters.noSalary > 0) {
      notes.push(
        `${counters.noSalary} opening(s) were dropped because the company published no salary, which is not the same as a low one.`,
      );
    }
    if (counters.otherInterval > 0) {
      notes.push(
        `${counters.otherInterval} opening(s) were dropped because their salary is published per a different period than ${interval}.`,
      );
    }
    if (args.currency) {
      notes.push(
        counters.otherCurrency > 0
          ? `${counters.otherCurrency} opening(s) were dropped because their salary is published in a currency other than ${args.currency.toUpperCase()}, and nothing here converts one.`
          : `currency kept only salaries published in ${args.currency.toUpperCase()}, and turned none away.`,
      );
    }
    if (counters.belowSalary > 0) {
      notes.push(`${counters.belowSalary} opening(s) publish a salary below salary_min.`);
    }
  }
}

function addOutcomeNotes(
  args: SearchJobsArgs,
  perCompany: CompanyOutcome[],
  counters: Counters,
  notes: string[],
): void {
  if (counters.walked.length > 0) {
    notes.push(
      `Lever pages by title, so a recency question cannot be answered from one page: ${counters.walked.map(safeLine).join(", ")} were walked page by page.`,
    );
  }
  if (counters.filled.length > 0) {
    const limit = args.limit ?? DEFAULT_LIMIT;
    const walked = args.posted_within_days === undefined ? 1 : MAX_RECENCY_PAGES;
    notes.push(
      `${counters.filled.map(safeLine).join(", ")} still had openings after ${walked === 1 ? `the limit of ${limit}` : `${walked} pages of ${limit}`}, which applies per company, so ${counters.filled.length === 1 ? "it publishes" : "they publish"} more than this call read. Raise limit, or step forward with skip.`,
    );
    // Lever pages by title, so the window is alphabetical rather than the
    // openings a filter would have picked. A count taken inside it is a count
    // of the window, and reads as a count of the company.
    if (hasLocalFilters(args)) {
      notes.push(
        `keyword, workplace_type, country, salary and recency were applied to those ${limit} openings alone, not to everything ${counters.filled.length === 1 ? "that company" : "those companies"} publishes. These figures are a share of what was read, and no share of what exists: Lever pages by title, so a wider limit or a step forward with skip changes them. list_filter_values counts the openings a company has open, which is the denominator this call does not carry.`,
      );
    }
  }
  const failed = perCompany.filter((c) => c.status === "failed");
  if (failed.length > 0) {
    notes.push(
      `Reading ${failed.map((c) => safeLine(c.input)).join(", ")} failed, so these results do not cover ${failed.length === 1 ? "that company" : "those companies"}. Each per_company entry carries what went wrong.`,
    );
  }
  const empty = perCompany.filter((c) => c.status === "empty");
  if (empty.length > 0) {
    const named = empty.map((c) => safeLine(c.input)).join(", ");
    notes.push(
      hasSiteFilters(args)
        ? `${named} returned nothing under the filter values in this call, which says nothing about what ${empty.length === 1 ? "it publishes" : "they publish"} unfiltered.`
        : `${named} has a Lever site that publishes nothing right now.`,
    );
  }
}

function summarise(payload: {
  jobs: JobRow[];
  per_company: CompanyOutcome[];
  notes: string[];
}): string {
  const lines = [
    `${payload.jobs.length} opening(s) across ${payload.per_company.length} company request(s).`,
  ];
  for (const company of payload.per_company) {
    lines.push(
      `- ${safeLine(company.input)}: ${company.status}, ${company.read} read, ${company.returned} kept.`,
    );
  }
  for (const note of payload.notes) lines.push(`Note: ${note}`);
  return lines.join("\n");
}

export { searchJobsOutputShape };
