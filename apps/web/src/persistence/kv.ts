import type { KeyValueStore } from "./types.js";

/** In-memory store. Used by tests and as a safe fallback when IndexedDB is unavailable. */
export class MemoryKeyValueStore implements KeyValueStore {
  private readonly map = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.has(key) ? (structuredClone(this.map.get(key)) as T) : undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, structuredClone(value));
  }

  async remove(key: string): Promise<void> {
    this.map.delete(key);
  }

  async keys(): Promise<string[]> {
    return [...this.map.keys()];
  }
}

const DB_NAME = "grafture";
const STORE_NAME = "kv";
const DB_VERSION = 1;

/**
 * IndexedDB-backed key/value store. A single object store keyed by string — nothing leaves
 * the browser. Opens lazily and reuses the connection.
 */
export class IndexedDbKeyValueStore implements KeyValueStore {
  private dbPromise?: Promise<IDBDatabase>;

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  private async run<T>(
    mode: IDBTransactionMode,
    make: (store: IDBObjectStore) => IDBRequest,
  ): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const request = make(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.run<T | undefined>("readonly", (store) => store.get(key));
    return value ?? undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.run("readwrite", (store) => store.put(value, key));
  }

  async remove(key: string): Promise<void> {
    await this.run("readwrite", (store) => store.delete(key));
  }

  async keys(): Promise<string[]> {
    const keys = await this.run<IDBValidKey[]>("readonly", (store) => store.getAllKeys());
    return keys.map(String);
  }
}
