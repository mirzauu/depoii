"use client";

import React, { useEffect, useState, useRef } from "react";
import { DepoiiMark } from "@/components/depoii-logo";
import { Check, X, Shield, ArrowRight } from "lucide-react";

export function LandingLeadModal({ formMode = "api" }: { formMode?: "api" | "netlify" }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if already dismissed or submitted in this session
    if (typeof window === "undefined") return;
    const isDismissed = sessionStorage.getItem("depoii:lead-modal-dismissed");
    const isSubmitted = localStorage.getItem("depoii:lead-modal-submitted");
    if (isDismissed || isSubmitted) return;

    // Check query param for immediate testing: ?modal=true
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("modal") === "true") {
      setOpen(true);
      return;
    }

    let hasTriggered = false;

    const triggerModal = () => {
      if (hasTriggered) return;
      hasTriggered = true;
      setOpen(true);
    };

    // 1. Scroll depth trigger: trigger when scrolled 35% down
    const onScroll = () => {
      if (hasTriggered) return;
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0 && scrollY / docHeight >= 0.35) {
        triggerModal();
      }
    };

    // 2. Idle dwell trigger: trigger if user has spent 18 seconds on page
    const idleTimer = setTimeout(() => {
      triggerModal();
    }, 18000);

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const handleDismiss = () => {
    setOpen(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("depoii:lead-modal-dismissed", "true");
    }
  };

  // Close on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        handleDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid work email.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        email: email.trim(),
        name: "Commercial Contractor (Modal)",
        company: "Commercial Roofing Contractor",
        territory: "Dallas–Fort Worth, TX",
        sizeRange: "Commercial 25k+ sq ft",
        source: "Landing Page Scroll/Idle Modal (Option 3)",
      };

      const res = await fetch("/api/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit request.");
      }

      setSubmitted(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("depoii:lead-modal-submitted", "true");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Submission failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="depoii-lead-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <div className="relative w-full max-w-[420px] rounded-2xl border border-neutral-200 bg-white p-7 text-center shadow-2xl sm:p-8 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        {!submitted ? (
          <>
            {/* Depoii Brand Mark */}
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100">
              <DepoiiMark className="size-6 text-neutral-900" />
            </div>

            {/* Modal Title */}
            <h3
              id="depoii-lead-modal-title"
              className="text-xl font-bold tracking-tight text-neutral-950 sm:text-[1.45rem]"
            >
              See Depoii in action
            </h3>

            {/* Subhead / Value Prop */}
            <p className="mt-2 text-[13.5px] leading-relaxed text-neutral-600">
              Find every $250k+ commercial roof replacement in Dallas–Fort Worth before competitors spot the leak.
            </p>

            {/* Email Form */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <div>
                <input
                  type="email"
                  required
                  placeholder="Enter work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 w-full rounded-xl border border-neutral-300 px-4 text-sm text-neutral-900 placeholder:text-neutral-400 transition focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  autoFocus
                />
              </div>

              {error ? (
                <p className="text-xs text-rose-600 font-medium text-left">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60 cursor-pointer"
              >
                {loading ? "Checking territory availability..." : "Claim territory access →"}
              </button>
            </form>

            {/* Scarcity Note */}
            <p className="mt-3.5 text-[11.5px] leading-relaxed text-neutral-500">
              Capped at 2 commercial contractors per DFW territory. We send availability to your email.
            </p>

            {/* Trust badge */}
            <div className="mt-4 flex items-center justify-center gap-1.5 border-t border-neutral-100 pt-3 text-[11px] font-medium text-neutral-400">
              <Shield className="h-3 w-3 text-emerald-600" />
              <span>100% Source-Verified · Dallas CAD · NOAA SPC · Municipal Permits</span>
            </div>

            {/* Continue Scrolling Link */}
            <div className="mt-3">
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs font-semibold text-neutral-500 transition hover:text-neutral-900 underline underline-offset-4 cursor-pointer"
              >
                Continue reading product tour →
              </button>
            </div>
          </>
        ) : (
          <div className="py-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check className="h-6 w-6 stroke-[2.5]" />
            </div>

            <h3 className="mt-4 text-lg font-bold text-neutral-950">
              Territory Request Received
            </h3>

            <p className="mt-2 text-sm text-neutral-600">
              We have logged your request for <strong className="text-neutral-900">{email}</strong>. Our team will verify territory availability and reach out to you shortly.
            </p>

            <button
              type="button"
              onClick={handleDismiss}
              className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 cursor-pointer"
            >
              <span>Continue exploring platform</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
