/**
 * The shapes each tool declares and then respects.
 *
 * `workplace_type` stays a free string: three values appear in the corpus and
 * the documentation names a fourth, so closing the set would reject a posting
 * Lever is entitled to publish.
 */

import { z } from "zod";

export const instanceSchema = z.enum(["global", "eu"]);

export const salarySchema = z
  .object({
    min: z.number(),
    max: z.number(),
    currency: z.string(),
    interval: z
      .string()
      .describe("The period the amounts belong to, as Lever writes it. Never converted."),
  })
  .nullable()
  .describe("Null when the company published no salary, which is never the same as zero.");

export const jobRowShape = {
  id: z.string(),
  title: z.string(),
  company_slug: z.string(),
  instance: instanceSchema,
  location: z.string(),
  all_locations: z.array(z.string()),
  country: z
    .string()
    .nullable()
    .describe("ISO 3166-1 alpha-2, null when Lever does not record a country."),
  workplace_type: z.string(),
  commitment: z.string().optional().describe("Absent when the company does not record it."),
  team: z.string(),
  department: z.string().optional().describe("Absent when the company does not record it."),
  salary: salarySchema,
  posted_at: z.string(),
  url: z.string(),
  apply_url: z.string(),
} as const;

export const jobRowSchema = z.object(jobRowShape);

export const jobRecordSchema = z.object({
  ...jobRowShape,
  description: z.string(),
  sections: z.array(z.object({ heading: z.string(), items: z.array(z.string()) })),
  salary_note: z.string().nullable(),
  source: z.object({ site: z.literal("Lever"), retrieved_from: z.string() }),
});

export const resolveCompanyOutputShape = {
  input: z.string(),
  found: z.array(
    z.object({
      slug: z.string(),
      instance: instanceSchema,
      publishes: z.boolean().describe("False when the site exists and publishes nothing."),
    }),
  ),
  tried: z.array(z.string()).describe("The forms actually sent, in order."),
  notes: z.array(z.string()),
} as const;

export const companyOutcomeSchema = z.object({
  input: z.string(),
  slug: z.string().nullable(),
  instance: instanceSchema.nullable(),
  status: z
    .enum(["read", "unresolved", "empty", "failed"])
    .describe("A company read, one whose site name was not found, one publishing nothing, and one that failed are four different answers."),
  read: z.number().int().describe("Openings Lever returned, before the filters applied here."),
  returned: z.number().int().describe("Openings kept after them."),
  error: z.string().optional(),
});

export const searchJobsOutputShape = {
  jobs: z.array(jobRowSchema),
  per_company: z.array(companyOutcomeSchema),
  total_available: z
    .null()
    .describe("Lever publishes no result count, so this is always null."),
  notes: z.array(z.string()),
} as const;

export const getJobOutputShape = {
  job: jobRecordSchema,
  notes: z.array(z.string()),
} as const;

export const filterValuesSchema = z.array(
  z.object({
    value: z.string(),
    count: z.number().int().nullable().describe("Null when Lever published no openings alongside the category."),
  }),
);

export const listFilterValuesOutputShape = {
  company_slug: z.string(),
  instance: instanceSchema,
  fields: z.object({
    team: filterValuesSchema.optional(),
    location: filterValuesSchema.optional(),
    commitment: filterValuesSchema.optional(),
  }),
  notes: z.array(z.string()),
} as const;
