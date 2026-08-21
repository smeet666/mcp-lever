// Le rythme : une requête à la fois, une seconde entre deux départs, plancher
// que la configuration élargit et ne réduit jamais. Horloge simulée.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RateLimiter } from "../../src/lever/rateLimiter.js";
import { MIN_INTERVAL_MS } from "../../src/lever/config.js";
import { Client } from "../../src/lever/client.js";
import { corpusFetch, settle } from "./_harness.js";
import { FIXED_NOW } from "./_corpus.js";

describe("le rythme", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("annonce un plancher d'une seconde", () => {
    expect(MIN_INTERVAL_MS).toBe(1000);
  });

  it("laisse mille millisecondes entre deux départs", async () => {
    const limiter = new RateLimiter(1000);
    const departures: number[] = [];
    const task = async () => {
      departures.push(Date.now());
    };

    await settle(Promise.all([limiter.schedule(task), limiter.schedule(task)]));

    expect(departures).toHaveLength(2);
    expect((departures[1] as number) - (departures[0] as number)).toBe(1000);
  });

  it("applique le plancher quand la configuration demande moins", async () => {
    const limiter = new RateLimiter(10);
    const departures: number[] = [];
    const task = async () => {
      departures.push(Date.now());
    };

    await settle(Promise.all([limiter.schedule(task), limiter.schedule(task)]));

    expect((departures[1] as number) - (departures[0] as number)).toBe(1000);
  });

  it("respecte un intervalle plus large que le plancher", async () => {
    const limiter = new RateLimiter(4000);
    const departures: number[] = [];
    const task = async () => {
      departures.push(Date.now());
    };

    await settle(Promise.all([limiter.schedule(task), limiter.schedule(task)]));

    expect((departures[1] as number) - (departures[0] as number)).toBe(4000);
  });

  it("sérialise les appels, sans jamais en tenir deux en vol", async () => {
    const limiter = new RateLimiter(1000);
    const events: string[] = [];
    const task = (name: string, durationMs: number) => async () => {
      events.push(`début ${name}`);
      await new Promise((resolve) => setTimeout(resolve, durationMs));
      events.push(`fin ${name}`);
    };

    await settle(
      Promise.all([
        limiter.schedule(task("a", 3000)),
        limiter.schedule(task("b", 100)),
        limiter.schedule(task("c", 100)),
      ]),
    );

    expect(events).toEqual(["début a", "fin a", "début b", "fin b", "début c", "fin c"]);
  });

  it("espace de mille millisecondes deux lectures rapprochées du même client", async () => {
    const stub = corpusFetch();
    const client = new Client({ fetchImpl: stub.fetchImpl });

    await settle(
      Promise.all([
        client.listPostings({ slug: "acmerobotics", instance: "global" }),
        client.listPostings({ slug: "Nimbus", instance: "global" }),
      ]),
    );

    expect(stub.calls).toHaveLength(2);
    const [first, second] = stub.calls;
    expect((second?.startedAt ?? 0) - (first?.startedAt ?? 0)).toBe(1000);
  });
});
