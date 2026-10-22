"use client";

import { useEffect, useState } from "react";
import { engineGet } from "@/lib/engine-api";

type Entry = { data: unknown; error: string | null; fetchedAt: string | null; stale: boolean };

const cache = new Map<string, Entry>();
const lastGood = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry>>();

function loadEntry(key: string, map: (body: unknown) => unknown) {
  const pending = inflight.get(key);
  if (pending) return pending;
  const [path, params] = JSON.parse(key) as [string, Record<string, string | number | boolean | null>];
  const request = engineGet(path, params, map)
    .then((data): Entry => ({ data, error: null, fetchedAt: new Date().toISOString(), stale: false }))
    .catch((error: unknown): Entry => {
      const message = error instanceof Error ? error.message : "The data engine did not respond.";
      const prior = lastGood.get(key);
      if (prior) return { data: prior.data, error: null, fetchedAt: prior.fetchedAt, stale: true };
      return { data: null, error: message, fetchedAt: null, stale: false };
    })
    .then((entry) => {
      cache.set(key, entry);
      if (!entry.stale && entry.data != null) lastGood.set(key, entry);
      inflight.delete(key);
      return entry;
    });
  inflight.set(key, request);
  return request;
}

export function useEngine<T>(path: string, params: Record<string, string | number | boolean | undefined | null>, map: (body: unknown) => T, enabled = true) {
  const key = JSON.stringify([path, params]);
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null; fetchedAt: string | null; stale: boolean }>({ key: "", data: null, error: null, fetchedAt: null, stale: false });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const apply = (entry: Entry) => {
      if (!cancelled) setState({ key, data: entry.data as T, error: entry.error, fetchedAt: entry.fetchedAt, stale: entry.stale });
    };
    if (reload === 0) {
      const hit = cache.get(key);
      if (hit) {
        apply(hit);
        return;
      }
    } else {
      cache.delete(key);
    }
    void loadEntry(key, map).then(apply);
    return () => {
      cancelled = true;
    };
    // map is a stable module function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reload, enabled]);

  const fresh = !enabled || state.key === key;
  return {
    data: enabled && fresh ? state.data : null,
    error: enabled && fresh ? state.error : null,
    loading: enabled && !fresh,
    fetchedAt: enabled && fresh ? state.fetchedAt : null,
    stale: enabled && fresh ? state.stale : false,
    retry: () => setReload((n) => n + 1),
  };
}
