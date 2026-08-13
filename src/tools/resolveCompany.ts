import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Client } from "../lever/client.js";
import { parseArgs, strictInput, text } from "./arguments.js";
import { toolFailure } from "./errorShape.js";
import { resolveCompanyOutputShape } from "./schemas.js";

export const resolveCompanyDescription =
  "Turn a company name into the Lever site name that addresses its job board, and report every instance that answered. " +
  "search_jobs does this on its own, so call this when a name returns nothing and you want to see the spellings that were tried.";

export const resolveCompanySchema = strictInput({
  name: text("name", "a company name, or a Lever site name you already know"),
});

export const resolveCompanyInput = resolveCompanySchema.shape;

export interface ResolveCompanyArgs {
  name: string;
}

export async function runResolveCompany(
  client: Client,
  args: ResolveCompanyArgs,
): Promise<CallToolResult> {
  try {
    args = parseArgs(resolveCompanySchema, args) as typeof args;
    const resolution = await client.resolveCompany(args.name);
    const notes: string[] = [];

    if (resolution.found.length === 0) {
      const near = client.suggestSlug(args.name);
      notes.push(
        `None of the forms tried names a Lever site. A Lever site name distinguishes case and does not always derive from the company name, so this does not prove that ${args.name} is absent from Lever.`,
      );
      notes.push(
        near
          ? `The site "${near}", confirmed earlier in this session, is one edit away from what was asked.`
          : "A company's exact site name appears in the address of its Lever careers page, jobs.lever.co followed by that name.",
      );
    }
    if (resolution.found.length > 1) {
      notes.push(
        "This name answers on both Lever instances. Both are reported, and neither is elected: pass the instance you mean to the other tools.",
      );
    }
    for (const site of resolution.found) {
      if (!site.publishes) {
        notes.push(
          `The ${site.slug} site exists on the ${site.instance} instance and publishes nothing right now.`,
        );
      }
    }

    const payload = {
      input: resolution.input,
      found: resolution.found,
      tried: resolution.tried,
      notes,
    };

    return {
      content: [{ type: "text", text: summarise(payload) }],
      structuredContent: payload,
    };
  } catch (error) {
    return toolFailure(error);
  }
}

function summarise(payload: {
  input: string;
  found: { slug: string; instance: string; publishes: boolean }[];
  tried: string[];
  notes: string[];
}): string {
  const lines: string[] = [];
  if (payload.found.length === 0) {
    lines.push(`No Lever site found for "${payload.input}".`);
  } else {
    for (const site of payload.found) {
      lines.push(
        `${payload.input} -> site "${site.slug}" on the ${site.instance} instance, ${site.publishes ? "publishing openings" : "publishing nothing"}.`,
      );
    }
  }
  lines.push(`Forms tried: ${payload.tried.join(", ") || "none"}.`);
  for (const note of payload.notes) lines.push(`Note: ${note}`);
  return lines.join("\n");
}

export { resolveCompanyOutputShape };
