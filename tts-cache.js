/**
 * In-memory synthesis coordination. Canonical requests share both an
 * in-flight Promise and a bounded completed-buffer LRU; failures never stick.
 */
export class TtsCache {
  constructor({ ttlMs = 10 * 60 * 1000, maxEntries = 64, maxBytes = 64 * 1024 * 1024, now = Date.now } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.now = now;
    this.inFlight = new Map();
    this.completed = new Map();
    this.completedBytes = 0;
  }

  clear() {
    this.inFlight.clear();
    this.completed.clear();
    this.completedBytes = 0;
  }

  #deleteCompleted(key) {
    const entry = this.completed.get(key);
    if (!entry) return;
    this.completed.delete(key);
    this.completedBytes -= entry.buffer.length;
  }

  #getCompleted(key) {
    const entry = this.completed.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.#deleteCompleted(key);
      return null;
    }
    // Map insertion order is the LRU order. Refresh position, not TTL.
    this.completed.delete(key);
    this.completed.set(key, entry);
    return entry.buffer;
  }

  #storeCompleted(key, buffer) {
    if (buffer.length > this.maxBytes || this.maxEntries < 1) return;
    this.#deleteCompleted(key);
    this.completed.set(key, { buffer, expiresAt: this.now() + this.ttlMs });
    this.completedBytes += buffer.length;
    while (this.completed.size > this.maxEntries || this.completedBytes > this.maxBytes) {
      const oldestKey = this.completed.keys().next().value;
      this.#deleteCompleted(oldestKey);
    }
  }

  async getOrCreate(key, factory) {
    const completed = this.#getCompleted(key);
    if (completed) return { buffer: completed, cache: 'completed' };

    const pending = this.inFlight.get(key);
    if (pending) return { buffer: await pending, cache: 'in-flight' };

    const created = (async () => {
      try {
        const buffer = await factory();
        if (!Buffer.isBuffer(buffer)) throw new Error('TTS cache factory must return a Buffer.');
        this.#storeCompleted(key, buffer);
        return buffer;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, created);
    return { buffer: await created, cache: 'miss' };
  }
}
