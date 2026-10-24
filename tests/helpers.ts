import type { KV } from '../src/shared/storage';

export function memoryKV(
  initial: Record<string, unknown> = {},
): KV & { dump(): Record<string, unknown> } {
  const store: Record<string, unknown> = structuredClone(initial);
  return {
    async get(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of list) if (k in store) out[k] = structuredClone(store[k]);
      return out;
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) store[k] = structuredClone(v);
    },
    async remove(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
    },
    dump: () => store,
  };
}

export const T0 = new Date(2026, 9, 24, 10, 0, 0).getTime();
export const MIN = 60_000;
