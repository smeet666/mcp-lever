import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { isLeverError } from "../lever/errors.js";

/**
 * How a failure reaches a caller.
 *
 * The code opens the line so it survives truncation and so a client reading the
 * text alone can branch on it. A failure carries no structured payload: an
 * answer with a shape reads as a result, and the emptiness inside it as an
 * emptiness Lever holds.
 */
export function toolFailure(error: unknown): CallToolResult {
  const ours = isLeverError(error) ? error : undefined;
  const code = ours?.code ?? "network_error";
  const message =
    ours?.message ??
    "This client failed while building the answer, so nothing here states anything about what Lever publishes.";
  const lines = [`[${code}] ${message}`];
  const accepted = ours?.allowedValues ?? [];
  if (accepted.length > 0) {
    lines.push(`Lever accepts: ${accepted.join(", ")}.`);
  }
  return { isError: true, content: [{ type: "text", text: lines.join("\n") }] };
}
