"use client";

import { useEffect } from "react";

const SESSION_KEY = "depoii_session_notified";
const LOCAL_TIME_KEY = "depoii_last_visitor_ping";
const VID_KEY = "depoii_vid";
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export function VisitorTracker() {
  useEffect(() => {
    try {
      // 1. Session check: only once per browser session
      if (sessionStorage.getItem(SESSION_KEY)) {
        return;
      }

      // 2. Cooldown check: only once per 30 minutes even across tabs
      const lastPing = localStorage.getItem(LOCAL_TIME_KEY);
      const now = Date.now();
      if (lastPing && now - Number(lastPing) < COOLDOWN_MS) {
        sessionStorage.setItem(SESSION_KEY, "1");
        return;
      }

      // 3. Persistent anonymous visitor ID
      let visitorId = localStorage.getItem(VID_KEY);
      if (!visitorId) {
        visitorId = typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `v_${Math.random().toString(36).slice(2)}_${Date.now()}`;
        localStorage.setItem(VID_KEY, visitorId);
      }

      // Mark session and local timestamp before firing to prevent race conditions
      sessionStorage.setItem(SESSION_KEY, "1");
      localStorage.setItem(LOCAL_TIME_KEY, String(now));

      // 4. Send non-blocking background visitor notification
      fetch("/api/visitor-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: window.location.pathname + window.location.search,
          referrer: document.referrer || "Direct",
          screen: `${window.screen.width}x${window.screen.height}`,
          visitorId,
        }),
        keepalive: true,
      }).catch(() => {
        // Silently swallow any network error so user experience is never affected
      });
    } catch {
      // Storage access may be blocked in some strict private modes
    }
  }, []);

  return null;
}

