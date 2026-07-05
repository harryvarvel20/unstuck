import Link from "next/link";
import type { Metadata } from "next";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight text-text">
          ADH<span className="text-accent">V</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="prose-unstuck flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-text sm:text-3xl">
          Privacy
        </h1>
        <p className="text-sm text-muted">
          Plain English. Last updated July 2026.
        </p>

        <p className="text-muted">
          ADHV is built for people who are already carrying enough. We collect
          as little as we can, and we never sell your data. Here&apos;s exactly
          what happens to it.
        </p>

        <Section title="What we store">
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong className="text-text">Your email</strong>, so you can sign
              in with a magic link (no passwords).
            </li>
            <li>
              <strong className="text-text">Your tasks and plans</strong> — what
              you type in, the steps we generate, and which you&apos;ve ticked
              off — so you can come back to them.
            </li>
            <li>
              <strong className="text-text">Focus sessions and timing</strong>,
              so the app can learn how long things really take you.
            </li>
            <li>
              <strong className="text-text">Daily usage counts</strong>, to
              apply free limits. For anonymous use we store a one-way{" "}
              <em>hash</em> of your IP address — never the address itself.
            </li>
            <li>
              <strong className="text-text">Billing details</strong> are handled
              by Stripe; we only keep your plan status and a Stripe customer ID.
            </li>
          </ul>
        </Section>

        <Section title="What we don't do">
          <ul className="ml-5 list-disc space-y-1.5">
            <li>We don&apos;t sell or share your data with advertisers.</li>
            <li>
              Analytics run in cookieless mode — no advertising cookies, no
              cross-site tracking.
            </li>
            <li>
              What you type is sent to our AI provider (Google Gemini) only to
              generate your steps, and to Anthropic-free infrastructure we
              control. It isn&apos;t used to train models by us.
            </li>
          </ul>
        </Section>

        <Section title="Where it lives">
          <p>
            Your data is stored with Supabase (Postgres) and processed on
            Vercel. Row-level security means your rows are readable only by you.
          </p>
        </Section>

        <Section title="Your rights (UK GDPR)">
          <p>
            You can see, correct, export, or delete your data at any time. The
            fastest route: your{" "}
            <Link href="/account" className="text-accent hover:underline">
              account page
            </Link>{" "}
            has a{" "}
            <strong className="text-text">Delete my account &amp; data</strong>{" "}
            button that removes everything immediately. You can also email us
            and we&apos;ll action any request within 30 days.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or requests:{" "}
            <span className="text-text">hello@unstuck.app</span>.
          </p>
        </Section>

        <p className="mt-6 text-xs text-muted/80">
          ADHV is a productivity tool, not medical advice or treatment.
        </p>
      </main>

      <FooterLinks />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="text-muted">
      <h2 className="mb-1.5 text-lg font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

function FooterLinks() {
  return (
    <footer className="mt-12 border-t border-border pt-6 text-center text-sm text-muted">
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
        <Link href="/" className="hover:text-text">
          Home
        </Link>
        <Link href="/terms" className="hover:text-text">
          Terms
        </Link>
        <Link href="/app" className="hover:text-text">
          App
        </Link>
      </div>
    </footer>
  );
}
