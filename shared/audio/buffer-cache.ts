type Decoded = { length: number; numberOfChannels: number };
/** Bounds retained decoded PCM; active source nodes own their playing buffers separately. */
export class AudioBufferCache<T extends Decoded = AudioBuffer> {
  private entries = new Map<
    string,
    { promise: Promise<T | null>; bytes: number }
  >();
  constructor(
    readonly maxBytes = 32 * 1024 * 1024,
    readonly maxEntries = 24,
  ) {}
  get size() {
    return this.entries.size;
  }
  get bytes() {
    let bytes = 0;
    for (const e of this.entries.values()) bytes += e.bytes;
    return bytes;
  }
  keys() {
    return this.entries.keys();
  }
  get(key: string) {
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
    }
    return entry?.promise;
  }
  set(key: string, promise: Promise<T | null>) {
    const entry = { promise, bytes: 0 };
    this.entries.set(key, entry);
    while (this.size > this.maxEntries) this.delete(this.keys().next().value!);
    void promise
      .then((buffer) => {
        if (this.entries.get(key) !== entry) return;
        if (!buffer) {
          this.delete(key);
          return;
        }
        entry.bytes = buffer.length * buffer.numberOfChannels * 4;
        while (this.bytes > this.maxBytes && this.size)
          this.delete(this.keys().next().value!);
      })
      .catch(() => {
        if (this.entries.get(key) === entry) this.delete(key);
      });
  }
  delete(key: string) {
    return this.entries.delete(key);
  }
  clear() {
    this.entries.clear();
  }
}
