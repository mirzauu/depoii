"use client";

import { useEffect, useState } from "react";

export type Me = {
  id?: string;
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  role: string;
  platformRole: string;
  contractorId?: string | null;
  permissions?: string[];
};

let cachedMe: Me | null = null;
let mePromise: Promise<Me | null> | null = null;

export function fetchMe(force = false): Promise<Me | null> {
  if (cachedMe && !force) return Promise.resolve(cachedMe);
  if (mePromise && !force) return mePromise;

  mePromise = fetch("/api/auth/me")
    .then((res) => (res.ok ? res.json() : null))
    .then((body: Me | null) => {
      cachedMe = body;
      mePromise = null;
      return body;
    })
    .catch(() => {
      cachedMe = null;
      mePromise = null;
      return null;
    });

  return mePromise;
}

export function invalidateMeCache() {
  cachedMe = null;
  mePromise = null;
}

export function useMe() {
  const [me, setMe] = useState<Me | null>(() => cachedMe);

  useEffect(() => {
    let cancel = false;
    fetchMe().then((body) => {
      if (!cancel) setMe(body);
    });
    return () => {
      cancel = true;
    };
  }, []);

  return me;
}
