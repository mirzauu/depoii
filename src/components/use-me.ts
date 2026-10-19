"use client";

import { useEffect, useState } from "react";

export type Me = {
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  role: string;
  platformRole: string;
};

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let cancel = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: Me | null) => {
        if (!cancel) setMe(body);
      })
      .catch(() => {
        if (!cancel) setMe(null);
      });
    return () => {
      cancel = true;
    };
  }, []);
  return me;
}
