import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

// A blank spinner every time a screen mounts — even for data that hasn't changed since the last
// visit, or since the app was last closed — is what made opening the Inbox or Overview feel slow.
// This keeps two caches per query key: an in-memory Map (survives screen unmount/remount within
// the same app session, e.g. switching tabs) and AsyncStorage (survives a cold app relaunch, when
// the in-memory cache is empty again). Either one lets the last-known data render instantly while
// a real fetch runs in the background and replaces it — never trusted as the final answer, always
// just what's shown while today's answer is still in flight.
const memoryCache = new Map<string, unknown>();

function storageKey(key: string): string {
  return `chatmeo:cache:${key}`;
}

type UseCachedQueryOptions = {
  /** Re-fetch on this interval (ms) while the screen is focused, for surfacing new data (a new
   * inbound message, say) without a manual pull-to-refresh. Cleared on blur. Omit to only fetch
   * on mount/focus/manual refresh. */
  refetchIntervalMs?: number;
};

type UseCachedQueryResult<T> = {
  data: T | null;
  /** True only while there's truly nothing to show yet — no memory cache, no AsyncStorage cache,
   * first fetch still in flight. A screen should only show its blank/spinner state on this. */
  loading: boolean;
  /** True while a manual pull-to-refresh is in flight — distinct from `loading` so a
   * RefreshControl doesn't also fight with an already-visible cached list. */
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Updates the cached value locally (in memory and in AsyncStorage) without waiting on a
   * network round-trip — for an optimistic UI change (archiving a row, appending a just-sent
   * message) that a later background refetch will reconcile with the server's own answer. */
  setData: (updater: T | ((current: T | null) => T)) => void;
};

export function useCachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCachedQueryOptions = {},
): UseCachedQueryResult<T> {
  const { refetchIntervalMs } = options;
  const hasMemoryCache = memoryCache.has(key);
  const [data, setDataState] = useState<T | null>(() => (hasMemoryCache ? (memoryCache.get(key) as T) : null));
  const [loading, setLoading] = useState(!hasMemoryCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kept current after every render (in an effect, not during render itself — React Compiler
  // flags a ref write during render even for this "latest callback" pattern) without becoming an
  // effect dependency — runFetch below stays a stable function identity keyed only on `key`, so
  // it's safe to depend on from useFocusEffect without refetching every time the caller passes a
  // fresh fetcher closure. Safe timing-wise: runFetch is only ever invoked later, from a focus
  // event or an interval callback, always after this effect has already committed.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });
  const hydratedFromStorageRef = useRef(hasMemoryCache);

  const setData = useCallback(
    (updater: T | ((current: T | null) => T)) => {
      setDataState((current) => {
        const next = typeof updater === "function" ? (updater as (c: T | null) => T)(current) : updater;
        memoryCache.set(key, next);
        AsyncStorage.setItem(storageKey(key), JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [key],
  );

  const runFetch = useCallback(
    async (isManualRefresh: boolean) => {
      if (isManualRefresh) setRefreshing(true);
      try {
        const result = await fetcherRef.current();
        memoryCache.set(key, result);
        setDataState(result);
        setError(null);
        AsyncStorage.setItem(storageKey(key), JSON.stringify(result)).catch(() => {});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [key],
  );

  // Hydrate from AsyncStorage once per key, only when nothing was already in memory — covers a
  // cold app relaunch, when the in-memory cache from the last session is gone but the persisted
  // one isn't. Skipped entirely once a real fetch has already landed (checked at write-time, not
  // just read-time, so a fast network response can't be clobbered by a slower disk read).
  useEffect(() => {
    if (hydratedFromStorageRef.current) return;
    hydratedFromStorageRef.current = true;
    let cancelled = false;
    AsyncStorage.getItem(storageKey(key))
      .then((raw) => {
        if (cancelled || !raw || memoryCache.has(key)) return;
        const parsed = JSON.parse(raw) as T;
        memoryCache.set(key, parsed);
        setDataState(parsed);
        setLoading(false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key]);

  // Fires on initial mount and every time the screen regains focus (e.g. backing out of a
  // conversation into the Inbox list) — one code path covers both, rather than a separate
  // mount-only effect that would double the very first fetch.
  useFocusEffect(
    useCallback(() => {
      runFetch(false);
    }, [runFetch]),
  );

  // Optional short-interval polling while focused, for surfacing new data (an inbound message)
  // without a manual pull — stopped on blur so a backgrounded screen doesn't keep hitting the
  // network.
  useFocusEffect(
    useCallback(() => {
      if (!refetchIntervalMs) return;
      const interval = setInterval(() => runFetch(false), refetchIntervalMs);
      return () => clearInterval(interval);
    }, [refetchIntervalMs, runFetch]),
  );

  const refresh = useCallback(() => runFetch(true), [runFetch]);

  return { data, loading, refreshing, error, refresh, setData };
}
