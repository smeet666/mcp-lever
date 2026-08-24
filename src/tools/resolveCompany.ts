import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Client } from "../lever/client.js";
import { MAX_COMPANIES } from "../lever/config.js";
import { parseArgs, strictInput, values } from "./arguments.js";
import { toolFailure } from "./errorShape.js";
import { safeLine } from "./render.js";

export const resolveCompanyDescription =
  "Turn company names into the Lever site names that address their job boards, and report every instance that answered. " +
  "search_jobs resolves names on its own, so reach for this to check which of several companies are on Lever at all: " +
  "it probes names without reading a single board, where a search would read one per company.";

export const resolveCompanySchema = strictInput({
  names: values("names", "a company name, or a Lever site name you already know", MAX_COMPANIES),
});

export const resolveCompanyInput = resolveCompanySchema.shape;

export interface ResolveCompanyArgs {
  names: string[];
}

export async function runResolveCompany(
  client: Client,
  args: ResolveCompanyArgs,
): Promise<CallToolResult> {
  try {
    const checked = parseArgs(resolveCompanySchema, args) as typeof args;
    const resolved: ResolvedName[] = [];
    const notes: string[] = [];

    for (const name of checked.names) {
      const resolution = await client.resolveCompany(name);
      resolved.push({
        input: resolution.input,
        found: resolution.found,
        tried: resolution.tried,
        cached: resolution.cached,
      });

      if (resolution.found.length === 0) {
        const near = client.suggestSlug(name);
        notes.push(
          `None of the forms tried for "${safeLine(name)}" names a Lever site. A Lever site name distinguishes case and does not always derive from the company name, so this does not prove that company is absent from Lever.` +
            (near
              ? ` The site "${near}", confirmed earlier in this session, is one edit away.`
              : " A company's exact site name appears in the address of its Lever careers page, jobs.lever.co followed by that name."),
        );
      }
      if (resolution.found.length > 1) {
        notes.push(
          `"${safeLine(name)}" answers on both Lever instances. Both are reported, and neither is elected: pass the instance you mean to the other tools.`,
        );
      }
      for (const site of resolution.found) {
        if (!site.publishes) {
          notes.push(
            `The ${site.slug} site exists on the ${site.instance} instance and publishes nothing right now.`,
          );
        }
      }
    }

    const payload = { resolved, notes };
    return {
      content: [{ type: "text", text: summarise(payload) }],
      structuredContent: payload,
    };
  } catch (error) {
    return toolFailure(error);
  }
}

interface ResolvedName {
  input: string;
  found: { slug: string; instance: string; publishes: boolean }[];
  tried: string[];
  cached: boolean;
}

function summarise(payload: { resolved: ResolvedName[]; notes: string[] }): string {
  const lines: string[] = [];
  for (const entry of payload.resolved) {
    if (entry.found.length === 0) {
      lines.push(`${safeLine(entry.input)}: no Lever site found.`);
    } else {
      for (const site of entry.found) {
        lines.push(
          `${safeLine(entry.input)} -> site "${site.slug}" on the ${site.instance} instance, ${site.publishes ? "publishing openings" : "publishing nothing"}.`,
        );
      }
    }
    lines.push(
      `  forms tried: ${entry.tried.join(", ") || "none"}${entry.cached ? " (answered from this session's memory, nothing was asked of Lever)" : ""}.`,
    );
  }
  for (const note of payload.notes) {
    lines.push(`Note: ${note}`);
  }
  return lines.join("\n");
}
