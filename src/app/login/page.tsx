"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";

type State = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [next, setNext] = useState("/app");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const n = params.get("next");
    if (n && n.startsWith("/")) setNext(n);
    if (params.get("error")) {
      setState("error");
      setErrorMsg("That link didn't work. Let's send a fresh one.");
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createSupabaseBrowser();
    if (!supabase) {
      setState("error");
      setErrorMsg("Sign-in isn't set up yet. Add Supabase keys to enable it.");
      return;
    }
    if (!email.trim()) return;

    setState("sending");
    setErrorMsg(null);

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      next,
    )}`;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setState("error");
      setErrorMsg("Something went wrong sending the link. Try again?");
    } else {
      setState("sent");
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-10 flex items-center justify-between">
        <Link
          href="/app"
          className="text-xl font-bold tracking-tight text-text"
        >
          ADH<span className="text-accent">V</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col justify-center">
        {state === "sent" ? (
          <section className="animate-fade-in rounded-3xl border border-border bg-surface p-6 sm:p-8">
            <div className="mb-3 text-3xl">📬</div>
            <h1 className="text-2xl font-semibold text-text">
              Check your email
            </h1>
            <p className="mt-3 text-muted">
              We&apos;ve sent a magic link to{" "}
              <strong className="text-text">{email}</strong>. Tap it and
              you&apos;re in — no password to remember.
            </p>
            <button
              type="button"
              onClick={() => setState("idle")}
              className="mt-6 text-sm text-accent hover:underline"
            >
              Use a different email
            </button>
          </section>
        ) : (
          <section>
            <h1 className="text-2xl font-semibold leading-tight text-text sm:text-3xl">
              Sign in to ADHV
            </h1>
            <p className="mt-2 text-muted">
              Enter your email and we&apos;ll send a magic link. No passwords,
              ever.
            </p>

            <form onSubmit={onSubmit} className="mt-6">
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-[1.05rem] text-text placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              />

              {errorMsg && (
                <p className="mt-3 text-sm text-accent" role="alert">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={state === "sending" || !email.trim()}
                className="mt-4 w-full rounded-2xl bg-accent px-5 py-3.5 text-[1.05rem] font-semibold text-accent-ink transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state === "sending" ? "Sending…" : "Send magic link"}
              </button>
            </form>

            <p className="mt-6 text-sm text-muted">
              You can keep using ADHV without an account —{" "}
              <Link href="/app" className="text-accent hover:underline">
                back to the app
              </Link>
              .
            </p>
          </section>
        )}
      </main>

      <footer className="pt-10">
        <p className="text-center text-xs text-muted/80">
          ADHV is a productivity tool, not medical advice or treatment.
        </p>
      </footer>
    </div>
  );
}
