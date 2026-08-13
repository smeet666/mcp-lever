// Le cache : expiration par durée, éviction du plus ancien au-delà du plafond.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Cache } from "../../src/lever/cache.js";
import { FIXED_NOW } from "./_corpus.js";

describe("le cache", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(FIXED_NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rend la valeur posée sous une clé", () => {
    const cache = new Cache<string>(60_000, 10);
    cache.set("acmerobotics", "global");
    expect(cache.get("acmerobotics")).toBe("global");
  });

  it("rend undefined pour une clé jamais posée", () => {
    const cache = new Cache<string>(60_000, 10);
    expect(cache.get("inconnue")).toBeUndefined();
  });

  it("oublie une valeur une fois sa durée écoulée", async () => {
    const cache = new Cache<string>(60_000, 10);
    cache.set("acmerobotics", "global");

    await vi.advanceTimersByTimeAsync(60_001);

    expect(cache.get("acmerobotics")).toBeUndefined();
  });

  it("garde une valeur tant que sa durée court", async () => {
    const cache = new Cache<string>(60_000, 10);
    cache.set("acmerobotics", "global");

    await vi.advanceTimersByTimeAsync(59_000);

    expect(cache.get("acmerobotics")).toBe("global");
  });

  it("évince la plus ancienne entrée au-delà du plafond", () => {
    const cache = new Cache<number>(60_000, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });
});
