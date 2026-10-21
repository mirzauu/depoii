"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Play, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { cn } from "cn";
import { useDepoiiState } from "./depoii-provider";
import { triggerCityVerification, type VerificationProgressEvent } from "@/lib/engine-api";
import { usd } from "@/lib/format";

const STAGES = [
  { id: "HYGIENE", label: "Building screen", desc: "Drops small buildings, apartments, and church or government owners." },
  { id: "HAIL_PROXIMITY", label: "Hail distance", desc: "Keeps buildings within 2.5 miles of a severe hail report." },
  { id: "CAD_AUDIT", label: "County record", desc: "Checks the live appraisal roll for owner, size, and year built." },
  { id: "PERMITS", label: "Repair permits", desc: "Looks for a roof permit filed after the storm." },
  { id: "AERIALS", label: "Roof photo", desc: "Saves a current satellite image of the roof." },
];

export function CityVerificationModal({ className }: { className?: string }) {
  const { jurisdiction } = useDepoiiState();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string>("HYGIENE");
  const [message, setMessage] = useState<string>("");
  const [stepData, setStepData] = useState<Record<string, unknown>>({});
  const [summary, setSummary] = useState<{ total_verified: number; pipeline_value_usd: number; aerials_cached: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const city = jurisdiction ? jurisdiction.split(",")[0].trim() : "Fort Worth";

  const closeStream = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    return () => closeStream();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !running) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, running]);

  const startVerification = async () => {
    setError(null);
    setSummary(null);
    setRunning(true);
    setProgress(5);
    setCurrentStep("HYGIENE");
    setMessage("Initializing 5-stage verification audit...");
    setStepData({});

    try {
      const res = await triggerCityVerification(city);
      // Jobs queue: the local engine worker claims the job; poll for progress.
      closeStream();
      const poll = async () => {
        try {
          const r = await fetch(`/api/engine/verifications/jobs/${encodeURIComponent(res.job_id)}`);
          const job = await r.json().catch(() => null);
          if (!job) return;
          const payload = job as VerificationProgressEvent & { status?: string; result?: { total_verified: number; pipeline_value_usd: number; aerials_cached: number }; error?: string };
          setProgress(payload.pct || job.progress || 0);
          if (payload.step || job.step) setCurrentStep((payload.step || job.step) as string);
          if (payload.message || job.message) setMessage((payload.message || job.message) as string);
          if (job.status === "complete") {
            const finalData = job.result || { total_verified: 0, pipeline_value_usd: 0, aerials_cached: 0 };
            setProgress(100);
            setSummary(finalData);
            setMessage(`Audit complete: ${finalData.total_verified} commercial buildings fully verified.`);
            setRunning(false);
            closeStream();
          } else if (job.status === "error") {
            setError(job.error || "Verification run encountered an error.");
            setRunning(false);
            closeStream();
          }
        } catch {}
      };
      pollRef.current = setInterval(() => void poll(), 2000);
      void poll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch verification.");
      setRunning(false);
    }
  };

  const handleFinish = () => {
    setOpen(false);
    // Reload page data to reflect newly verified leads and scores
    if (summary) window.location.reload();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 transition hover:bg-emerald-500/20 dark:text-emerald-400",
          className,
        )}
        title={`Audit and verify commercial buildings in ${city}`}
      >
        <ShieldCheck className="size-3.5" />
        <span>Audit {city}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !running) setOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="audit-title" className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl">
            <button
              type="button"
              onClick={() => !running && setOpen(false)}
              disabled={running}
              aria-label="Close"
              className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <X className="size-4" />
            </button>

            <div className="pr-8">
              <h3 id="audit-title" className="text-base font-semibold text-foreground">Verify {jurisdiction || city}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Five checks against live county, hail, permit, and satellite records.</p>
            </div>

            <ol className="mt-4 divide-y divide-border rounded-lg border border-border">
              {STAGES.map((s, idx) => {
                const isCurrent = currentStep === s.id && running;
                const isPassed =
                  (s.id === "HYGIENE" && progress >= 25) ||
                  (s.id === "HAIL_PROXIMITY" && progress >= 45) ||
                  (s.id === "CAD_AUDIT" && progress >= 70) ||
                  (s.id === "PERMITS" && progress >= 88) ||
                  (s.id === "AERIALS" && progress === 100);

                return (
                  <li key={s.id} className={cn("flex items-start gap-3 px-3 py-2.5", isCurrent && "bg-sky-500/5")}>
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
                      {isPassed ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : isCurrent ? (
                        <Loader2 className="size-4 animate-spin text-sky-400" />
                      ) : (
                        <span className="flex size-5 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground">
                          {idx + 1}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block text-sm font-medium", isCurrent ? "text-sky-400" : isPassed ? "text-foreground" : "text-muted-foreground")}>
                        {s.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{s.desc}</span>
                    </span>
                  </li>
                );
              })}
            </ol>

            {/* Progress Bar & Status Text */}
            {(running || progress > 0) && (
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="truncate">{message || "Auditing..."}</span>
                  <span className="font-mono">{progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
                <ShieldAlert className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Summary Result Card */}
            {summary && (
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                <div>
                  <p className="text-[11px] text-muted-foreground">Verified Leads</p>
                  <p className="text-base font-semibold text-emerald-400">{summary.total_verified}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Pipeline Value</p>
                  <p className="text-base font-semibold text-foreground">{usd(summary.pipeline_value_usd, true)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Aerials Cached</p>
                  <p className="text-base font-semibold text-foreground">{summary.aerials_cached}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-5 flex items-center justify-end gap-2">
              {!summary ? (
                <>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={running}
                    className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={startVerification}
                    disabled={running}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {running ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Auditing {city}…
                      </>
                    ) : (
                      <>
                        <Play className="size-3.5" />
                        Start audit
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
