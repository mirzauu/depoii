"use client";

import { useEffect, useState } from "react";
import { engineGet } from "@/lib/engine-api";

type Entry = { data: unknown; error: string | null; fetchedAt: string | null; stale: boolean };

const cache = new Map<string, Entry>();
const lastGood = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry>>();

function getSessionEntry(key: string): Entry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem("depoii_eng_" + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.data != null) {
      return parsed as Entry;
    }
  } catch {}
  return null;
}

function setSessionEntry(key: string, entry: Entry) {
  if (typeof window === "undefined" || !entry.data) return;
  try {
    window.sessionStorage.setItem("depoii_eng_" + key, JSON.stringify(entry));
  } catch {}
}

function loadEntry(key: string, map: (body: unknown) => unknown) {
  const pending = inflight.get(key);
  if (pending) return pending;
  const [path, params] = JSON.parse(key) as [string, Record<string, string | number | boolean | null>];
  const request = engineGet(path, params, map)
    .then((data): Entry => {
      const entry: Entry = { data, error: null, fetchedAt: new Date().toISOString(), stale: false };
      setSessionEntry(key, entry);
      return entry;
    })
    .catch((error: unknown): Entry => {
      const message = error instanceof Error ? error.message : "The data engine did not respond.";
      const prior = lastGood.get(key) || getSessionEntry(key);
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
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null; fetchedAt: string | null; stale: boolean }>(() => {
    if (!enabled) return { key: "", data: null, error: null, fetchedAt: null, stale: false };
    const hit = cache.get(key) || getSessionEntry(key);
    if (hit) {
      if (!cache.has(key)) cache.set(key, hit);
      return { key, data: hit.data as T, error: hit.error, fetchedAt: hit.fetchedAt, stale: hit.stale };
    }
    return { key: "", data: null, error: null, fetchedAt: null, stale: false };
  });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const apply = (entry: Entry) => {
      if (!cancelled) setState({ key, data: entry.data as T, error: entry.error, fetchedAt: entry.fetchedAt, stale: entry.stale });
    };

    if (reload === 0) {
      const hit = cache.get(key) || getSessionEntry(key);
      if (hit) {
        apply(hit);
        // If entry is fresh (< 90 seconds old), no background fetch needed
        const age = hit.fetchedAt ? Date.now() - new Date(hit.fetchedAt).getTime() : Infinity;
        if (age < 90_000) {
          return;
        }
      }
    } else {
      cache.delete(key);
      if (typeof window !== "undefined") {
        try { window.sessionStorage.removeItem("depoii_eng_" + key); } catch {}
      }
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
    loading: enabled && (!fresh || (state.data == null && !state.error)),
    fetchedAt: enabled && fresh ? state.fetchedAt : null,
    stale: enabled && fresh ? state.stale : false,
    retry: () => setReload((n) => n + 1),
  };
}
