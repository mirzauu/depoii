"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DepoiiMark } from "@/components/depoii-logo";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const linkError =
    searchParams.get("error") === "link"
      ? (searchParams.get("reason") || "That sign-in link is not valid. Sign in with your email instead.")
      : searchParams.get("error") === "invite"
        ? "That invite is not valid or has expired. Ask your admin to send a new one."
        : "";
  const shownError = error || linkError;

  const sendCode = async () => {
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; step?: string; bypassed?: boolean };
      if (!res.ok) {
        setError(data.error || "Could not sign in.");
        return;
      }
      if (data.bypassed || data.step !== "otp") {
        router.replace(safeNext(searchParams.get("next")));
        router.refresh();
        return;
      }
      setStep("otp");
      setCode("");
    } catch {
      setError("Could not sign in.");
    } finally {
      setPending(false);
    }
  };

  const verifyCode = async () => {
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not sign in.");
        return;
      }
      router.replace(safeNext(searchParams.get("next")));
      router.refresh();
    } catch {
      setError("Could not sign in.");
    } finally {
      setPending(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === "email") await sendCode();
    else await verifyCode();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <DepoiiMark className="size-10 text-foreground" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Depoii</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {step === "email" ? "Sign in with your email" : `Enter the code sent to ${email}`}
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4">
          {step === "email" ? (
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-10"
                placeholder="you@company.com"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-10 tracking-[0.3em]"
                placeholder="000000"
                autoFocus
              />
            </div>
          )}
          {shownError ? <p className="text-sm text-destructive">{shownError}</p> : null}
          <Button type="submit" disabled={pending} className="h-10 w-full">
            {pending
              ? "Signing in…"
              : step === "email"
                ? email.trim().toLowerCase() === "admin@depoii.local"
                  ? "Sign in"
                  : "Send code"
                : "Sign in"}
          </Button>
          {step === "otp" ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:underline"
                disabled={pending}
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                }}
              >
                Use a different email
              </button>
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:underline"
                disabled={pending}
                onClick={() => void sendCode()}
              >
                Resend code
              </button>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <DepoiiMark className="size-10 text-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
