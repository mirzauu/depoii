"use client";

import { useState } from "react";
import { 
  ClipboardCheck, 
  CheckCircle2, 
  X, 
  Building2, 
  MapPin, 
  AlertTriangle, 
  DollarSign, 
  FileText 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { num, usd } from "@/lib/format";
import type { FieldOutcome } from "@/lib/types";

export interface InspectionTarget {
  parcelId: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  ownerName?: string;
  buildingSqft?: number;
  stormId?: string;
  predictedScore?: number;
  claimId?: string;
}

interface ModalProps {
  target: InspectionTarget | null;
  onClose: () => void;
  onSuccess: (outcome: FieldOutcome) => void;
}

export function InspectionOutcomeModal({ target, onClose, onSuccess }: ModalProps) {
  const [moisture, setMoisture] = useState(true);
  const [scope, setScope] = useState<FieldOutcome["scope"]>("replacement");
  const [contractValue, setContractValue] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const numericVal = Number(contractValue.replace(/[^0-9.]/g, "")) || 0;
    const outcomeData: FieldOutcome = {
      id: crypto.randomUUID(),
      parcelId: target.parcelId,
      stormId: target.stormId || "storm-dallas-2026",
      loggedAt: new Date().toISOString().slice(0, 10),
      predictedScore: target.predictedScore || 85,
      factors: { severity: 0.35, age: 0.25, footprint: 0.20, permitAbsence: 0.20 },
      moistureVerified: moisture,
      scope,
      contractValue: numericVal,
      notes: notes.trim(),
    };

    try {
      // 1. Submit to Field Outcomes API
      const res = await fetch("/api/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outcomeData),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to record field outcome.");
      }

      // 2. If this came from a claim, also log activity on the claim to reset the timer
      if (target.claimId) {
        await fetch(`/api/claims/${target.claimId}/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activityType: numericVal > 0 ? "bid_submitted" : "site_visit",
            notes: `Field Inspection Logged: ${moisture ? "Damage verified" : "No damage"}, scope: ${scope}${numericVal ? `, contract: $${numericVal.toLocaleString()}` : ""}${notes ? `. Notes: ${notes}` : ""}`,
          }),
        }).catch(() => {});
      }

      onSuccess(outcomeData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving inspection finding.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-lg rounded-xl border border-neutral-800 bg-[#0e0f14] p-5 shadow-2xl text-xs text-neutral-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-800/80 pb-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ClipboardCheck className="size-4 text-sky-400" />
              Record Field Inspection Outcome
            </h2>
            <p className="text-[11px] text-neutral-400">
              Closed-loop verification. Physical results train and calibrate the predictive scoring model.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Property Summary Pill */}
        <div className="rounded-lg border border-neutral-800 bg-[#14151c] p-3 space-y-1.5">
          <div className="font-semibold text-white text-xs flex items-center justify-between">
            <span>{target.address || "Commercial Building"}</span>
            {target.buildingSqft ? (
              <span className="text-[10px] text-neutral-400 font-mono">
                {num(target.buildingSqft)} sq ft
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-neutral-400">
            <span className="flex items-center gap-1">
              <MapPin className="size-3 text-neutral-500" />
              {[target.city, target.state, target.zipCode].filter(Boolean).join(", ")}
            </span>
            {target.ownerName && (
              <span className="truncate max-w-[200px]">
                Owner: {target.ownerName}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-[#DE7272]/30 bg-[#DE7272]/10 p-2 text-xs text-[#DE7272] flex items-center gap-2">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Inspection Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* 1. Moisture & Physical Damage Verified */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Physical Storm / Moisture Damage Verified?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMoisture(true)}
                className={`flex items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-semibold transition-colors ${
                  moisture
                    ? "border-[#B4E4D6]/50 bg-[#B4E4D6]/10 text-[#B4E4D6] ring-1 ring-[#B4E4D6]/30"
                    : "border-neutral-800 bg-[#161720] text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <CheckCircle2 className="size-3.5" />
                <span>Damage Verified (Moisture/Hail)</span>
              </button>
              <button
                type="button"
                onClick={() => setMoisture(false)}
                className={`flex items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-semibold transition-colors ${
                  !moisture
                    ? "border-neutral-600 bg-neutral-800 text-neutral-200"
                    : "border-neutral-800 bg-[#161720] text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <span>No Damage / Clean Roof</span>
              </button>
            </div>
          </div>

          {/* 2. Approved Scope */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Recommended / Approved Scope
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as FieldOutcome["scope"])}
              className="h-8 w-full rounded-md border border-neutral-800 bg-[#161720] px-2.5 text-xs text-white outline-none focus:border-neutral-700 cursor-pointer"
            >
              <option value="replacement">Full roof replacement approved</option>
              <option value="repair">Commercial repair / patch scope approved</option>
              <option value="none">No damage / no commercial scope</option>
            </select>
          </div>

          {/* 3. Contract Value Awarded */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Contract Value Awarded (USD)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="e.g. 175000 (leave blank or 0 if bid pending)"
                className="h-8 w-full rounded-md border border-neutral-800 bg-[#161720] pl-6 pr-2.5 text-xs text-white outline-none placeholder:text-neutral-600 focus:border-neutral-700 font-mono"
              />
            </div>
          </div>

          {/* 4. Field Inspection Notes */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Field & Inspection Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Infrared scan verified wet polyiso insulation around north drains; 1.5 inch hail strikes on metal flashing…"
              rows={2}
              className="w-full rounded-md border border-neutral-800 bg-[#161720] p-2 text-xs text-white outline-none placeholder:text-neutral-600 focus:border-neutral-700"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800/80">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={submitting}
              className="h-8 text-xs text-neutral-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="brand"
              disabled={submitting}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <ClipboardCheck className="size-3.5" />
              <span>{submitting ? "Saving Outcome..." : "Save Outcome & Calibrate Model"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
