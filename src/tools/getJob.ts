import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Client } from "../lever/client.js";
import type { Instance } from "../types.js";
import { parseArgs, strictInput, text } from "./arguments.js";
import { toolFailure } from "./errorShape.js";
import { safeLine, toRecord } from "./render.js";
import { getJobOutputShape } from "./schemas.js";

export const getJobDescription =
  "Read one Lever opening in full: the advert, its named sections, and the salary as published. " +
  "company_slug and instance are the ones the row carried, and a site living on both instances holds different openings on each.";

export const getJobSchema = strictInput({
  company_slug: text("company_slug", "the Lever site name, as resolve_company returns it"),
  job_id: text("job_id", "the identifier of one opening, as a search returns it"),
  instance: z
    .enum(["global", "eu"])
    .describe("The Lever instance the row came from. Left out, the global one is read.")
    .optional(),
});

export const getJobInput = getJobSchema.shape;

export interface GetJobArgs {
  company_slug: string;
  job_id: string;
  instance?: Instance;
}

export async function runGetJob(client: Client, args: GetJobArgs): Promise<CallToolResult> {
  try {
    args = parseArgs(getJobSchema, args) as typeof args;
    const instance: Instance = args.instance ?? "global";
    const read = await client.getPosting(args.company_slug, args.job_id, instance);
    const job = toRecord(read.data, args.company_slug, instance);

    const notes: string[] = [];
    if (job.salary === null) {
      notes.push(
        "This company published no salary for this opening, which says nothing about what it pays.",
      );
    }
    if (job.country === null) {
      notes.push("Lever records no country for this opening.");
    }
    if (job.description === "") {
      notes.push("Lever holds no advert text for this opening, only its heading fields.");
    }

    const payload = { job, notes };
    return {
      content: [{ type: "text", text: summarise(payload) }],
      structuredContent: payload,
    };
  } catch (error) {
    return toolFailure(error);
  }
}

function summarise(payload: { job: ReturnType<typeof toRecord>; notes: string[] }): string {
  const { job } = payload;
  const lines = [
    `${safeLine(job.title)} (${job.company_slug})`,
    `${safeLine(job.location)} (${job.workplace_type})${job.country ? `, ${job.country}` : ""}`,
    job.salary
      ? `Salary: ${job.salary.min}-${job.salary.max} ${job.salary.currency}, ${job.salary.interval}`
      : "Salary: not published",
    `Posted ${job.posted_at}`,
    // The advert and its sections travel in the structured payload, and one
    // opening runs to thousands of characters: writing it twice doubles the
    // cost of reading it.
    `The advert and its ${job.sections.length} section(s) are in the structured payload.`,
  ];
  for (const note of payload.notes) lines.push(`Note: ${note}`);
  lines.push(`Source: ${job.url}`);
  return lines.join("\n");
}

export { getJobOutputShape };
