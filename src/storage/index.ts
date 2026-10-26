import { IndexedDbStorage } from "./indexedDb.ts";
import { MemoryStorage } from "./memory.ts";
import type { LedgerStorage } from "./types.ts";

export type { LedgerStorage, LoadResult } from "./types.ts";

export async function createStorage(): Promise<LedgerStorage> {
  if (typeof indexedDB === "undefined") return new MemoryStorage();
  try {
    return await IndexedDbStorage.open();
  } catch {
    return new MemoryStorage();
  }
}
