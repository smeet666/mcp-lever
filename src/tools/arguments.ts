/**
 * What a tool takes, declared once and enforced as it is declared.
 *
 * An argument this server does not declare is refused at every depth. Read and
 * dropped, it would produce an answer computed on the defaults, which a caller
 * reads as the answer to the question they asked. Announcing
 * `additionalProperties: false` and then accepting an unknown argument is worse
 * than announcing nothing.
 *
 * Every refusal opens with the one code a caller branches on.
 */

import { z } from "zod";
import { invalidInput } from "../lever/errors.js";

const CODE = "[invalid_input]";

const capitalise = (what: string): string => `${what.charAt(0).toUpperCase()}${what.slice(1)}.`;

/** Parses the arguments against the strict object before any work is done. */
export function parseArgs<Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
  args: unknown,
): z.infer<z.ZodObject<Shape>> {
  const parsed = schema.safeParse(args ?? {});
  if (parsed.success) {
    return parsed.data;
  }
  // A caller who wrote `id` for `job_id` is told about `id` first: the missing
  // required argument is the consequence, and naming it alone sends them looking
  // for something they did write.
  const issues = parsed.error.issues;
  const first = issues.find((i) => i.code === "unrecognized_keys") ?? issues[0];
  const message = first?.message ?? "These arguments cannot produce a request.";
  throw invalidInput(message.startsWith(CODE) ? message.slice(CODE.length).trim() : message);
}

export function text(argument: string, what: string): z.ZodString {
  const error = `${CODE} ${argument} takes ${what}. Written with no characters, spaces alone included, it narrows nothing.`;
  return z.string({ error }).trim().min(1, error).describe(capitalise(what));
}

export function wholeNumber(argument: string, min: number, max: number, what: string): z.ZodNumber {
  const error = `${CODE} ${argument} takes ${what}, a whole number from ${min} to ${max}.`;
  return z.number({ error }).int(error).min(min, error).max(max, error).describe(capitalise(what));
}

export function amount(argument: string, what: string): z.ZodNumber {
  const error = `${CODE} ${argument} takes ${what}, a number of zero or more.`;
  return z.number({ error }).min(0, error).describe(capitalise(what));
}

export function currencyCode(argument: string): z.ZodString {
  const error = `${CODE} ${argument} takes a three-letter currency code, as in EUR or USD. Lever publishes salaries with their own currency, so a code it never uses matches nothing it holds.`;
  return z
    .string({ error })
    .regex(/^[A-Za-z]{3}$/, error)
    .describe("A three-letter currency code, as in EUR or USD.");
}

export function countryCode(argument: string): z.ZodString {
  const error = `${CODE} ${argument} takes a two-letter country code, as in FR or US. A country written out in full names no code Lever stores.`;
  return z
    .string({ error })
    .regex(/^[A-Za-z]{2}$/, error)
    .describe("A two-letter country code, as in FR or US.");
}

export function values(argument: string, what: string, most: number): z.ZodArray<z.ZodString> {
  return listOf(text(argument, what), argument, what, most);
}

/** A list of two-letter country codes, checked one by one. */
export function codes(argument: string, what: string, most: number): z.ZodArray<z.ZodString> {
  return listOf(countryCode(argument), argument, what, most);
}

function listOf(
  item: z.ZodString,
  argument: string,
  what: string,
  most: number,
): z.ZodArray<z.ZodString> {
  const empty = `${CODE} ${argument} was written as an empty list, which narrows nothing.`;
  const error = `${CODE} ${argument} takes a list of ${what}, one to ${most} of them, written between square brackets even when there is only one.`;
  return z
    .array(item, { error })
    .min(1, empty)
    .max(most, error)
    .describe(`A list of ${what}, one to ${most} of them.`);
}

/**
 * The strictness is both declared in the published schema and applied on every
 * call, and the refusal names the declared argument a near miss was reaching
 * for: a caller who wrote `compagnies` wants `companies`.
 */
export function strictInput<Shape extends z.ZodRawShape>(shape: Shape): z.ZodObject<Shape> {
  const declared = Object.keys(shape);
  return z.strictObject(shape, {
    error: (issue) => {
      if (issue.code === "unrecognized_keys") {
        return unknownArgumentMessage(issue.keys, declared);
      }
      return issue.message === undefined || issue.message.startsWith(CODE)
        ? undefined
        : `${CODE} ${issue.message}`;
    },
  }) as z.ZodObject<Shape>;
}

function unknownArgumentMessage(unknown: readonly string[], declared: readonly string[]): string {
  const named = unknown
    .map((key) => {
      const near = nearest(key, declared);
      return near === undefined ? key : `${key} (did you mean ${near}?)`;
    })
    .join(", ");
  return `${CODE} This tool does not take ${named}. It takes: ${declared.join(", ")}. An argument that is read and dropped produces an answer computed without it, which reads as the answer to the question that was asked.`;
}

function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      const deletion = (previous[j] ?? 0) + 1;
      const insertion = (current[j - 1] ?? 0) + 1;
      current[j] = Math.min(substitution, deletion, insertion);
    }
    previous = current;
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}

/** Two edits is the widest miss that still names one argument rather than another question. */
function nearest(written: string, declared: readonly string[]): string | undefined {
  // A caller who wrote `slug` wants `company_slug`, eight edits away. Naming a
  // part of the argument is the miss a model actually makes, so it is caught
  // before the edit count is consulted.
  const typed = written.toLowerCase();
  const contained = declared.find(
    (name) => name !== typed && (name.startsWith(typed) || name.endsWith(typed)),
  );
  if (contained) {
    return contained;
  }

  let best: { name: string; apart: number } | undefined;
  for (const name of declared) {
    const apart = distance(written.toLowerCase(), name.toLowerCase());
    if (apart > 2) {
      continue;
    }
    if (best === undefined || apart < best.apart) {
      best = { name, apart };
    }
  }
  return best?.name;
}
