import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Client } from "../lever/client.js";
import type { GroupKey } from "../lever/postings.js";
import type { Instance } from "../types.js";
import { parseArgs, strictInput, text } from "./arguments.js";
import { toolFailure } from "./errorShape.js";
import { safeLine } from "./render.js";
import { listFilterValuesOutputShape } from "./schemas.js";

const FIELDS: readonly GroupKey[] = ["team", "location", "commitment"];

export const listFilterValuesDescription =
  "List the team, location and commitment wordings one company uses on Lever, so a filter can carry the words that company publishes. " +
  "The vocabulary belongs to each company: one writes Full-time, another Full Time, another EE Full-Time. " +
  "Lever publishes no vocabulary for department, so a department filter is checked against the openings a company has open right now.";

export const listFilterValuesSchema = strictInput({
  company_slug: text("company_slug", "the Lever site name, as resolve_company returns it"),
  instance: z
    .enum(["global", "eu"])
    .describe("The Lever instance this site lives on. Left out, the global one is read.")
    .optional(),
  fields: z
    .array(z.enum(["team", "location", "commitment"]))
    .min(1)
    .max(3)
    .describe("Which vocabularies to read. Each costs one request. All three by default.")
    .optional(),
});

export const listFilterValuesInput = listFilterValuesSchema.shape;

export interface ListFilterValuesArgs {
  company_slug: string;
  instance?: Instance;
  fields?: GroupKey[];
}

export async function runListFilterValues(
  client: Client,
  args: ListFilterValuesArgs,
): Promise<CallToolResult> {
  try {
    args = parseArgs(listFilterValuesSchema, args) as typeof args;
    const instance: Instance = args.instance ?? "global";
    const wanted = args.fields?.length ? args.fields : FIELDS;
    const fields: Record<string, { value: string; count: number | null }[]> = {};

    for (const field of wanted) {
      const read = await client.listGroups(args.company_slug, instance, field);
      fields[field] = read.data
        .map((group) => ({ value: group.title, count: Array.isArray(group.postings) ? group.postings.length : null }))
        .sort((a, b) => a.value.localeCompare(b.value));
    }

    const notes = [
      "These wordings are what this company uses, and another company on Lever uses others.",
      "Pass a value exactly as it appears here. Lever matches one value in any case, and matches several values only when each is written exactly.",
    ];

    const payload = { company_slug: args.company_slug, instance, fields, notes };
    return {
      content: [{ type: "text", text: summarise(payload) }],
      structuredContent: payload,
    };
  } catch (error) {
    return toolFailure(error);
  }
}

function summarise(payload: {
  company_slug: string;
  instance: string;
  fields: Record<string, { value: string; count: number | null }[]>;
  notes: string[];
}): string {
  const lines = [`Filter wordings used by ${payload.company_slug} (${payload.instance} instance):`];
  for (const [field, entries] of Object.entries(payload.fields)) {
    lines.push(`${field} (${entries.length}):`);
    for (const entry of entries) lines.push(`- ${safeLine(entry.value)} (${entry.count})`);
  }
  for (const note of payload.notes) lines.push(`Note: ${note}`);
  return lines.join("\n");
}

export { listFilterValuesOutputShape };
