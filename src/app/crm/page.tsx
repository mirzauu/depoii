"use client";

import { useState } from "react";
import { Bell, Check, CheckCircle2, Sparkles, X } from "lucide-react";

// Four-point sparkle star component
function StarSparkle({ className = "w-4 h-4 text-amber-400" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z" />
    </svg>
  );
}

// Salesforce cloud logo SVG
function SalesforceLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M10.02 5.51c.96-.86 2.22-1.39 3.6-1.39 2.53 0 4.67 1.76 5.16 4.12.75.46 1.39 1.09 1.83 1.84.97 1.63.85 3.71-.32 5.18-.3.38-.66.69-1.07.94-.3.18-.62.33-.96.44-.73.24-1.5.3-2.26.17-.43-.07-.84-.21-1.22-.41-.71.59-1.61.94-2.6.94-.78 0-1.52-.22-2.14-.62-.48.64-1.22 1.06-2.06 1.06-1.25 0-2.31-.86-2.6-2.02-.38.1-.78.15-1.19.15-2.64 0-4.78-2.14-4.78-4.78 0-2.28 1.6-4.18 3.74-4.66.72-2.11 2.73-3.64 5.09-3.64.99 0 1.92.27 2.72.76.01-.01.03-.02.05-.03z" />
    </svg>
  );
}

// HubSpot sprocket logo SVG
function HubSpotLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.8 8.1V6.2c.7-.3 1.2-1 1.2-1.8 0-1.2-1-2.1-2.1-2.1s-2.1 1-2.1 2.1c0 .8.5 1.5 1.2 1.8v1.9c-.8.3-1.6.8-2.2 1.4L9.5 6.9c.1-.3.2-.6.2-.9 0-1.7-1.4-3.1-3.1-3.1S3.5 4.3 3.5 6c0 1.7 1.4 3.1 3.1 3.1.5 0 .9-.1 1.3-.3l5.2 2.7c-.2.5-.3 1.1-.3 1.7s.1 1.2.3 1.7l-5.2 2.7c-.4-.2-.8-.3-1.3-.3-1.7 0-3.1 1.4-3.1 3.1S4.9 23.5 6.6 23.5 9.7 22.1 9.7 20.4c0-.3-.1-.6-.2-.9l5.3-2.6c.6.6 1.4 1.1 2.2 1.4v1.9c-.7.3-1.2 1-1.2 1.8 0 1.2 1 2.1 2.1 2.1s2.1-1 2.1-2.1c0-.8-.5-1.5-1.2-1.8v-1.9c1.6-.7 2.7-2.3 2.7-4.2 0-1.9-1.1-3.5-2.7-4.2zm-2 6.4c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z" />
    </svg>
  );
}

// Main Top Pink Sync Badge Icon
function PinkSyncBadge() {
  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Sparkle Top-Right */}
      <div className="absolute -top-3.5 -right-3.5 animate-pulse">
        <StarSparkle className="w-4 h-4 text-[#facc15] drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
      </div>

      {/* Main Magenta/Pink Badge */}
      <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl bg-gradient-to-tr from-[#ba165d] via-[#d61e6d] to-[#e6297d] flex items-center justify-center shadow-[0_10px_30px_rgba(214,30,109,0.45)] ring-1 ring-white/20 transition-transform duration-300 hover:scale-105">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-8 h-8 sm:w-9 sm:h-9 text-white drop-shadow-sm"
        >
          {/* Circular double arrows */}
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 16h5v5" />
        </svg>
      </div>

      {/* Sparkle Bottom-Left */}
      <div className="absolute -bottom-3.5 -left-3.5 animate-pulse delay-700">
        <StarSparkle className="w-3.5 h-3.5 text-[#facc15] drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
      </div>
    </div>
  );
}

