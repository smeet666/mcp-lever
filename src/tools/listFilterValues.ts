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
    const checked = parseArgs(listFilterValuesSchema, args) as typeof args;
    const instance: Instance = checked.instance ?? "global";
    const wanted = checked.fields?.length ? checked.fields : FIELDS;
    const fields: Record<string, { value: string; count: number | null }[]> = {};
    const unlabelled: string[] = [];

    for (const field of wanted) {
      const read = await client.listGroups(checked.company_slug, instance, field);
      // Lever returns one group with no title, holding the openings that carry
      // no value for this field. It names a gap, so it is reported as one
      // rather than offered as a wording a filter could carry.
      const missing = read.data
        .filter((group) => typeof group.title !== "string" || group.title === "")
        .reduce(
          (sum, group) => sum + (Array.isArray(group.postings) ? group.postings.length : 0),
          0,
        );
      if (missing > 0) {
        unlabelled.push(
          `${missing} opening(s) carry no ${field}, and Lever files them under no wording, so no ${field} filter reaches them.`,
        );
      }
      fields[field] = read.data
        .filter((group) => typeof group.title === "string" && group.title !== "")
        .map((group) => ({
          value: group.title as string,
          count: Array.isArray(group.postings) ? group.postings.length : null,
        }))
        .sort((a, b) => a.value.localeCompare(b.value));
    }

    const notes: string[] = [];
    // Lever builds these groupings from the openings a company has open, so a
    // company between hiring rounds publishes an empty vocabulary rather than no
    // vocabulary. Reading the first as the second says it files nothing.
    if (Object.values(fields).every((entries) => entries.length === 0)) {
      notes.push(
        `The ${checked.company_slug} site publishes no openings on the ${instance} instance right now. Lever builds these wordings from open roles, so this is an empty board rather than a company that files its roles under nothing.`,
      );
    } else {
      notes.push(
        "These wordings are what this company uses, and another company on Lever uses others.",
      );
    }
    for (const gap of unlabelled) {
      notes.push(gap);
    }
    notes.push(
      "Pass a value exactly as it appears here. Lever matches one value in any case, and matches several values only when each is written exactly.",
    );

    const payload = { company_slug: checked.company_slug, instance, fields, notes };
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
    for (const entry of entries) {
      lines.push(`- ${safeLine(entry.value)} (${entry.count})`);
    }
  }
  for (const note of payload.notes) {
    lines.push(`Note: ${note}`);
  }
  return lines.join("\n");
}

export { listFilterValuesOutputShape };
