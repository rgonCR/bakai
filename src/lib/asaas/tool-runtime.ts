/** Guardrails leves do runtime (escopo §7) — timeout e cache de leituras. */

const TOOL_TIMEOUT_MS = 10_000;
const SALDO_TTL_MS = 30_000;
const EXTRATO_TTL_MS = 5 * 60_000;

type CacheEntry<T> = { value: T; expiresAt: number };

const saldoCache = new Map<string, CacheEntry<unknown>>();
const extratoCache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(map: Map<string, CacheEntry<unknown>>, key: string): T | undefined {
  const hit = map.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    map.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function cacheSet(
  map: Map<string, CacheEntry<unknown>>,
  key: string,
  value: unknown,
  ttlMs: number,
) {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export async function withToolTimeout<T>(
  promise: Promise<T>,
  label = "tool",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timeout na tool ${label} (${TOOL_TIMEOUT_MS / 1000}s).`));
        }, TOOL_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function cachedSaldo<T>(
  accountKey: string,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = cacheGet<T>(saldoCache, accountKey);
  if (hit !== undefined) return hit;
  const value = await withToolTimeout(loader(), "get_saldo");
  // só cacheia sucesso tipado com ok
  if (value && typeof value === "object" && "ok" in value && (value as { ok: boolean }).ok) {
    cacheSet(saldoCache, accountKey, value, SALDO_TTL_MS);
  }
  return value;
}

export async function cachedExtrato<T>(
  accountKey: string,
  periodKey: string,
  loader: () => Promise<T>,
): Promise<T> {
  const key = `${accountKey}:${periodKey}`;
  const hit = cacheGet<T>(extratoCache, key);
  if (hit !== undefined) return hit;
  const value = await withToolTimeout(loader(), "get_extrato");
  if (value && typeof value === "object" && "ok" in value && (value as { ok: boolean }).ok) {
    cacheSet(extratoCache, key, value, EXTRATO_TTL_MS);
  }
  return value;
}

/** Invalida caches de leitura após escrita (Pix, cobrança, boleto…). */
export function invalidateReadCaches(accountKey: string) {
  saldoCache.delete(accountKey);
  for (const key of extratoCache.keys()) {
    if (key.startsWith(`${accountKey}:`)) extratoCache.delete(key);
  }
}
