"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  CircleHelp,
  Compass,
  Mail,
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
import { DepoiiMark } from "@/components/depoii-logo";

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

  // Multi-step feedback state (Steps 1 to 5 matching Upwork reference)
  const [feedbackStep, setFeedbackStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [rating, setRating] = useState<string>("");
  const [category, setCategory] = useState<string>("Idea");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

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

  const openFeedbackModal = () => {
    setIsMenuOpen(false);
    setFeedbackStep(1);
    setRating("");
    setCategory("Idea");
    setFeedbackText("");
    setIsFeedbackOpen(true);
  };

  const handleSendFeedback = async () => {
    if (!feedbackText.trim() || feedbackSubmitting) return;

    setFeedbackSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: rating || "Not specified",
          category: category || "General",
          message: feedbackText.trim(),
          email: feedbackEmail.trim() || "anonymous@depoii.com",
        }),
      });
      setFeedbackStep(5);
    } catch {
      setFeedbackStep(5);
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
            <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Help & Resources
            </div>

            {/* 1. Page Tour */}
            <button
              type="button"
              role="menuitem"
              onClick={handleStartTour}
              disabled={isTourActive || (!hasTour && !tourKey)}
              className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
            >
              <div className="flex w-full items-center justify-between font-medium leading-none">
                <span>Page Tour</span>
                {!hasCompletedCurrentTour && hasTour && (
                  <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                    New
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                {currentTour
                  ? `Interactive walkthrough of ${currentTour.title}`
                  : "Interactive walkthrough of this view"}
              </p>
            </button>

            {/* 2. Feedback */}
            <button
              type="button"
              role="menuitem"
              onClick={openFeedbackModal}
              className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <div className="font-medium leading-none">Feedback</div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                Share suggestions, ideas or report an issue
              </p>
            </button>

            {/* 3. Help & Support */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                setIsHelpOpen(true);
              }}
              className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <div className="font-medium leading-none">Help & Support</div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                Contact support, guides & coverage info
              </p>
            </button>
          </div>
        )}
      </div>

      {/* Multi-step Feedback Dialog matching Upwork reference */}
      <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
        <DialogContent className="sm:max-w-xl! p-6 sm:p-8 rounded-xl bg-background border border-border shadow-2xl">
          {/* Centered Depoii Brand Header */}
          <div className="flex flex-col items-center justify-center pt-1 pb-3">
            <div className="flex items-center gap-2">
              <DepoiiMark className="size-6 text-foreground" />
              <span className="text-xl font-bold tracking-tight text-foreground">Depoii</span>
            </div>
          </div>

          {/* Step 1: Welcome & Overview (Image 1) */}
          {feedbackStep === 1 && (
            <div className="py-2 text-center">
              <h2 className="text-base sm:text-lg font-semibold text-emerald-600 dark:text-emerald-400 leading-snug">
                Have an idea, suggestion, or general feedback? Share it here!
              </h2>
              <p className="mt-3 text-xs sm:text-[13px] text-muted-foreground leading-relaxed max-w-md mx-auto">
                We are unable to respond to support requests made through this form. Please reach out to our{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsFeedbackOpen(false);
                    setIsHelpOpen(true);
                  }}
                  className="text-emerald-600 dark:text-emerald-400 font-medium underline underline-offset-2 hover:opacity-80"
                >
                  support team
                </button>{" "}
                if you need assistance.
              </p>

              <div className="mt-7 flex justify-end">
                <button
                  type="button"
                  onClick={() => setFeedbackStep(2)}
                  className="rounded bg-[#108a00] hover:bg-[#14a800] text-white px-5 py-1.5 text-xs font-semibold shadow-sm transition-colors"
                >
                  Start
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Rate Experience (Image 2) */}
          {feedbackStep === 2 && (
            <div className="py-2">
              <p className="text-xs sm:text-sm font-medium text-foreground">
                How would you rate your experience with Depoii today?
              </p>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {["Very Poor", "Poor", "Fair", "Good", "Very Good"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRating(option)}
                    className={cn(
                      "rounded-md border p-3 text-center text-xs font-medium transition-all select-none",
                      rating === option
                        ? "border-emerald-600 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/40"
                        : "border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setFeedbackStep(1)}
                  className="rounded bg-[#108a00] hover:bg-[#14a800] text-white px-4 py-1.5 text-xs font-semibold shadow-sm transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackStep(3)}
                  disabled={!rating}
                  className="rounded bg-[#108a00] hover:bg-[#14a800] text-white px-5 py-1.5 text-xs font-semibold shadow-sm transition-colors disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Type of Feedback (Image 3) */}
          {feedbackStep === 3 && (
            <div className="py-2">
              <p className="text-xs sm:text-sm font-medium text-foreground">
                What type of feedback would you like to share?
              </p>

              <div className="mt-4">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full sm:w-64 h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  <option value="Idea">Idea</option>
                  <option value="Issue / Problem">Issue / Problem</option>
                  <option value="General Feedback">General Feedback</option>
                  <option value="Compliment">Compliment</option>
                </select>
              </div>

              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setFeedbackStep(2)}
                  className="rounded bg-[#108a00] hover:bg-[#14a800] text-white px-4 py-1.5 text-xs font-semibold shadow-sm transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackStep(4)}
                  className="rounded bg-[#108a00] hover:bg-[#14a800] text-white px-5 py-1.5 text-xs font-semibold shadow-sm transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Share with us Textarea (Image 4) */}
          {feedbackStep === 4 && (
            <div className="py-2">
              <p className="text-xs sm:text-sm font-medium text-foreground">
                What would you like to share with us?
              </p>

              <div className="mt-3 space-y-2.5">
                <textarea
                  rows={4}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Type your feedback here..."
                  className="w-full rounded-md border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
                <input
                  type="email"
                  value={feedbackEmail}
                  onChange={(e) => setFeedbackEmail(e.target.value)}
                  placeholder="Your email (optional, if you'd like a direct reply)"
                  className="w-full h-8 rounded-md border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setFeedbackStep(3)}
                  className="rounded bg-[#108a00] hover:bg-[#14a800] text-white px-4 py-1.5 text-xs font-semibold shadow-sm transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSendFeedback}
                  disabled={!feedbackText.trim() || feedbackSubmitting}
                  className="rounded bg-[#108a00] hover:bg-[#14a800] text-white px-5 py-1.5 text-xs font-semibold shadow-sm transition-colors disabled:opacity-40"
                >
                  {feedbackSubmitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Thank You Screen */}
          {feedbackStep === 5 && (
            <div className="py-6 text-center">
              <CheckCircle2 className="size-10 text-emerald-500 mx-auto" />
              <h3 className="mt-3 text-base font-semibold text-foreground">
                Thank you for sharing your feedback with us!
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                Your response has been sent to our team at mirzamailbox0@gmail.com and helps us sharpen Depoii.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setIsFeedbackOpen(false)}
                  className="rounded bg-[#108a00] hover:bg-[#14a800] text-white px-6 py-1.5 text-xs font-semibold shadow-sm transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Subtle footer */}
          {feedbackStep < 5 && (
            <div className="text-center text-[10px] text-muted-foreground/60 pt-3">
              Powered by Depoii Intelligence
            </div>
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
