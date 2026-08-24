/**
 * Six codes and no more. A failure is never rendered as an empty result: a
 * refused request, an unreadable payload and a genuine absence are three
 * different answers.
 */
export type ErrorCode =
  | "not_found"
  | "invalid_input"
  | "rate_limited"
  | "parse_failure"
  | "network_error"
  | "timeout";

export class LeverError extends Error {
  readonly code: ErrorCode;
  /** Values the site accepts, when the site published them. */
  readonly allowedValues?: string[];
  /** Set on rate_limited when Lever named a delay. */
  retryAfterMs?: number;
  /** Set when the failure was replayed from the cache rather than asked again. */
  cached?: boolean;

  constructor(code: ErrorCode, message: string, allowedValues?: string[], cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "LeverError";
    this.code = code;
    if (allowedValues) {
      this.allowedValues = allowedValues;
    }
  }
}

export const notFound = (message: string) => new LeverError("not_found", message);
export const invalidInput = (message: string, allowed?: string[]) =>
  new LeverError("invalid_input", message, allowed);
export const rateLimited = (message: string) => new LeverError("rate_limited", message);
export const parseFailure = (message: string, cause?: unknown) =>
  new LeverError("parse_failure", message, undefined, cause);
export const networkError = (message: string) => new LeverError("network_error", message);
export const timeout = (message: string) => new LeverError("timeout", message);

const CODES: readonly string[] = [
  "not_found",
  "invalid_input",
  "rate_limited",
  "parse_failure",
  "network_error",
  "timeout",
];

/**
 * Recognises this server's own failures by their shape.
 *
 * The package ships two entry points, each carrying its own copy of this
 * module, so an identity test would call one of them a stranger and hand a
 * caller a blank failure in place of a coded one.
 */
export function isLeverError(value: unknown): value is LeverError {
  return (
    value instanceof Error &&
    value.name === "LeverError" &&
    CODES.includes((value as LeverError).code)
  );
}
