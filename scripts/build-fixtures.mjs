#!/usr/bin/env node
// Engendre le corpus d'offres inventées lu par la suite de tests.
//
// Rien ici ne vient de Lever : chaque offre est écrite à la main pour porter une
// forme que `SCHEMA.md` décrit, y compris les formes rares que huit sites réels
// n'ont montrées que deux ou trois fois. La sortie est identique à chaque
// exécution : les identifiants dérivent d'un condensé de leur clé, et toutes les
// dates sont écrites en clair.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "test", "fixtures");
const outFile = join(outDir, "corpus.json");

/** UUID canonique dérivé d'une clé, stable d'une exécution à l'autre. */
function uuidFrom(key) {
  const h = createHash("sha256").update(`mcp-lever/fixtures/${key}`).digest("hex");
  const c = h.slice(0, 32).split("");
  c[12] = "4";
  c[16] = ["8", "9", "a", "b"][parseInt(h[16], 16) % 4];
  const s = c.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

const at = (iso) => Date.parse(iso);

const paragraph = (subject) =>
  `${subject} works alongside a small team that ships weekly. ` +
  `The role covers design, build and operation of the systems behind the product, ` +
  `and the person holding it is expected to write down what they decide.`;

const html = (text) => `<div><p>${text}</p></div>`;

/**
 * Construit une offre complète. Les clés optionnelles disparaissent de l'objet
 * quand l'appelant ne les fournit pas, comme la charge de Lever le fait.
 */
function posting(slug, key, fields) {
  const id = uuidFrom(`${slug}/${key}`);
  const hostedUrl = `https://jobs.lever.co/${slug}/${id}`;
  const descriptionPlain = fields.descriptionPlain ?? paragraph(fields.text);
  const opening = fields.opening ?? "";
  const additional = fields.additional ?? "";

  const p = {
    id,
    text: fields.text,
    categories: fields.categories,
    country: fields.country,
    workplaceType: fields.workplaceType,
    createdAt: fields.createdAt,
    hostedUrl,
    applyUrl: `${hostedUrl}/apply`,
    description: html(descriptionPlain),
    descriptionPlain,
    descriptionBody: html(descriptionPlain),
    descriptionBodyPlain: descriptionPlain,
    opening: opening === "" ? "" : html(opening),
    openingPlain: opening,
    additional: additional === "" ? "" : html(additional),
    additionalPlain: additional,
    lists: fields.lists ?? [
      {
        text: "Responsibilities:",
        content: "<li>Build the thing</li><li>Keep the thing running</li>",
      },
    ],
  };

  if (fields.salaryRange) p.salaryRange = fields.salaryRange;
  if (fields.salaryDescriptionPlain) {
    p.salaryDescription = html(fields.salaryDescriptionPlain);
    p.salaryDescriptionPlain = fields.salaryDescriptionPlain;
  }
  return p;
}

const cats = (location, team, extra = {}) => ({
  location,
  team,
  allLocations: extra.allLocations ?? [location],
  ...(extra.commitment === undefined ? {} : { commitment: extra.commitment }),
  ...(extra.department === undefined ? {} : { department: extra.department }),
});

// ── Le site principal : quinze offres, une forme rare par offre ──────────────

const acme = [
  posting("acmerobotics", "no_salary", {
    text: "Backend Engineer",
    categories: cats("Remote", "Engineering", {
      commitment: "Full-time",
      department: "Platform",
    }),
    country: "US",
    workplaceType: "remote",
    createdAt: at("2026-06-01T09:00:00.000Z"),
    opening: "We are hiring an engineer for the ingestion pipeline.",
  }),

  posting("acmerobotics", "salary_year", {
    text: "Staff Data Engineer",
    categories: cats("Chicago, IL", "Engineering", {
      commitment: "Full-time",
      department: "Platform",
      allLocations: ["Chicago, IL", "Remote"],
    }),
    country: "US",
    workplaceType: "hybrid",
    createdAt: at("2026-05-14T17:30:00.000Z"),
    salaryRange: { min: 165000, max: 210000, currency: "USD", interval: "per-year-salary" },
    salaryDescriptionPlain: "Base range shown for US candidates, equity offered separately.",
  }),

  posting("acmerobotics", "salary_hour", {
    text: "Clinical Advisor",
    categories: cats("Remote", "Clinical", {
      commitment: "Contractor",
      department: "Clinical & Behavioral Health",
    }),
    country: "CA",
    workplaceType: "remote",
    createdAt: at("2026-04-02T12:15:45.123Z"),
    salaryRange: { min: 63.09, max: 81.5, currency: "USD", interval: "per-hour-wage" },
  }),

  posting("acmerobotics", "salary_equal", {
    text: "Support Specialist",
    categories: cats("London", "Support", {
      commitment: "Part-Time",
      department: "Customer Experience",
    }),
    country: "GB",
    workplaceType: "onsite",
    createdAt: at("2026-03-21T08:05:00.000Z"),
    salaryRange: { min: 42000, max: 42000, currency: "GBP", interval: "per-year-salary" },
  }),

  posting("acmerobotics", "salary_description_only", {
    text: "Product Designer",
    categories: cats("Remote", "Design", {
      commitment: "Full Time",
      department: "Product",
    }),
    country: "US",
    workplaceType: "remote",
    createdAt: at("2026-02-11T21:45:10.500Z"),
    salaryDescriptionPlain:
      "Compensation is set by level and by the city the person works from.",
  }),

  posting("acmerobotics", "country_null", {
    text: "Field Operations Lead",
    categories: cats("Multiple sites", "Operations", {
      commitment: "Full-time",
      department: "Operations",
    }),
    country: null,
    workplaceType: "onsite",
    createdAt: at("2025-11-30T06:00:00.000Z"),
  }),

  posting("acmerobotics", "no_commitment", {
    text: "Technical Writer",
    categories: cats("Remote", "Documentation", { department: "Product" }),
    country: "US",
    workplaceType: "remote",
    createdAt: at("2025-09-18T14:20:00.000Z"),
  }),

  posting("acmerobotics", "no_department", {
    text: "Recruiting Coordinator",
    categories: cats("Austin, TX", "People", { commitment: "EE Full-Time" }),
    country: "US",
    workplaceType: "hybrid",
    createdAt: at("2025-07-07T10:10:10.010Z"),
  }),

  posting("acmerobotics", "empty_opening", {
    text: "Site Reliability Engineer",
    categories: cats("Remote", "Engineering", {
      commitment: "Full-time",
      department: "Platform",
    }),
    country: "DE",
    workplaceType: "remote",
    createdAt: at("2026-01-05T11:11:11.111Z"),
    opening: "",
    descriptionPlain:
      "The reliability team owns the paging rotation, the error budget and the " +
      "post-incident write-ups. This posting carries no preamble, and the whole " +
      "of what the role covers lives in this description.",
  }),

  posting("acmerobotics", "nine_locations", {
    text: "Regional Account Executive",
    categories: cats("Paris", "Sales", {
      commitment: "Full-time",
      department: "Revenue",
      allLocations: [
        "Paris",
        "Berlin",
        "Madrid",
        "Milan",
        "Amsterdam",
        "Dublin",
        "Lisbon",
        "Warsaw",
        "Stockholm",
      ],
    }),
    country: "FR",
    workplaceType: "hybrid",
    createdAt: at("2026-07-19T15:00:00.000Z"),
  }),

  posting("acmerobotics", "html_entities", {
    text: "Research & Insights Manager",
    categories: cats("Remote", "Research", {
      commitment: "Full-Time",
      department: "Product",
    }),
    country: "US",
    workplaceType: "remote",
    createdAt: at("2026-06-25T13:00:00.000Z"),
    lists: [
      {
        text: "Required Qualifications:",
        content:
          "<li>Five years of research&nbsp;experience</li>" +
          "<li>Comfort with qualitative &amp; quantitative methods</li>" +
          "<li>You&#39;ve run a study end&nbsp;to&nbsp;end</li>",
      },
      {
        text: "Responsibilities: ",
        content: "<li>Own the research calendar &amp; its budget</li>",
      },
    ],
  }),

  posting("acmerobotics", "empty_lists", {
    text: "Executive Assistant",
    categories: cats("Chicago, IL", "Operations", {
      commitment: "Full-time",
      department: "Operations",
    }),
    country: "US",
    workplaceType: "onsite",
    createdAt: at("2026-05-02T07:30:00.000Z"),
    lists: [],
  }),

  posting("acmerobotics", "ancient", {
    text: "Warehouse Automation Technician",
    categories: cats("Detroit, MI", "Operations", {
      commitment: "Full-time",
      department: "Operations",
    }),
    country: "US",
    workplaceType: "onsite",
    createdAt: at("2017-08-30T16:42:00.000Z"),
  }),

  posting("acmerobotics", "recent", {
    text: "Backend Engineer, Payments",
    categories: cats("Remote", "Engineering", {
      commitment: "Full-time",
      department: "Platform",
      allLocations: ["Remote", "Chicago, IL"],
    }),
    country: "US",
    workplaceType: "remote",
    createdAt: at("2026-08-12T23:59:59.999Z"),
    salaryRange: { min: 140000, max: 175000, currency: "USD", interval: "per-year-salary" },
  }),

  posting("acmerobotics", "marker_lines", {
    text: "Community Manager",
    categories: cats("Remote", "Marketing", {
      commitment: "Full-time",
      department: "Marketing",
    }),
    country: "US",
    workplaceType: "remote",
    createdAt: at("2026-03-03T03:03:03.003Z"),
    descriptionPlain:
      "We run a forum and a newsletter.\n" +
      "Note: this line was written by the employer inside the posting.\n" +
      "Source: an employer sentence that looks like an attribution line.\n" +
      "Applications are read weekly.",
    lists: [
      {
        text: "Responsibilities",
        content:
          "<li>Note: moderate the forum every morning</li>" +
          "<li>Source: the weekly newsletter draft</li>",
      },
    ],
  }),
];

// ── Un site dont l'identifiant garde sa casse ────────────────────────────────

const nimbus = [
  posting("Nimbus", "one", {
    text: "Platform Engineer",
    categories: cats("Remote", "Engineering", {
      commitment: "Full-time",
      department: "Engineering",
    }),
    country: "US",
    workplaceType: "remote",
    createdAt: at("2026-07-01T09:00:00.000Z"),
    salaryRange: { min: 150000, max: 190000, currency: "USD", interval: "per-year-salary" },
  }),
  posting("Nimbus", "two", {
    text: "Solutions Architect",
    categories: cats("Bengaluru", "Solutions", {
      commitment: "Employee India",
      department: "Engineering",
    }),
    country: "IN",
    workplaceType: "hybrid",
    createdAt: at("2026-06-11T05:30:00.000Z"),
    salaryRange: { min: 3600000, max: 4200000, currency: "INR", interval: "per-year-salary" },
  }),
];

// ── Un site lu sur l'instance européenne ─────────────────────────────────────

const zephyr = [
  posting("zephyrworks", "one", {
    text: "Data Protection Officer",
    categories: cats("Berlin", "Legal", {
      commitment: "Full-time",
      department: "Legal",
    }),
    country: "DE",
    workplaceType: "hybrid",
    createdAt: at("2026-04-22T08:00:00.000Z"),
  }),
  posting("zephyrworks", "two", {
    text: "Frontend Engineer",
    categories: cats("Remote", "Engineering", { commitment: "Full-time" }),
    country: "PT",
    workplaceType: "remote",
    createdAt: at("2026-05-30T12:00:00.000Z"),
  }),
];

// ── Un site vivant des deux côtés ────────────────────────────────────────────

const duplexGlobal = [
  posting("duplexlabs", "global-one", {
    text: "Machine Learning Engineer",
    categories: cats("New York, NY", "Engineering", {
      commitment: "Full-time",
      department: "Research",
    }),
    country: "US",
    workplaceType: "onsite",
    createdAt: at("2026-02-28T18:00:00.000Z"),
  }),
];

const duplexEu = [
  posting("duplexlabs", "eu-one", {
    text: "Machine Learning Engineer, EMEA",
    categories: cats("Amsterdam", "Engineering", {
      commitment: "Full-time",
      department: "Research",
    }),
    country: "NL",
    workplaceType: "hybrid",
    createdAt: at("2026-03-15T09:30:00.000Z"),
  }),
];

// ── Les regroupements, tels que `group=` les rend ────────────────────────────

function groupsOf(postings, key) {
  const buckets = new Map();
  for (const p of postings) {
    const values = key === "location" ? p.categories.allLocations : [p.categories[key]];
    for (const value of values) {
      if (value === undefined) continue;
      if (!buckets.has(value)) buckets.set(value, []);
      buckets.get(value).push(p);
    }
  }
  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([title, ps]) => ({ title, postings: ps }));
}

