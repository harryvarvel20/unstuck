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

      <main className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-text sm:text-3xl">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted">
          Plain English. Last updated 31 July 2026.
        </p>

        <p className="text-muted">
          ADHV is built for people who are already carrying enough. We collect
          as little as we can, we never sell your data, and we never use it to
          train AI models. Here is exactly what happens to it.
        </p>

        <Section title="Who we are">
          <p>
            ADHV is the data controller for the personal data described here.
            Contact: <span className="text-text">harryvarvel@gmail.com</span>.
            You can also reach us about anything in this policy at that address.
          </p>
        </Section>

        <Section title="What we collect, why, and our lawful basis">
          <div className="overflow-x-auto">
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text">
                  <th className="py-2 pr-3 font-semibold">Data</th>
                  <th className="py-2 pr-3 font-semibold">Why</th>
                  <th className="py-2 font-semibold">Lawful basis</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <Row
                  d="Your email address"
                  w="To create your account and send magic sign-in links"
                  b="Contract"
                />
                <Row
                  d="Tasks, steps, plans, routines, ideas, journal and other things you type"
                  w="To give you the feature you asked for and let you come back to it"
                  b="Contract"
                />
                <Row
                  d="Focus sessions and timing"
                  w="So the app can learn how long things really take you"
                  b="Contract"
                />
                <Row
                  d="Social content: your handle, wins, comments, reactions, messages"
                  w="To run the Activity Center for you and the people you choose"
                  b="Contract"
                />
                <Row
                  d="Daily usage counts; a one-way hash of your IP address when signed out"
                  w="To apply free limits and prevent abuse. We never store the IP itself"
                  b="Legitimate interests (protecting the service)"
                />
                <Row
                  d="Reports, blocks and moderation records"
                  w="To keep the social spaces safe and meet our online-safety duties"
                  b="Legitimate interests / legal obligation"
                />
                <Row
                  d="Plan status and a Stripe customer ID"
                  w="To give you Pro and manage billing"
                  b="Contract"
                />
                <Row
                  d="Error logs (no message content)"
                  w="To find and fix faults"
                  b="Legitimate interests"
                />
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            We do not ask for, and you should not enter, health information,
            diagnoses, or anyone else&apos;s personal details. Some people
            naturally write about how they&apos;re feeling; that text is treated
            with the same care as everything else, is never sold or used for
            advertising, and is deleted when you delete it.
          </p>
        </Section>

        <Section title="Parents Mode — no data about your child">
          <p>
            Parents Mode is built so we hold{" "}
            <strong className="text-text">no data about your child</strong> on
            our servers. The optional nickname, the age band, the reward chart
            and your private &ldquo;wins about my kid&rdquo; notes stay{" "}
            <strong className="text-text">only on your device</strong> and are
            never sent to us. We never profile, track, or advertise to children,
            and the shared-screen kid tools send no analytics whatsoever. It all
            clears in one tap, and automatically when you sign out or delete
            your account.
          </p>
          <p className="mt-2">
            When you ask the parenting coach for a plan, we send only the age
            band and the words you typed — never a name or any identifier.
          </p>
        </Section>

        <Section title="Who we share it with (our processors)">
          <p>
            We use a small number of carefully chosen suppliers. Each processes
            data only on our instructions, under a data-processing agreement.
          </p>
          <ul className="mt-2 ml-5 list-disc space-y-1.5">
            <li>
              <strong className="text-text">Supabase</strong> — database, sign
              in, and file storage (EU region).
            </li>
            <li>
              <strong className="text-text">Vercel</strong> — hosting and
              serving the app.
            </li>
            <li>
              <strong className="text-text">Google (Gemini API)</strong> — the
              AI that generates your steps. Your text is sent to generate a
              response and is not used to train Google&apos;s models under the
              paid API terms.
            </li>
            <li>
              <strong className="text-text">Stripe</strong> — payments. Stripe
              handles your card details directly; we never see them.
            </li>
            <li>
              <strong className="text-text">Resend</strong> — sending your
              sign-in emails (EU region).
            </li>
            <li>
              <strong className="text-text">PostHog</strong> — privacy-friendly,
              cookieless product analytics, if enabled. No advertising, no
              cross-site tracking, and nothing at all on kid-facing screens.
            </li>
          </ul>
          <p className="mt-2">
            We never sell or rent your data, and we don&apos;t share it with
            advertisers. We may disclose data if the law requires it, or to
            protect someone&apos;s safety.
          </p>
        </Section>

        <Section title="Where your data goes">
          <p>
            Data is stored in the UK/EU where possible. Some suppliers are based
            in the United States; where data is transferred outside the UK it is
            protected by the UK International Data Transfer Agreement or
            equivalent standard contractual clauses in that supplier&apos;s
            data-processing agreement.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            We keep your account data for as long as your account exists. When
            you delete your account, your data is deleted immediately and
            permanently. Some limited records are kept a little longer where we
            must: billing records for 6 years (tax law), and moderation reports
            for up to 12 months so repeat problems can be spotted. Anonymous
            usage counters roll off after 30 days. Nothing you type is retained
            by us after you delete it.
          </p>
        </Section>

        <Section title="Your rights (UK GDPR)">
          <p>You have the right to:</p>
          <ul className="mt-2 ml-5 list-disc space-y-1">
            <li>see the personal data we hold about you;</li>
            <li>have it corrected if it&apos;s wrong;</li>
            <li>have it deleted (&ldquo;right to be forgotten&rdquo;);</li>
            <li>get a copy in a portable format;</li>
            <li>object to, or ask us to restrict, certain processing;</li>
            <li>withdraw consent where we rely on it.</li>
          </ul>
          <p className="mt-2">
            The fastest route for most of these is your{" "}
            <Link href="/account" className="text-accent hover:underline">
              account page
            </Link>
            , which has a{" "}
            <strong className="text-text">Delete my account &amp; data</strong>{" "}
            button that removes everything straight away. For anything else,
            email us and we&apos;ll respond within one month.
          </p>
          <p className="mt-2">
            If you&apos;re unhappy with how we&apos;ve handled your data you can
            complain to the ICO at <span className="text-text">ico.org.uk</span>{" "}
            or on 0303 123 1113. We&apos;d appreciate the chance to put it right
            first.
          </p>
        </Section>

        <Section title="Cookies and tracking">
          <p>
            We use only strictly necessary cookies — the ones that keep you
            signed in and remember your theme. We use no advertising cookies and
            no cross-site tracking. Our analytics, when enabled, run in
            cookieless mode. Kid-facing screens contain no analytics, no
            trackers, no external links and no ads.
          </p>
        </Section>

        <Section title="Keeping it safe">
          <p>
            Every table has row-level security so your rows are readable only by
            you. Files are stored in private buckets and served through
            short-lived links. Traffic is encrypted in transit. We limit who can
            access production systems. If a breach ever put your rights at risk,
            we&apos;ll tell the ICO within 72 hours and tell you without undue
            delay.
          </p>
        </Section>

        <Section title="Children">
          <p>
            ADHV is for adults: you must be 18 or over to hold an account. We
            don&apos;t knowingly collect data from children, and Parents Mode is
            deliberately designed so that no child data ever reaches us. If you
            believe a child has created an account, please email us and
            we&apos;ll remove it.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If we change this policy in a way that materially affects you,
            we&apos;ll tell you in the app or by email before it takes effect.
          </p>
        </Section>

        <p className="mt-6 text-xs text-muted/80">
          ADHV is a self-management tool, not therapy or medical advice.
        </p>
      </main>

      <FooterLinks />
    </div>
  );
}

function Row({ d, w, b }: { d: string; w: string; b: string }) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-2 pr-3 text-text">{d}</td>
      <td className="py-2 pr-3">{w}</td>
      <td className="py-2">{b}</td>
    </tr>
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
        <Link href="/guidelines" className="hover:text-text">
          Guidelines
        </Link>
        <Link href="/accessibility" className="hover:text-text">
          Accessibility
        </Link>
        <Link href="/app" className="hover:text-text">
          App
        </Link>
      </div>
    </footer>
  );
}
