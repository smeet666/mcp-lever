import { MAX_BODY_BYTES } from "./config.js";
import {
  isLeverError,
  networkError,
  notFound,
  parseFailure,
  rateLimited,
  timeout,
} from "./errors.js";
import { assertAllowedUrl } from "./hosts.js";

export interface HttpOptions {
  timeoutMs: number;
  userAgent: string;
  fetchImpl: typeof fetch;
}

export interface HttpResult<T> {
  body: T;
  /** How long Lever asked the caller to wait, when it said so. */
  retryAfterMs?: number;
}

/**
 * Reads one JSON document.
 *
 * Every failure keeps its own code, so no caller can mistake a breakdown for an
 * empty result. A 404 is `not_found`, which on this API says the name does not
 * exist rather than that the read failed.
 *
 * The deadline covers the body as well as the headers. A response whose headers
 * arrive and whose body then stalls would hold the single request queue open for
 * as long as the connection lives, and every later read with it.
 */
export async function getJson<T>(url: string, options: HttpOptions): Promise<HttpResult<T>> {
  assertAllowedUrl(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    let response: Response;
    try {
      response = await options.fetchImpl(url, {
        method: "GET",
        redirect: "error",
        headers: { accept: "application/json", "user-agent": options.userAgent },
        signal: controller.signal,
      });
    } catch (cause) {
      throw controller.signal.aborted
        ? timeout(`Lever did not answer ${url} within ${options.timeoutMs} ms.`)
        : networkError(`Reaching Lever failed: ${describe(cause)}`);
    }

    if (response.status === 404) {
      throw notFound(`Lever holds nothing at ${url}.`);
    }
    if (response.status === 429) {
      const wait = readRetryAfter(response);
      const error = rateLimited("Lever asked this client to slow down. Nothing is missing.");
      throw Object.assign(error, { retryAfterMs: wait });
    }
    if (!response.ok) {
      throw networkError(`Lever answered ${response.status} for ${url}.`);
    }

    const text = await readBounded(response, url, controller, options.timeoutMs);

    try {
      return { body: JSON.parse(text) as T };
    } catch (cause) {
      throw parseFailure(`Lever answered something other than JSON for ${url}.`, cause);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads the body in chunks and stops at a ceiling.
 *
 * One board has answered 48 MB in a single response, and the whole of it would
 * land in memory twice, once as text and once parsed.
 */
async function readBounded(
  response: Response,
  url: string,
  controller: AbortController,
  timeoutMs: number,
): Promise<string> {
  const reader = response.body?.getReader?.();
  if (!reader) {
    try {
      return await response.text();
    } catch (cause) {
      throw bodyFailure(cause, controller, url, timeoutMs);
    }
  }

  const decoder = new TextDecoder();
  const parts: string[] = [];
  let bytes = 0;

  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      bytes += chunk.value?.byteLength ?? 0;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw networkError(
          `Lever answered more than ${Math.round(MAX_BODY_BYTES / 1_000_000)} MB for ${url}, which this client refuses to hold in memory. Ask for a narrower page.`,
        );
      }
      parts.push(decoder.decode(chunk.value, { stream: true }));
    }
  } catch (cause) {
    throw bodyFailure(cause, controller, url, timeoutMs);
  }

  parts.push(decoder.decode());
  return parts.join("");
}

function bodyFailure(
  cause: unknown,
  controller: AbortController,
  url: string,
  timeoutMs: number,
): unknown {
  if (isLeverError(cause)) {
    return cause;
  }
  if (controller.signal.aborted) {
    return timeout(`Lever stopped sending the body of ${url} within ${timeoutMs} ms.`);
  }
  return networkError(`Reading the response body failed: ${describe(cause)}`);
}

function readRetryAfter(response: Response): number | undefined {
  const header = response.headers?.get?.("retry-after");
  if (!header) {
    return undefined;
  }
  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const when = Date.parse(header);
  return Number.isFinite(when) ? Math.max(0, when - Date.now()) : undefined;
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
