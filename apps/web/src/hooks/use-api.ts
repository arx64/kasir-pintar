'use client';

import { useCallback, useEffect, useState } from 'react';

type CacheEntry = { data: unknown; ts: number };

// Cache in-memory antar halaman: data lama langsung ditampilkan (instant),
// lalu di-refetch di background (stale-while-revalidate).
const cache = new Map<string, CacheEntry>();

export function useApi<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  opts?: { ttl?: number }
) {
  const ttl = opts?.ttl ?? 60_000;
  const [data, setData] = useState<T | null>(() =>
    key && cache.has(key) ? (cache.get(key)!.data as T) : null
  );
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState('');

  const run = useCallback(() => {
    if (!key) return;
    let active = true;
    const entry = cache.get(key);
    const fresh = entry && Date.now() - entry.ts < ttl;
    if (entry) {
      setData(entry.data as T);
      setLoading(false);
    }
    if (fresh) return () => { active = false; };
    if (!entry) setLoading(true);
    fetcher()
      .then((res) => {
        if (!active) return;
        cache.set(key, { data: res as unknown, ts: Date.now() });
        setData(res);
        setError('');
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat data');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ttl]);

  useEffect(() => {
    const cleanup = run();
    return () => cleanup?.();
  }, [run]);

  const refresh = useCallback(() => {
    if (!key) return;
    cache.delete(key);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, run]);

  return { data, loading, error, refresh };
}

// Bersihkan cache untuk key tertentu (mis. setelah mutasi).
export function invalidateApi(key: string) {
  cache.delete(key);
}

export function clearApiCache() {
  cache.clear();
}
