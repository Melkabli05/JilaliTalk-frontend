/**
 * Collects user IDs and flushes them as one batch call after a quiet period, instead of one
 * HTTP call per ID. Shared by every store that enriches partial realtime data (missing avatar,
 * nationality, etc.) against `POST /users/enrich-batch` — AudienceStore, StageStore,
 * CommentsStore, and ImBootstrapService all queue IDs from realtime events at unpredictable
 * rates, so the debounce-then-batch shape is identical even though what each caller does with
 * the response differs.
 *
 * @example
 * ```ts
 * private readonly enrichQueue = new EnrichBatchQueue((uids) =>
 *   firstValueFrom(this.api.enrichBatch(uids)).then((res) => this.applyEnriched(res.profiles)),
 * );
 * // later, per realtime event:
 * this.enrichQueue.queue(uid);
 * ```
 */
export class EnrichBatchQueue {
  private readonly pending = new Set<number>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly flush: (uids: number[]) => Promise<void>,
    private readonly delayMs = 200,
  ) {}

  queue(uid: number): void {
    this.pending.add(uid);
    if (this.timer === null) {
      this.timer = setTimeout(() => void this.flushNow(), this.delayMs);
    }
  }

  async flushNow(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const uids = [...this.pending];
    this.pending.clear();
    if (uids.length === 0) return;
    try {
      await this.flush(uids);
    } catch {
      // silently discard — partial/missing enrichment is acceptable, a later event retries
    }
  }

  dispose(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending.clear();
  }
}
