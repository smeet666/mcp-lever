// La suite en direct, derrière LEVER_LIVE=1. Une requête par route, plus la
// relecture des `robots.txt` des deux hôtes lus.
//
// Elle échoue quand Lever change d'avis : une règle nouvelle visant notre agent,
// `ClaudeBot`, ou le chemin `/v0/postings/`, doit casser la construction plutôt
// que passer inaperçue.

import process from "node:process";
import { describe, it, expect } from "vitest";
import { Client } from "../../src/lever/client.js";

const live = process.env["LEVER_LIVE"] === "1";

const HOSTS = ["https://api.lever.co", "https://api.eu.lever.co"];
const AGENTS_QUI_NOUS_CONCERNENT = ["*", "claudebot", "anthropic-ai", "claude-user", "mcp-lever"];
const CHEMIN = "/v0/postings/";

interface RobotsGroup {
  agents: string[];
  disallow: string[];
}

function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let previousWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (line === "") {
      continue;
    }
    const [rawField, ...rest] = line.split(":");
    const field = (rawField ?? "").trim().toLowerCase();
    const value = rest.join(":").trim();

    if (field === "user-agent") {
      if (!(current && previousWasAgent)) {
        current = { agents: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      previousWasAgent = true;
      continue;
    }
    previousWasAgent = false;
    if (field === "disallow" && current) {
      current.disallow.push(value);
    }
  }
  return groups;
}

function interdit(groups: RobotsGroup[], agent: string, path: string): string[] {
  return groups
    .filter((g) => g.agents.includes(agent))
    .flatMap((g) => g.disallow)
    .filter((rule) => rule !== "" && path.startsWith(rule));
}

describe.skipIf(!live)("les robots.txt des hôtes lus", () => {
  for (const host of HOSTS) {
    it(`n'interdit ni notre agent ni ${CHEMIN} sur ${host}`, async () => {
      const response = await fetch(`${host}/robots.txt`, {
        headers: { "user-agent": "mcp-lever (+https://github.com/smeet666/mcp-lever)" },
      });
      expect([200, 404]).toContain(response.status);
      if (response.status === 404) {
        return;
      }

      const groups = parseRobots(await response.text());
      for (const agent of AGENTS_QUI_NOUS_CONCERNENT) {
        expect(interdit(groups, agent, CHEMIN), `${host} interdit ${CHEMIN} à ${agent}`).toEqual(
          [],
        );
      }
    });
  }
});

describe.skipIf(!live)("une requête par route", () => {
  const client = new Client({});

  it("résout une entreprise nommée", async () => {
    const resolution = await client.resolveCompany("Included Health");
    expect(resolution.found.length).toBeGreaterThan(0);
    expect(resolution.found[0]?.slug).toBe("includedhealth");
  });

  it("lit la liste des offres d'un site", async () => {
    const read = await client.listPostings({
      slug: "includedhealth",
      instance: "global",
      limit: 1,
    });
    expect(Array.isArray(read.data)).toBe(true);
    expect((read.data ?? []).length).toBeLessThanOrEqual(1);
  });

  it("lit une offre seule", async () => {
    const list = await client.listPostings({
      slug: "includedhealth",
      instance: "global",
      limit: 1,
    });
    const first = (list.data ?? [])[0];
    expect(first).toBeDefined();
    const read = await client.getPosting("includedhealth", first!.id, "global");
    expect(read.data.id).toBe(first!.id);
  });

  it("lit le vocabulaire d'un site", async () => {
    const read = await client.listGroups("includedhealth", "global", "team");
    expect(read.data.length).toBeGreaterThan(0);
    expect(typeof read.data[0]?.title).toBe("string");
  });

  it("distingue la casse d'un identifiant de site", async () => {
    const majuscule = await client.listPostings({ slug: "Flex", instance: "global", limit: 1 });
    expect(majuscule.data).not.toBeNull();
  });

  it("répond une absence connue sur l'instance européenne", async () => {
    const read = await client.listPostings({
      slug: "includedhealth",
      instance: "eu",
      limit: 1,
    });
    expect(read.data === null || Array.isArray(read.data)).toBe(true);
  });
});
