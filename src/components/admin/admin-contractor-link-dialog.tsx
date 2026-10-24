"use client";

import { useEffect, useState } from "react";
import { Search, HardHat, Check, ShieldCheck, Unlink, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { adminFetch } from "./admin-ui";

interface ContractorOption {
  id: string;
  canonicalName: string;
  headquartersCity: string | null;
  headquartersState: string | null;
  totalPermits: number;
  totalValuation: number;
  primaryRoofSystem: string | null;
  phoneNumber: string | null;
  websiteUrl: string | null;
  bbbRating: string | null;
  bbbAccredited: boolean;
}

interface AdminContractorLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName: string;
  currentContractorId?: string | null;
  currentContractorName?: string | null;
  onSuccess: () => void;
}

export function AdminContractorLinkDialog({
  open,
  onOpenChange,
  orgId,
  orgName,
  currentContractorId,
  currentContractorName,
  onSuccess,
}: AdminContractorLinkDialogProps) {
  const [search, setSearch] = useState("");
  const [contractors, setContractors] = useState<ContractorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(currentContractorId || null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedId(currentContractorId || null);
    setSearch(currentContractorName || orgName || "");
    loadContractors(currentContractorName || orgName || "");
  }, [open, currentContractorId, currentContractorName, orgName]);

  const loadContractors = async (query: string) => {
    try {
      setLoading(true);
      setError("");
      const res = await adminFetch<{ contractors: ContractorOption[] }>(
        `/api/admin/contractors/search?q=${encodeURIComponent(query.trim())}`
      );
      setContractors(res.contractors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search contractors");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadContractors(search);
  };

  const handleSave = async (contractorIdToSave: string | null) => {
    setPending(true);
    setError("");
    try {
      await adminFetch(`/api/admin/orgs/${orgId}`, {
        method: "PATCH",
        body: JSON.stringify({ contractorId: contractorIdToSave }),
      });
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update contractor link");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <HardHat className="size-5 text-[#B4E4D6]" />
            Connect Contractor Profile
          </DialogTitle>
          <DialogDescription className="text-xs">
            Link <span className="font-semibold text-foreground">{orgName}</span> to a verified municipal roofing contractor profile.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded">{error}</p>}

        {/* Current Status */}
        {currentContractorId && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-[#B4E4D6]/30 bg-[#B4E4D6]/10 text-xs">
            <div className="space-y-0.5">
              <span className="font-semibold text-emerald-800 dark:text-[#B4E4D6] flex items-center gap-1.5">
                <Check className="size-3.5" />
                Currently Linked to:
              </span>
              <p className="font-medium text-foreground">{currentContractorName || currentContractorId}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => handleSave(null)}
              className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Unlink className="size-3 mr-1" />
              Unlink
            </Button>
          </div>
        )}

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 my-2">
          <Input
            placeholder="Search contractor name, DBA, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-xs"
          />
          <Button type="submit" size="sm" variant="outline" className="h-9 px-3" disabled={loading}>
            <Search className="size-3.5" />
          </Button>
        </form>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px]">
          {loading ? (
            <p className="text-xs text-muted-foreground p-4 text-center">Searching canonical contractors…</p>
          ) : contractors.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">No matching contractors found.</p>
          ) : (
            contractors.map((c) => {
              const isSelected = selectedId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`flex items-start justify-between p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? "border-[#B4E4D6] bg-[#B4E4D6]/10 shadow-xs"
                      : "border-border/60 bg-card/40 hover:bg-muted/50"
                  }`}
                >
                  <div className="space-y-1 pr-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-foreground">{c.canonicalName}</span>
                      {c.bbbRating && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1 border-amber-500/30 text-amber-400">
                          BBB {c.bbbRating}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{c.totalPermits} permits</span>
                      <span>${c.totalValuation.toLocaleString()} volume</span>
                      {c.headquartersCity && <span>{c.headquartersCity}, {c.headquartersState}</span>}
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    {isSelected ? (
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#B4E4D6] text-black">
                        <Check className="size-3 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="inline-flex size-5 rounded-full border border-border" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border/50">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={pending || !selectedId || selectedId === currentContractorId}
            onClick={() => handleSave(selectedId)}
            className="bg-[#B4E4D6] hover:bg-[#9dd8c7] text-[#0f4e3e] font-semibold border-none"
          >
            {pending ? "Saving…" : "Save Contractor Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
