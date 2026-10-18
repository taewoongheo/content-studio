/** Byte-bounded LRU; keys include tab identity and revision so edits cannot reuse stale pixels. */
export class PreviewCache {
  private entries = new Map<string, Buffer>();
  private bytes = 0;
  constructor(private readonly maxBytes = 32 * 1024 * 1024, private readonly maxEntries = 80) {}
  get(key: string) {
    const value = this.entries.get(key);
    if (value) { this.entries.delete(key); this.entries.set(key, value); }
    return value;
  }
  set(key: string, value: Buffer) {
    const before = this.entries.get(key); if (before) this.bytes -= before.length;
    this.entries.delete(key);
    if (value.length > this.maxBytes) return;
    this.entries.set(key, value); this.bytes += value.length;
    while (this.bytes > this.maxBytes || this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value!; this.bytes -= this.entries.get(oldest)!.length; this.entries.delete(oldest);
    }
  }
}
