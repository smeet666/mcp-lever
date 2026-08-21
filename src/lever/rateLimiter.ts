import { MIN_INTERVAL_MS } from "./config.js";

/**
 * One request at a time, with a floor between two departures.
 *
 * Both Lever API hosts publish `Crawl-delay: 1`. The floor is a floor: a
 * configured value below it is raised, never honoured.
 */
export class RateLimiter {
  private readonly intervalMs: number;
  private chain: Promise<unknown> = Promise.resolve();
  private lastStart = Number.NEGATIVE_INFINITY;

  constructor(intervalMs: number) {
    this.intervalMs = Math.max(MIN_INTERVAL_MS, Number.isFinite(intervalMs) ? intervalMs : 0);
  }

  /** Holds the next departure back, for as long as Lever asked. */
  pause(ms: number): void {
    if (ms > 0) {
      this.lastStart = Math.max(this.lastStart, Date.now() + ms - this.intervalMs);
    }
  }

  schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      const wait = this.lastStart + this.intervalMs - Date.now();
      if (wait > 0) {
        await sleep(wait);
      }
      this.lastStart = Date.now();
      return task();
    });
    // The chain swallows rejections so one failed task never stalls the queue,
    // while the caller still receives the original rejection.
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
