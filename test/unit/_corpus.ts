// Lecture du corpus engendré par `scripts/build-fixtures.mjs`.
//
// Les offres sont inventées. Elles portent les formes que `SCHEMA.md` décrit,
// et les tests s'y réfèrent par le nom du cas plutôt que par un index.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface RawSalaryRange {
  min: number;
  max: number;
  currency: string;
  interval: string;
}

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

export interface RawGroup {
  title: string;
  postings: RawPosting[];
}

export interface CorpusSite {
  slug: string;
  instance: "global" | "eu";
  postings: RawPosting[];
}

export interface Corpus {
  generated_by: string;
  note: string;
  now: string;
  sites: CorpusSite[];
  cases: Record<string, string>;
  groups: Record<string, Record<"team" | "location" | "commitment", RawGroup[]>>;
}

const corpusPath = fileURLToPath(new URL("../fixtures/corpus.json", import.meta.url));

export const corpus: Corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as Corpus;

/** L'instant que les tests figent : la génération du corpus le porte. */
export const FIXED_NOW = corpus.now;

export function site(slug: string, instance: "global" | "eu" = "global"): CorpusSite {
  const found = corpus.sites.find((s) => s.slug === slug && s.instance === instance);
  if (!found) {
    throw new Error(`corpus: aucun site ${slug} sur ${instance}`);
  }
  return found;
}

/** L'offre du cas nommé, dans le site principal du corpus. */
export function posting(caseName: string): RawPosting {
  const id = corpus.cases[caseName];
  if (!id) {
    throw new Error(`corpus: aucun cas nommé ${caseName}`);
  }
  const found = site("acmerobotics").postings.find((p) => p.id === id);
  if (!found) {
    throw new Error(`corpus: le cas ${caseName} ne désigne aucune offre`);
  }
  return found;
}

export const ALLOWED_HOSTS = ["api.lever.co", "api.eu.lever.co"] as const;

export function hostOf(url: string): string {
  return new URL(url).hostname;
}
