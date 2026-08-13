import Link from "next/link";
import { LandingDemo } from "@/components/LandingDemo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-static";

const FEATURES = [
  {
    emoji: "🧑‍🤝‍🧑",
    title: "An AI body double",
    body: "Press “Do this with me” and the app sits with you — a visible countdown, gentle check-ins, and a way out when you're stuck that's never disappointment.",
  },
  {
    emoji: "⏳",
    title: "A plan that knows your time",
    body: "ADHV quietly learns how long things really take you, then adjusts every plan to match. Not “you're bad at time” — just data that's finally on your side.",
  },
  {
    emoji: "🌧️",
    title: "A reset button for bad days",
    body: "When the day falls apart, one tap salvages what matters and lets the rest go, guilt-free. Mornings get a brain-dump that becomes a doable day.",
  },
];

const FAQ = [
  {
    q: "Is this therapy?",
    a: "No — it's a tool. ADHV helps you start and finish tasks. It isn't medical advice or treatment, and it doesn't diagnose anything.",
  },
  {
    q: "Do I need an account to try it?",
    a: "No. The demo above works right now, no email. An account (free) saves your tasks and unlocks daily focus sessions.",
  },
  {
    q: "What makes it different from a to-do app or ChatGPT?",
    a: "To-do apps assume starting is easy. Chatbots hand you a wall of text. ADHV gives you one tiny first step, then stays with you while you do it.",
  },
  {
    q: "What if I'm having a really hard time?",
    a: "If what you type sounds like a crisis, ADHV won't hand you a task list — it'll gently point you toward someone who can help. In the UK you can call Samaritans free any time on 116 123.",
  },
  {
    q: "Can I cancel easily?",
    a: "Always, in one tap from your account. No hoops, no “we miss you” guilt.",
  },
];

export default function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Header */}
      <header className="mb-10 flex items-center justify-between">
        <span className="text-xl font-bold tracking-tight text-text">
          ADH<span className="text-accent">V</span>
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/app"
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:border-accent/50"
          >
            Open app
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          ADHV — for brains that won&apos;t start
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-text sm:text-4xl">
          The app that gets you started when your brain won&apos;t — and sits
          with you <span className="grad-text">until it&apos;s done.</span>
        </h1>
        <p className="mt-4 text-lg text-muted">
          Turn “I can&apos;t even start” into a first step that takes 2 minutes.
          Try it right here, free, no signup.
        </p>

        <div className="mt-7">
          <LandingDemo />
        </div>
      </section>

      {/* Features */}
      <section className="mt-16">
        <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-muted">
          Not just another AI wrapper
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-3xl border border-border bg-surface p-5"
            >
              <div className="text-2xl">{f.emoji}</div>
              <h3 className="mt-3 font-semibold text-text">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Parents Mode */}
      <section className="mt-16">
        <div className="glass rounded-3xl p-7 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Parents Mode
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-text sm:text-3xl">
            For your brain — and your kid&apos;s.
          </h2>
          <p className="mt-3 max-w-xl leading-relaxed text-muted">
            If you&apos;re raising a child with ADHD, ADHV turns the same calm
            tools inward: real game plans for the hard mornings and meltdowns,
            shared-screen tools you run beside your child, and a counterweight
            to the thousands of extra corrections they hear. Built on one idea —{" "}
            <span className="text-text">kids do well if they can.</span>
          </p>
          <p className="mt-3 text-sm text-muted/80">
            Age-adaptive (4–17), no child login, safety help always free. A
            skills tool — not therapy, diagnosis, or medical advice.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section className="mt-16">
        <h2 className="text-2xl font-semibold text-text">Honest pricing</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-border bg-surface p-6">
            <h3 className="font-semibold text-text">Free</h3>
            <p className="mt-1 text-2xl font-bold text-text">£0</p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
              <li>· 3 breakdowns a day</li>
              <li>· 1 focus session a day</li>
              <li>· Saved tasks &amp; history</li>
            </ul>
          </div>
          <div className="rounded-3xl border-2 border-accent bg-surface p-6">
            <h3 className="font-semibold text-text">Pro</h3>
            <p className="mt-1 text-2xl font-bold text-text">
              £9.99<span className="text-base font-normal text-muted">/mo</span>
              <span className="ml-2 text-sm font-normal text-muted">
                or £99/yr
              </span>
            </p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-text">
              <li>· Unlimited breakdowns &amp; focus sessions (fair use)</li>
              <li>· Time Truth, timed day plan &amp; routines</li>
              <li>· Regulate, Dopamenu, Idea Vault &amp; more</li>
              <li>· Activity Center — your people, when you want them</li>
              <li>· Parents Mode — support your kid with ADHD too</li>
            </ul>
            <Link
              href="/pricing"
              className="mt-4 inline-block rounded-2xl bg-accent px-5 py-2.5 font-semibold text-accent-ink transition-colors hover:brightness-105"
            >
              See Pro — 5-day free trial
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-16">
        <h2 className="text-2xl font-semibold text-text">Questions</h2>
        <div className="mt-5 flex flex-col gap-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-border bg-surface p-4"
            >
              <summary className="cursor-pointer list-none font-medium text-text marker:content-none">
                <span className="flex items-center justify-between gap-3">
                  {item.q}
                  <span className="text-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-2.5 text-sm text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mt-16 rounded-3xl bg-accent-soft/60 p-8 text-center">
        <h2 className="text-2xl font-semibold text-text">
          The first step is smaller than you think.
        </h2>
        <Link
          href="/app"
          className="grad-primary mt-5 inline-block rounded-2xl px-8 py-3.5 text-lg font-semibold shadow-soft transition-all active:scale-[0.99]"
        >
          Get moving
        </Link>
      </section>

      {/* Footer */}
      <footer className="mt-14 border-t border-border pt-6">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted">
          <Link href="/app" className="hover:text-text">
            App
          </Link>
          <Link href="/pricing" className="hover:text-text">
            Pricing
          </Link>
          <Link href="/privacy" className="hover:text-text">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-text">
            Terms
          </Link>
          <Link href="/guidelines" className="hover:text-text">
            Guidelines
          </Link>
          <Link href="/accessibility" className="hover:text-text">
            Accessibility
          </Link>
        </div>
        <p className="mt-4 text-center text-xs text-muted/80">
          ADHV is a self-management tool, not therapy or medical advice.
        </p>
      </footer>
    </div>
  );
}
