import { ALLOWED_HOSTS } from "./config.js";
import { invalidInput } from "./errors.js";

/**
 * The gate every request passes before a socket opens.
 *
 * `jobs.lever.co` publishes a robots.txt that names six agents and refuses each
 * of them, so it is absent from the allowlist. Postings carry `hostedUrl` and
 * `applyUrl` pointing at that host: rendering them is citing an address, and
 * fetching them would be crawling a host that asked not to be crawled.
 */
export function isAllowedHost(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  // A userinfo section lets `https://api.lever.co@evil.test/` read as trusted
  // to anyone matching on the string rather than on the parsed host.
  if (parsed.username !== "" || parsed.password !== "") return false;
  return ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase());
}

export function assertAllowedUrl(url: string): void {
  if (!isAllowedHost(url)) {
    throw invalidInput(
      `This server reads ${ALLOWED_HOSTS.join(" and ")} only, and refused ${url}.`,
    );
  }
}
