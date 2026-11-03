"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  Search, 
  Command, 
  Building2, 
  FileText, 
  X
} from "lucide-react";
import { CitySelect } from "./app-shell";
import { ThemeToggle } from "./theme-toggle";
import { HeaderTourButton } from "@/components/walkthrough";
import { DepoiiMark } from "./depoii-logo";

export function GlobalHeader() {
  const router = useRouter();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setCmdOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCommandSelect = (href: string) => {
    setCmdOpen(false);
    router.push(href);
  };

  return (
    <>
      <header className="sticky top-0 z-50 h-12 border-b border-[rgba(250,250,248,0.08)] bg-[#171714]/95 backdrop-blur-md px-4 flex items-center justify-between gap-4 text-[#FAFAF8] print:hidden">
        {/* Mobile Brand */}
        <Link href="/" className="flex items-center gap-2 lg:hidden min-w-0 shrink-0">
          <DepoiiMark className="size-6 text-[#FAFAF8]" />
          <span className="font-semibold text-sm">Depoii</span>
        </Link>

        {/* Territory / City Pill */}
        <div className="hidden sm:flex items-center">
          <CitySelect className="max-w-[180px]" />
        </div>

        {/* Apollo-Style Centered Command Search Input Trigger */}
        <div className="flex-1 max-w-xl mx-auto flex justify-center">
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="w-full max-w-md h-8 px-3 rounded-lg border border-[rgba(250,250,248,0.1)] bg-[#1F1F1B] hover:border-[rgba(250,250,248,0.2)] text-[#8E8E86] hover:text-[#FAFAF8] flex items-center justify-between text-xs transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Search className="size-3.5 shrink-0 text-[#7D7D75]" />
              <span className="truncate">Search or ask a question in Depoii...</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-[rgba(250,250,248,0.12)] bg-[#262621] px-1.5 py-0.5 text-[10px] text-[#B9B9B2] font-mono">
              <Command className="size-2.5" /> K
            </kbd>
          </button>
        </div>

        {/* Right Tools & Indicators */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Header Tour & Theme */}
          <HeaderTourButton />
          <ThemeToggle />
        </div>
      </header>

      {/* Global Command Palette Dialog (⌘K) */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-150">
          <div className="w-full max-w-lg rounded-xl border border-[rgba(250,250,248,0.12)] bg-[#1C1C18] text-[#FAFAF8] shadow-2xl overflow-hidden">
            <div className="flex items-center px-3 border-b border-[rgba(250,250,248,0.08)]">
              <Search className="size-4 shrink-0 text-[#7D7D75]" />
              <input
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Search buildings, permits, contractors, or workflows..."
                className="w-full h-11 px-3 bg-transparent text-sm text-[#FAFAF8] placeholder-[#7D7D75] outline-none"
              />
              <button
                type="button"
                onClick={() => setCmdOpen(false)}
                className="p-1 text-[#7D7D75] hover:text-[#FAFAF8] rounded cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#7D7D75]">
                Quick Navigation
              </p>
              <button
                type="button"
                onClick={() => handleCommandSelect("/buildings")}
                className="w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-left text-xs text-[#B9B9B2] hover:bg-white/[0.06] hover:text-[#FAFAF8] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="size-3.5 text-[#F2F764]" />
                  <span>Commercial Buildings Opportunity Search</span>
                </div>
                <span className="text-[10px] text-[#7D7D75]">/buildings</span>
              </button>
              <button
                type="button"
                onClick={() => handleCommandSelect("/pipeline")}
                className="w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-left text-xs text-[#B9B9B2] hover:bg-white/[0.06] hover:text-[#FAFAF8] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileText className="size-3.5 text-[#B4E4D6]" />
                  <span>Opportunity Hot Sheet</span>
                </div>
                <span className="text-[10px] text-[#7D7D75]">/pipeline</span>
              </button>
              <button
                type="button"
                onClick={() => handleCommandSelect("/roof-aging")}
                className="w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-left text-xs text-[#B9B9B2] hover:bg-white/[0.06] hover:text-[#FAFAF8] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[#FFCA88]" />
                  <span>Roof Aging Alarm Pipeline</span>
                </div>
                <span className="text-[10px] text-[#7D7D75]">/roof-aging</span>
              </button>
              <button
                type="button"
                onClick={() => handleCommandSelect("/permits")}
                className="w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-left text-xs text-[#B9B9B2] hover:bg-white/[0.06] hover:text-[#FAFAF8] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileText className="size-3.5 text-blue-400" />
                  <span>Municipal Permits Feed</span>
                </div>
                <span className="text-[10px] text-[#7D7D75]">/permits</span>
              </button>
              <button
                type="button"
                onClick={() => handleCommandSelect("/contractors")}
                className="w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-left text-xs text-[#B9B9B2] hover:bg-white/[0.06] hover:text-[#FAFAF8] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="size-3.5 text-amber-400" />
                  <span>Competitor & Contractor Intelligence</span>
                </div>
                <span className="text-[10px] text-[#7D7D75]">/contractors</span>
              </button>
            </div>
            <div className="px-3 py-2 border-t border-[rgba(250,250,248,0.06)] bg-[#171714] text-[11px] text-[#7D7D75] flex items-center justify-between">
              <span>Press <kbd className="text-[#B9B9B2]">ESC</kbd> to exit</span>
              <span>Depoii Intelligence Engine</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
