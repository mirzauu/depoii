"use client";

import { useState } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  Filter, 
  Search, 
  X, 
  Check, 
  ShieldAlert, 
  Clock, 
  Layers, 
  FileText,
  Building
} from "lucide-react";
import { cn } from "cn";

export type ModalityScope = "total" | "net_new" | "claimed";

export interface ApolloFilterState {
  scope: ModalityScope;
  roofAge: string[];
  stormImpact: string[];
  sqftRange: string[];
  permitStatus: string[];
  propertyType: string[];
}

export const INITIAL_FILTERS: ApolloFilterState = {
  scope: "total",
  roofAge: [],
  stormImpact: [],
  sqftRange: [],
  permitStatus: [],
  propertyType: []
};

interface ApolloFilterDrawerProps {
  filters: ApolloFilterState;
  onChange: (filters: ApolloFilterState) => void;
  isOpen: boolean;
  onToggle: () => void;
  counts?: {
    total: number;
    netNew: number;
    claimed: number;
  };
}

export function ApolloFilterDrawer({
  filters,
  onChange,
  isOpen,
  onToggle,
  counts = { total: 1420, netNew: 1380, claimed: 40 }
}: ApolloFilterDrawerProps) {
  const [filterSearch, setFilterSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    roofAge: true,
    stormImpact: true,
    sqft: false,
    permits: false,
    property: false
  });

  const toggleSection = (section: string) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleScopeChange = (scope: ModalityScope) => {
    onChange({ ...filters, scope });
  };

  const toggleFilterItem = (category: keyof Omit<ApolloFilterState, "scope">, value: string) => {
    const current = filters[category] as string[];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [category]: updated });
  };

  const clearAllFilters = () => {
    onChange({
      ...INITIAL_FILTERS,
      scope: filters.scope
    });
  };

  const activeCount = 
    filters.roofAge.length + 
    filters.stormImpact.length + 
    filters.sqftRange.length + 
    filters.permitStatus.length + 
    filters.propertyType.length;

  if (!isOpen) return null;

  return (
    <aside className="w-64 shrink-0 border-r border-[rgba(250,250,248,0.08)] bg-[#171714] text-[#B9B9B2] flex flex-col h-full text-xs select-none">
      {/* 3-Tier Modality Scopes (Total / Net New / Claimed) */}
      <div className="p-3 border-b border-[rgba(250,250,248,0.06)]">
        <div className="flex rounded-lg bg-[#1F1F1B] p-0.5 border border-[rgba(250,250,248,0.08)]">
          <button
            type="button"
            onClick={() => handleScopeChange("total")}
            className={cn(
              "flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium text-center transition-colors cursor-pointer",
              filters.scope === "total"
                ? "bg-[#262621] text-[#FAFAF8] shadow-xs"
                : "text-[#7D7D75] hover:text-[#FAFAF8]"
            )}
          >
            Total <span className="text-[10px] opacity-70">({counts.total})</span>
          </button>
          <button
            type="button"
            onClick={() => handleScopeChange("net_new")}
            className={cn(
              "flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium text-center transition-colors cursor-pointer",
              filters.scope === "net_new"
                ? "bg-[#262621] text-[#FAFAF8] shadow-xs"
                : "text-[#7D7D75] hover:text-[#FAFAF8]"
            )}
          >
            Net New <span className="text-[10px] opacity-70">({counts.netNew})</span>
          </button>
          <button
            type="button"
            onClick={() => handleScopeChange("claimed")}
            className={cn(
              "flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium text-center transition-colors cursor-pointer",
              filters.scope === "claimed"
                ? "bg-[#262621] text-[#FAFAF8] shadow-xs"
                : "text-[#7D7D75] hover:text-[#FAFAF8]"
            )}
          >
            Claimed <span className="text-[10px] opacity-70">({counts.claimed})</span>
          </button>
        </div>
      </div>

      {/* Filter Search Input */}
      <div className="px-3 py-2 border-b border-[rgba(250,250,248,0.06)]">
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-2 text-[#7D7D75]" />
          <input
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Search filters..."
            className="w-full h-7 pl-8 pr-2.5 bg-[#1F1F1B] rounded-md border border-[rgba(250,250,248,0.08)] text-[12px] text-[#FAFAF8] placeholder-[#7D7D75] outline-none focus:border-[#F2F764]/40"
          />
        </div>
      </div>

      {/* Active Filter Clear & Badges */}
      {activeCount > 0 && (
        <div className="px-3 py-2 border-b border-[rgba(250,250,248,0.06)] flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#FAFAF8]">
            {activeCount} {activeCount === 1 ? "Filter" : "Filters"} Applied
          </span>
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-[11px] text-[#F2F764] hover:underline cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Filter Accordion List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {/* Accordion 1: Roof Age */}
        <div className="border border-[rgba(250,250,248,0.04)] rounded-lg overflow-hidden bg-[#1C1C18]/60">
          <button
            type="button"
            onClick={() => toggleSection("roofAge")}
            className="w-full h-8 px-2.5 flex items-center justify-between text-[12px] font-semibold text-[#FAFAF8] hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 text-[#F2F764]" />
              <span>Roof Age</span>
              {filters.roofAge.length > 0 && (
                <span className="size-4 rounded-full bg-[#F2F764] text-[#1C1C18] font-bold text-[10px] flex items-center justify-center">
                  {filters.roofAge.length}
                </span>
              )}
            </div>
            {expanded.roofAge ? <ChevronDown className="size-3 text-[#7D7D75]" /> : <ChevronRight className="size-3 text-[#7D7D75]" />}
          </button>
          {expanded.roofAge && (
            <div className="p-2 space-y-1 border-t border-[rgba(250,250,248,0.04)] bg-[#171714]/80">
              {[
                { label: "20+ Years (Replacement Imminent)", value: "20+" },
                { label: "15 - 20 Years (Vulnerable)", value: "15-20" },
                { label: "5 - 15 Years (Mid-Life)", value: "5-15" },
                { label: "< 5 Years (New Roof)", value: "<5" },
              ].map((opt) => {
                const checked = filters.roofAge.includes(opt.value);
                return (
                  <label key={opt.value} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-white/[0.04] cursor-pointer text-[12px] text-[#B9B9B2] hover:text-[#FAFAF8]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFilterItem("roofAge", opt.value)}
                      className="size-3.5 rounded border-[rgba(250,250,248,0.2)] bg-[#1F1F1B] accent-[#F2F764]"
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Accordion 2: Storm Impact */}
        <div className="border border-[rgba(250,250,248,0.04)] rounded-lg overflow-hidden bg-[#1C1C18]/60">
          <button
            type="button"
            onClick={() => toggleSection("stormImpact")}
            className="w-full h-8 px-2.5 flex items-center justify-between text-[12px] font-semibold text-[#FAFAF8] hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-3.5 text-amber-400" />
              <span>Storm Impact</span>
              {filters.stormImpact.length > 0 && (
                <span className="size-4 rounded-full bg-[#F2F764] text-[#1C1C18] font-bold text-[10px] flex items-center justify-center">
                  {filters.stormImpact.length}
                </span>
              )}
            </div>
            {expanded.stormImpact ? <ChevronDown className="size-3 text-[#7D7D75]" /> : <ChevronRight className="size-3 text-[#7D7D75]" />}
          </button>
          {expanded.stormImpact && (
            <div className="p-2 space-y-1 border-t border-[rgba(250,250,248,0.04)] bg-[#171714]/80">
              {[
                { label: "Severe Hail (> 1.75\")", value: "severe_hail" },
                { label: "Moderate Hail (1.25\" - 1.75\")", value: "mod_hail" },
                { label: "High Wind (60+ mph)", value: "high_wind" },
                { label: "Recent Storm (< 90 Days)", value: "recent_90d" },
              ].map((opt) => {
                const checked = filters.stormImpact.includes(opt.value);
                return (
                  <label key={opt.value} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-white/[0.04] cursor-pointer text-[12px] text-[#B9B9B2] hover:text-[#FAFAF8]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFilterItem("stormImpact", opt.value)}
                      className="size-3.5 rounded border-[rgba(250,250,248,0.2)] bg-[#1F1F1B] accent-[#F2F764]"
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Accordion 3: Square Footage */}
        <div className="border border-[rgba(250,250,248,0.04)] rounded-lg overflow-hidden bg-[#1C1C18]/60">
          <button
            type="button"
            onClick={() => toggleSection("sqft")}
            className="w-full h-8 px-2.5 flex items-center justify-between text-[12px] font-semibold text-[#FAFAF8] hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Layers className="size-3.5 text-blue-400" />
              <span>Building Sq Ft</span>
              {filters.sqftRange.length > 0 && (
                <span className="size-4 rounded-full bg-[#F2F764] text-[#1C1C18] font-bold text-[10px] flex items-center justify-center">
                  {filters.sqftRange.length}
                </span>
              )}
            </div>
            {expanded.sqft ? <ChevronDown className="size-3 text-[#7D7D75]" /> : <ChevronRight className="size-3 text-[#7D7D75]" />}
          </button>
          {expanded.sqft && (
            <div className="p-2 space-y-1 border-t border-[rgba(250,250,248,0.04)] bg-[#171714]/80">
              {[
                { label: "50,000+ Sq Ft (Enterprise)", value: "50k+" },
                { label: "25,000 - 50,000 Sq Ft", value: "25k-50k" },
                { label: "10,000 - 25,000 Sq Ft", value: "10k-25k" },
                { label: "< 10,000 Sq Ft (Small Commercial)", value: "<10k" },
              ].map((opt) => {
                const checked = filters.sqftRange.includes(opt.value);
                return (
                  <label key={opt.value} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-white/[0.04] cursor-pointer text-[12px] text-[#B9B9B2] hover:text-[#FAFAF8]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFilterItem("sqftRange", opt.value)}
                      className="size-3.5 rounded border-[rgba(250,250,248,0.2)] bg-[#1F1F1B] accent-[#F2F764]"
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Accordion 4: Permits */}
        <div className="border border-[rgba(250,250,248,0.04)] rounded-lg overflow-hidden bg-[#1C1C18]/60">
          <button
            type="button"
            onClick={() => toggleSection("permits")}
            className="w-full h-8 px-2.5 flex items-center justify-between text-[12px] font-semibold text-[#FAFAF8] hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FileText className="size-3.5 text-emerald-400" />
              <span>Permit Activity</span>
            </div>
            {expanded.permits ? <ChevronDown className="size-3 text-[#7D7D75]" /> : <ChevronRight className="size-3 text-[#7D7D75]" />}
          </button>
          {expanded.permits && (
            <div className="p-2 space-y-1 border-t border-[rgba(250,250,248,0.04)] bg-[#171714]/80">
              {[
                { label: "Recent Roof Permit (< 1 yr)", value: "permit_1yr" },
                { label: "No Permit History", value: "no_permit" },
              ].map((opt) => {
                const checked = filters.permitStatus.includes(opt.value);
                return (
                  <label key={opt.value} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-white/[0.04] cursor-pointer text-[12px] text-[#B9B9B2] hover:text-[#FAFAF8]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFilterItem("permitStatus", opt.value)}
                      className="size-3.5 rounded border-[rgba(250,250,248,0.2)] bg-[#1F1F1B] accent-[#F2F764]"
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Accordion 5: Property Type */}
        <div className="border border-[rgba(250,250,248,0.04)] rounded-lg overflow-hidden bg-[#1C1C18]/60">
          <button
            type="button"
            onClick={() => toggleSection("property")}
            className="w-full h-8 px-2.5 flex items-center justify-between text-[12px] font-semibold text-[#FAFAF8] hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Building className="size-3.5 text-purple-400" />
              <span>Property Type</span>
            </div>
            {expanded.property ? <ChevronDown className="size-3 text-[#7D7D75]" /> : <ChevronRight className="size-3 text-[#7D7D75]" />}
          </button>
          {expanded.property && (
            <div className="p-2 space-y-1 border-t border-[rgba(250,250,248,0.04)] bg-[#171714]/80">
              {[
                { label: "Warehouse / Distribution", value: "warehouse" },
                { label: "Retail Center / Mall", value: "retail" },
                { label: "Commercial Office", value: "office" },
                { label: "Industrial Facility", value: "industrial" },
              ].map((opt) => {
                const checked = filters.propertyType.includes(opt.value);
                return (
                  <label key={opt.value} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-white/[0.04] cursor-pointer text-[12px] text-[#B9B9B2] hover:text-[#FAFAF8]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFilterItem("propertyType", opt.value)}
                      className="size-3.5 rounded border-[rgba(250,250,248,0.2)] bg-[#1F1F1B] accent-[#F2F764]"
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