// Left Benefit: Customer Connections (Blue figures with sparkle)
function CustomerConnectionsIcon() {
  return (
    <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
      {/* Background Soft Glow */}
      <div className="absolute inset-0 rounded-full bg-sky-500/15 blur-lg" />

      {/* Cyan Sparkle Star Top */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2">
        <StarSparkle className="w-3 h-3 text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]" />
      </div>

      {/* Users Silhouette SVG */}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        className="w-10 h-10 text-sky-400 relative z-10 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]"
      >
        {/* Center Person */}
        <circle cx="16" cy="11" r="3.5" strokeWidth="2" stroke="currentColor" fill="#38bdf8" fillOpacity="0.2" />
        <path d="M10 23c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeWidth="2" strokeLinecap="round" />

        {/* Left Person */}
        <circle cx="8" cy="14" r="2.5" strokeWidth="1.8" stroke="currentColor" fill="#38bdf8" fillOpacity="0.1" />
        <path d="M3.5 24c0-2.5 2-4.5 4.5-4.5.8 0 1.6.2 2.2.6" strokeWidth="1.8" strokeLinecap="round" />

        {/* Right Person */}
        <circle cx="24" cy="14" r="2.5" strokeWidth="1.8" stroke="currentColor" fill="#38bdf8" fillOpacity="0.1" />
        <path d="M21.8 20.1c.6-.4 1.4-.6 2.2-.6 2.5 0 4.5 2 4.5 4.5" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// Center Benefit: Save Time & Workflows (Purple Stopwatch / Clock)
function SaveTimeIcon() {
  return (
    <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
      {/* Background Soft Glow */}
      <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-lg" />

      {/* Clock / Timer Graphic */}
      <div className="relative z-10 w-11 h-11 rounded-full border-2 border-indigo-400/80 bg-indigo-950/40 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.35)]">
        {/* Top button/crown loop */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-1.5 rounded-t-sm border-t-2 border-x-2 border-indigo-300" />
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-1.5 h-1 bg-indigo-300 rounded-full" />

        {/* Clock Hands at ~10:10 */}
        <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <line x1="12" y1="12" x2="8.5" y2="8" strokeLinecap="round" strokeWidth="2.2" />
          <line x1="12" y1="12" x2="16" y2="8.5" strokeLinecap="round" strokeWidth="2.2" />
        </svg>
      </div>
    </div>
  );
}

// Right Benefit: Data Consistency (Blue sync arrows badge)
function DataConsistencyIcon() {
  return (
    <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
      {/* Background Soft Glow & Layered Discs */}
      <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-lg" />
      <div className="absolute -inset-1 rounded-full bg-blue-600/10" />

      {/* Blue Circular Icon Container */}
      <div className="relative z-10 w-11 h-11 rounded-full bg-gradient-to-tr from-blue-700 to-sky-500 flex items-center justify-center shadow-[0_0_16px_rgba(59,130,246,0.5)] ring-1 ring-white/20">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5 text-white"
        >
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 16h5v5" />
        </svg>
      </div>
    </div>
  );
}

export default function CRMEnrichmentPage() {
  const [soonModal, setSoonModal] = useState<"salesforce" | "hubspot" | null>(null);
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);
  const [notified, setNotified] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const handleNotifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      setNotified(true);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-[#0c0c0e] text-white flex flex-col justify-center items-center py-14 px-4 sm:px-6 lg:px-8 selection:bg-[#eefb4f] selection:text-black">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-30">
        <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center">
        {/* Coming Soon Pill Badge */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          COMING SOON
        </div>

        {/* Top Hero Pink Badge */}
        <div className="mb-6">
          <PinkSyncBadge />
        </div>

        {/* Main Headline */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-center text-white max-w-2xl px-2">
          Enrich existing records across your CRM systems
        </h1>

        {/* Subtitle */}
        <p className="mt-4 text-xs sm:text-sm md:text-[15px] text-zinc-400 text-center max-w-xl leading-relaxed px-4">
          Boost your CRM effectiveness with dynamic enrichment, effortlessly updating contact and account details to keep your data consistently synchronized.
        </p>

        {/* Connect Action Buttons with Soon Option */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* Salesforce Button (Coming Soon) */}
            <button
              type="button"
              onClick={() => setSoonModal("salesforce")}
              title="Salesforce integration is coming soon"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#edf855] hover:bg-[#f5ff6b] active:scale-95 text-black font-semibold text-xs sm:text-sm tracking-tight transition-all duration-150 shadow-sm hover:shadow-[0_0_15px_rgba(237,248,85,0.35)] cursor-pointer"
            >
              <SalesforceLogo className="w-4 h-4 text-black" />
              <span>Connect Salesforce</span>
              <span className="ml-1 rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                Soon
              </span>
            </button>

            {/* HubSpot Button (Coming Soon) */}
            <button
              type="button"
              onClick={() => setSoonModal("hubspot")}
              title="HubSpot integration is coming soon"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#edf855] hover:bg-[#f5ff6b] active:scale-95 text-black font-semibold text-xs sm:text-sm tracking-tight transition-all duration-150 shadow-sm hover:shadow-[0_0_15px_rgba(237,248,85,0.35)] cursor-pointer"
            >
              <HubSpotLogo className="w-4 h-4 text-black" />
              <span>Connect HubSpot</span>
              <span className="ml-1 rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                Soon
              </span>
            </button>
          </div>

          <p className="text-[11px] text-zinc-500 font-medium">
            Automated CRM connectors are currently in preview · Coming soon
          </p>
        </div>

        {/* Section Heading: Key benefits */}
        <h2 className="mt-20 mb-12 text-lg sm:text-xl font-medium tracking-tight text-white text-center">
          Key benefits
        </h2>

        {/* 3 Columns Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 lg:gap-12 w-full text-center px-4">
          {/* Benefit 1 */}
          <div className="flex flex-col items-center group">
            <CustomerConnectionsIcon />
            <h3 className="mt-5 text-sm sm:text-base font-semibold text-white tracking-tight">
              Enhance customer connections
            </h3>
            <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed max-w-xs">
              Boost your business growth by enriching CRM fields with accurate data, ensuring seamless integration of leads into your sales strategy
            </p>
          </div>

          {/* Benefit 2 */}
          <div className="flex flex-col items-center group">
            <SaveTimeIcon />
            <h3 className="mt-5 text-sm sm:text-base font-semibold text-white tracking-tight">
              Save time & streamline workflows
            </h3>
            <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed max-w-xs">
              Save time and increase productivity by simplifying your workflow, focusing on sales, and efficiently managing tasks
            </p>
            {/* Learn More Button */}
            <button
              type="button"
              onClick={() => setLearnMoreOpen(true)}
              className="mt-6 inline-flex items-center justify-center px-4 py-1.5 rounded-lg bg-[#18181b] hover:bg-[#27272a] active:bg-[#1f1f23] border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer shadow-sm"
            >
              Learn more
            </button>
          </div>

          {/* Benefit 3 */}
          <div className="flex flex-col items-center group">
            <DataConsistencyIcon />
            <h3 className="mt-5 text-sm sm:text-base font-semibold text-white tracking-tight">
              Ensure data consistency
            </h3>
            <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed max-w-xs">
              Experience consistent, accurate data across platforms, reducing manual entry and errors for up-to-date records
            </p>
          </div>
        </div>
      </div>

      {/* Coming Soon Notice Modal */}
      {soonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#121214] p-6 text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf855] text-black">
                  {soonModal === "salesforce" ? (
                    <SalesforceLogo className="h-5 w-5" />
                  ) : (
                    <HubSpotLogo className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white capitalize">
                    {soonModal} Integration
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[10px] font-semibold text-amber-400">
                      Coming Soon
                    </span>
                    <span className="text-xs text-zinc-400">In Active Development</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSoonModal(null);
                  setNotified(false);
                  setEmailInput("");
                }}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-5 space-y-4">
              <p className="text-xs text-zinc-300 leading-relaxed">
                Direct two-way synchronization with <span className="font-semibold text-white capitalize">{soonModal}</span> is currently scheduled for upcoming release. Commercial roofing leads, tax parcels, and storm data will sync automatically into your pipeline.
              </p>

              {notified ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-300">You are on the early access list!</p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      We will notify your account as soon as the {soonModal} connector is unlocked for your organization.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleNotifySubmit} className="space-y-3 pt-1">
                  <label htmlFor="notify-email" className="block text-xs font-medium text-zinc-300">
                    Get notified when it launches:
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="notify-email"
                      type="email"
                      required
                      placeholder="your@company.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-amber-500/50"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-[#edf855] px-3.5 py-2 text-xs font-semibold text-black hover:bg-[#f5ff6b] transition-colors flex items-center gap-1.5"
                    >
                      <Bell className="h-3.5 w-3.5" />
                      Notify Me
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="flex items-center justify-end border-t border-zinc-800 pt-4">
              <button
                type="button"
                onClick={() => {
                  setSoonModal(null);
                  setNotified(false);
                  setEmailInput("");
                }}
                className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-medium text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Learn More Modal */}
      {learnMoreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#121214] p-6 text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <PinkSyncBadge />
                <div>
                  <h3 className="text-base font-semibold text-white">How CRM Enrichment Works</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[10px] font-semibold text-amber-400">
                      Coming Soon
                    </span>
                    <span className="text-xs text-zinc-400">Depoii Real-time Engine</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLearnMoreOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-5 space-y-4 text-xs text-zinc-300">
              <p className="text-zinc-400 text-xs leading-relaxed">
                Depoii will automatically bridge your commercial roofing lead records with verified county tax rolls, radar-verified hail storms, and city building permits without manual copy-pasting.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                  <p className="font-semibold text-sky-400 text-xs">Automated Match & Merge</p>
                  <p className="mt-1 text-[11px] text-zinc-400 leading-normal">
                    Matches accounts by parcel address, tax ID, or owner name to append building area, roof pitch, and year built.
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                  <p className="font-semibold text-purple-400 text-xs">Real-Time Storm Alerts</p>
                  <p className="mt-1 text-[11px] text-zinc-400 leading-normal">
                    Notifies sales reps in Salesforce or HubSpot whenever a severe storm crosses their assigned territory.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                <p className="font-semibold text-[#edf855] text-xs">Two-Way Live Sync</p>
                <p className="mt-1 text-[11px] text-zinc-400 leading-normal">
                  Field inspection outcomes, claim statuses, and opportunity notes will sync automatically between Depoii and your CRM pipeline.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-zinc-800 pt-4">
              <button
                type="button"
                onClick={() => setLearnMoreOpen(false)}
                className="rounded-lg bg-[#edf855] px-4 py-2 text-xs font-semibold text-black hover:bg-[#f5ff6b]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
