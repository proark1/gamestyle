/** Requests made during a save belong to the next captured checkpoint, never the in-flight one. */
export class DurableBatch {
  private pending: { resolve: () => void; reject: (error: unknown) => void }[] =
    [];
  private running = false;
  constructor(private save: () => Promise<void>) {}
  request() {
    const promise = new Promise<void>((resolve, reject) =>
      this.pending.push({ resolve, reject }),
    );
    if (!this.running) {
      this.running = true;
      queueMicrotask(() => void this.flush());
    }
    return promise;
  }
  private async flush() {
    while (this.pending.length) {
      const batch = this.pending.splice(0);
      try {
        await this.save();
        batch.forEach((p) => p.resolve());
      } catch (error) {
        batch.forEach((p) => p.reject(error));
      }
    }
    this.running = false;
  }
}
