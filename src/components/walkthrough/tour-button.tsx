"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  CircleHelp,
  Compass,
  MessageSquareQuote,
  LifeBuoy,
  Mail,
  Send,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { cn } from "cn";
import { useWalkthrough } from "./walkthrough-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PageTourButtonProps {
  label?: string;
  variant?: "header" | "pill" | "outline" | "ghost" | "compact";
  tourKey?: string;
  className?: string;
}

export function PageTourButton({
  label,
  variant = "header",
  tourKey,
  className,
}: PageTourButtonProps) {
  const { startTour, hasTour, currentTour, isTourActive, hasCompletedCurrentTour } = useWalkthrough();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Feedback form state
  const [category, setCategory] = useState<"Feature Request" | "Bug Report" | "General">("Feature Request");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleStartTour = () => {
    setIsMenuOpen(false);
    startTour(tourKey);
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() || feedbackSubmitting) return;

    setFeedbackSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: feedbackText.trim(),
          email: feedbackEmail.trim() || "anonymous@depoii.com",
        }),
      });
      setFeedbackSent(true);
      setTimeout(() => {
        setIsFeedbackOpen(false);
        setFeedbackSent(false);
        setFeedbackText("");
      }, 1500);
    } catch {
      setFeedbackSent(true);
      setTimeout(() => {
        setIsFeedbackOpen(false);
        setFeedbackSent(false);
        setFeedbackText("");
      }, 1500);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <>
      <div ref={menuRef} className="relative inline-block">
        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          title="Help, Tour & Feedback"
          className={cn(
            "relative inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95",
            isMenuOpen && "border-foreground/30 bg-muted text-foreground ring-2 ring-ring/20",
            className
          )}
        >
          <CircleHelp className="size-4 shrink-0" />
          {!hasCompletedCurrentTour && hasTour && (
            <span className="absolute top-1 right-1 flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-amber-400" />
            </span>
          )}
        </button>

        {/* Dropdown with 3 options */}
        {isMenuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-popover/95 p-1.5 text-popover-foreground shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95"
          >
            <div className="px-2.5 py-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Help & Resources
            </div>

            {/* 1. Page Tour */}
            <button
              type="button"
              role="menuitem"
              onClick={handleStartTour}
              disabled={isTourActive || (!hasTour && !tourKey)}
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
            >
              <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
                <Compass className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-medium leading-none">
                  <span>Page Tour</span>
                  {!hasCompletedCurrentTour && hasTour && (
                    <span className="rounded bg-amber-400/20 px-1 py-0.5 text-[9px] font-bold text-amber-500 uppercase">
                      New
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                  {currentTour
                    ? `Interactive walkthrough of ${currentTour.title}`
                    : "Interactive walkthrough of this view"}
                </p>
              </div>
            </button>

            {/* 2. Feedback */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                setIsFeedbackOpen(true);
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-500">
                <MessageSquareQuote className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium leading-none">Feedback</div>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  Share suggestions, ideas or report an issue
                </p>
              </div>
            </button>

            {/* 3. Help & Support */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                setIsHelpOpen(true);
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
                <LifeBuoy className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium leading-none">Help & Support</div>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  Contact support, guides & coverage info
                </p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Feedback Dialog */}
      <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription>
              We read every message. Share what’s working, what feels clunky, or features you’d love to see.
            </DialogDescription>
          </DialogHeader>

          {feedbackSent ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <CheckCircle2 className="size-10 text-emerald-500" />
              <p className="mt-2 text-sm font-semibold">Thank you for your feedback!</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your thoughts help us sharpen Depoii for roofing teams.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSendFeedback} className="space-y-3.5">
              <div className="flex gap-1.5">
                {(["Feature Request", "Bug Report", "General"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                      category === cat
                        ? "bg-foreground text-background"
                        : "border border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div>
                <textarea
                  required
                  rows={4}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Tell us what you think..."
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <input
                  type="email"
                  value={feedbackEmail}
                  onChange={(e) => setFeedbackEmail(e.target.value)}
                  placeholder="Your email (optional, if you'd like a response)"
                  className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFeedbackOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={feedbackSubmitting || !feedbackText.trim()}
                  className="gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                >
                  <Send className="size-3.5" />
                  {feedbackSubmitting ? "Sending..." : "Submit Feedback"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Help & Support Dialog */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Help & Support</DialogTitle>
            <DialogDescription>
              Depoii Commercial Intelligence — know when, where, and why.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {/* Quick Tour Option */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass className="size-4 text-amber-500" />
                  <span className="text-xs font-semibold">Interactive Walkthrough</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsHelpOpen(false);
                    startTour(tourKey);
                  }}
                  disabled={isTourActive || (!hasTour && !tourKey)}
                  className="h-7 text-xs"
                >
                  Start Tour
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Run the step-by-step product guide highlighting controls, filters, and records on this view.
              </p>
            </div>

            {/* Direct Support Contact */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Mail className="size-4 text-sky-500" />
                <span>Contact Engineering & Data Team</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Need help with appraisal parcels, permit searches, or territory assignments?
              </p>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-foreground">hello@depoii.com</span>
                <a
                  href="mailto:hello@depoii.com?subject=Depoii%20Support%20Inquiry"
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Email Us
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>

            {/* Coverage Info */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Live Coverage Area:</span>{" "}
              Dallas–Fort Worth Metroplex (Dallas, Tarrant, Collin, and Denton counties). Data refreshed after verified SPC hail events and municipal permit filings.
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsHelpOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function HeaderTourButton() {
  return <PageTourButton variant="header" />;
}
