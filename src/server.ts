/**
 * MCP server wiring.
 *
 * One client, one rate limiter and one cache are shared by every tool, so the
 * pacing applies to the server as a whole rather than per tool. Tools are
 * registered in a fixed order, which is the order they are listed in.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ClientOptions } from "./lever/config.js";
import { Client } from "./lever/client.js";
import {
  getJobDescription,
  getJobSchema,
  getJobOutputShape,
  runGetJob,
  type GetJobArgs,
} from "./tools/getJob.js";
import {
  listFilterValuesDescription,
  listFilterValuesSchema,
  listFilterValuesOutputShape,
  runListFilterValues,
  type ListFilterValuesArgs,
} from "./tools/listFilterValues.js";
import {
  resolveCompanyDescription,
  resolveCompanySchema,
  resolveCompanyOutputShape,
  runResolveCompany,
  type ResolveCompanyArgs,
} from "./tools/resolveCompany.js";
import {
  runSearchJobs,
  searchJobsDescription,
  searchJobsSchema,
  searchJobsOutputShape,
  type SearchJobsArgs,
} from "./tools/searchJobs.js";
import { PACKAGE_NAME, VERSION } from "./version.js";

/** This server only reads. It writes nowhere and contributes nothing back. */
const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const INSTRUCTIONS =
  "Tools for the public job boards companies publish through Lever. No API key and no account are needed. " +
  "Lever holds one board per company and offers no search across them, so every question starts with a company: " +
  "search_jobs takes company names and turns each one into a site name itself, so it needs no preparation. " +
  "A Lever site name distinguishes case, and Flex answers where flex returns 404, so nothing found is never proof that a company is absent from Lever. " +
  "Three answers are different and are never merged: a site name that does not exist, a site that publishes nothing, and a read that failed. " +
  "Filtering by location, team, department or commitment uses each company's own wording, which list_filter_values publishes; Lever answers a wording it does not know with an empty list and no error. " +
  "A salary is reported as published, with the period it was published in, and is never annualised or converted; most openings publish none, and filtering on salary drops those in silence unless the notes say how many. " +
  "A search returns rows without the advert text, because one board runs to megabytes: read one opening with get_job. " +
  "Every opening carries the address of its Lever page. Credit the company and link that page when you show an opening.";

export function createServer(options: ClientOptions = {}): McpServer {
  const client = new Client(options);

  const server = new McpServer(
    { name: PACKAGE_NAME, version: VERSION },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "resolve_company",
    {
      title: "Resolve company names to Lever boards",
      description: resolveCompanyDescription,
      inputSchema: resolveCompanySchema,
      outputSchema: z.object(resolveCompanyOutputShape),
      annotations: READ_ONLY,
    },
    async (args) => runResolveCompany(client, args as ResolveCompanyArgs),
  );

  server.registerTool(
    "search_jobs",
    {
      title: "Search openings at named companies",
      description: searchJobsDescription,
      inputSchema: searchJobsSchema,
      outputSchema: z.object(searchJobsOutputShape),
      annotations: READ_ONLY,
    },
    async (args) => runSearchJobs(client, args as SearchJobsArgs),
  );

  server.registerTool(
    "get_job",
    {
      title: "Read one opening",
      description: getJobDescription,
      inputSchema: getJobSchema,
      outputSchema: z.object(getJobOutputShape),
      annotations: READ_ONLY,
    },
    async (args) => runGetJob(client, args as GetJobArgs),
  );

  server.registerTool(
    "list_filter_values",
    {
      title: "List a company's filter wordings",
      description: listFilterValuesDescription,
      inputSchema: listFilterValuesSchema,
      outputSchema: z.object(listFilterValuesOutputShape),
      annotations: READ_ONLY,
    },
    async (args) => runListFilterValues(client, args as ListFilterValuesArgs),
  );

  return server;
}