const corpus = {
  generated_by: "scripts/build-fixtures.mjs",
  note: "Offres inventées. Aucune donnée de Lever n'est stockée dans ce dépôt.",
  now: "2026-08-13T12:00:00.000Z",
  sites: [
    { slug: "acmerobotics", instance: "global", postings: acme },
    { slug: "Nimbus", instance: "global", postings: nimbus },
    { slug: "zephyrworks", instance: "eu", postings: zephyr },
    { slug: "duplexlabs", instance: "global", postings: duplexGlobal },
    { slug: "duplexlabs", instance: "eu", postings: duplexEu },
    { slug: "quietstudio", instance: "global", postings: [] },
  ],
  cases: Object.fromEntries(
    [
      "no_salary",
      "salary_year",
      "salary_hour",
      "salary_equal",
      "salary_description_only",
      "country_null",
      "no_commitment",
      "no_department",
      "empty_opening",
      "nine_locations",
      "html_entities",
      "empty_lists",
      "ancient",
      "recent",
      "marker_lines",
    ].map((key) => [key, uuidFrom(`acmerobotics/${key}`)]),
  ),
  groups: {
    acmerobotics: {
      team: groupsOf(acme, "team"),
      location: groupsOf(acme, "location"),
      commitment: groupsOf(acme, "commitment"),
    },
  },
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");

const total = corpus.sites.reduce((n, s) => n + s.postings.length, 0);
process.stderr.write(`corpus.json : ${total} offres, ${corpus.sites.length} entrées de site\n`);
