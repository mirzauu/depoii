"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DepoiiMark } from "@/components/depoii-logo";
import { LandingEngine } from "@/components/landing-engine";
import { LandingHero } from "@/components/landing-hero";
import { LandingTour } from "@/components/landing-tour";

const FOOTER_NAV = [
  { label: "Product", href: "#tour-1" },
  { label: "How it works", href: "#how" },
  { label: "Pilot", href: "#pilot" },
];

type FormMode = "api" | "netlify";

export function LandingPage({ formMode = "api" }: { formMode?: FormMode }) {
  return (
    <div className="landing-light landing-snap min-h-screen bg-background text-foreground">
      <main id="top">
        <LandingHero />

        <LandingTour />

        <LandingEngine />

        <div className="relative z-50 bg-background">
          <PilotForm mode={formMode} />
        </div>
      </main>

      <footer className="relative z-50 border-t border-border bg-background">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
          <div>
            <a href="#top" className="inline-flex items-center gap-2 text-foreground">
              <DepoiiMark className="size-7" />
              <span className="text-lg font-bold tracking-tight">Depoii</span>
            </a>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Know which commercial roofs are worth the drive
            </p>
            <a
              href="mailto:support@depoii.com"
              className="mt-4 inline-block text-sm font-medium text-sky-800 underline-offset-4 hover:underline"
            >
              support@depoii.com
            </a>
          </div>
          <nav className="flex flex-col gap-2 sm:items-end">
            {FOOTER_NAV.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

function PilotForm({ mode }: { mode: FormMode }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);

    if (mode === "netlify") {
      // Netlify Forms: application/x-www-form-urlencoded POST
      data.set("form-name", "pilot");
      const body = new URLSearchParams();
      data.forEach((value, key) => {
        if (typeof value === "string") body.append(key, value);
      });
      try {
        const res = await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
        if (!res.ok) {
          setError("The form did not save. Try again.");
          return;
        }
        setSent(true);
      } catch {
        setError("The form did not save. Try again.");
      }
      return;
    }

    const res = await fetch("/api/pilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data.entries())),
    });
    if (!res.ok) {
      setError("The form did not save. Try again.");
      return;
    }
    setSent(true);
  };

  return (
    <section id="pilot" className="scroll-mt-16 border-t border-border bg-muted/40">
      <div className="mx-auto max-w-lg px-6 py-14 sm:py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Join the free pilot</h2>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          Tell us your territory and the roof sizes you bid. Workspace signup stays invite-only until the list is short
          enough to trust.
        </p>
        {sent ? (
          <p className="mt-6 text-base">Saved. We will reply to the email you entered.</p>
        ) : (
          <form
            name="pilot"
            method="POST"
            data-netlify={mode === "netlify" ? "true" : undefined}
            netlify-honeypot={mode === "netlify" ? "bot-field" : undefined}
            onSubmit={submit}
            className="mt-6 space-y-3"
          >
            {mode === "netlify" ? (
              <>
                <input type="hidden" name="form-name" value="pilot" />
                <p className="hidden">
                  <label>
                    Don’t fill this out: <input name="bot-field" />
                  </label>
                </p>
              </>
            ) : null}
            <Field name="name" label="Name" />
            <Field name="company" label="Company" />
            <Field name="email" label="Email" type="email" />
            <Field name="territory" label="Territory" placeholder="Dallas, Fort Worth, both" />
            <Field name="sizeRange" label="Roof sizes you bid" placeholder="e.g. 50,000 sq ft and up" />
            <Button type="submit" className="h-11 w-full bg-[#c8f000] text-neutral-900 hover:bg-[#d4ff2e] lg:w-auto">
              Request a pilot
            </Button>
            {error && <p className="text-sm text-red-700">{error}</p>}
          </form>
        )}
      </div>
    </section>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`pilot-${name}`}>{label}</Label>
      <Input id={`pilot-${name}`} name={name} type={type} required placeholder={placeholder} className="h-10" />
    </div>
  );
}
