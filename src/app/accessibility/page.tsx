import Link from "next/link";
import type { Metadata } from "next";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Accessibility",
  description:
    "ADHV's accessibility statement and how to tell us about a barrier.",
};

export default function AccessibilityPage() {
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
          Accessibility
        </h1>
        <p className="text-sm text-muted">
          Our commitment, honestly stated. Last updated 31 July 2026.
        </p>

        <p className="text-muted">
          ADHV is built for people with ADHD, so accessibility isn&apos;t a
          bolt-on here — it&apos;s the point. We aim to meet{" "}
          <strong className="text-text">WCAG 2.2 level AA</strong>.
        </p>

        <Section title="What we've built in">
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong className="text-text">Cognitive load first:</strong> one
              primary action per screen, short plain-English copy, no jargon,
              and no blank-page-with-a-cursor moments.
            </li>
            <li>
              <strong className="text-text">No shame states:</strong> no
              streaks, no guilt, no red &ldquo;you failed&rdquo; anywhere —
              which matters more for cognitive accessibility than most
              checklists admit.
            </li>
            <li>
              <strong className="text-text">Keyboard:</strong> every interactive
              element is reachable and operable by keyboard, with visible focus.
            </li>
            <li>
              <strong className="text-text">Screen readers:</strong> semantic
              HTML, labelled controls, and live regions that announce results as
              they stream in.
            </li>
            <li>
              <strong className="text-text">Motion:</strong> decorative motion
              is near-zero by design, and we respect your system&apos;s
              &ldquo;reduce motion&rdquo; setting.
            </li>
            <li>
              <strong className="text-text">Targets and text:</strong> touch
              targets are at least 44×44px, text contrast meets AA, and layouts
              work from 390px phones up to large desktops.
            </li>
            <li>
              <strong className="text-text">Themes:</strong> a light and a
              midnight theme, both contrast-checked.
            </li>
          </ul>
        </Section>

        <Section title="Where we're honest about gaps">
          <p>
            We test with automated tools and manual keyboard passes. We have{" "}
            <strong className="text-text">
              not yet completed a full audit with assistive-technology users
            </strong>
            , and we haven&apos;t had an independent accessibility assessment.
            Some AI-generated content (your steps and plans) is written by a
            model, so its reading level can vary. Emoji are used decoratively
            and may be announced by some screen readers.
          </p>
          <p className="mt-2">
            We&apos;d rather tell you that than claim full conformance we
            haven&apos;t evidenced.
          </p>
        </Section>

        <Section title="Tell us about a barrier">
          <p>
            If something in ADHV is hard or impossible for you to use, please
            email <span className="text-text">harryvarvel@gmail.com</span> and
            say what happened and what you were trying to do. We treat
            accessibility bugs as real bugs, and we&apos;ll reply. If you need
            information from ADHV in a different format, ask and we&apos;ll find
            a way.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Under the Equality Act 2010 we must make reasonable adjustments so
            disabled people aren&apos;t put at a substantial disadvantage. If
            you think we&apos;ve fallen short, tell us first — we want to fix
            it. You can also contact the Equality Advisory and Support Service
            (EASS).
          </p>
        </Section>

        <p className="mt-6 text-xs text-muted/80">
          ADHV is a self-management tool, not therapy or medical advice.
        </p>
      </main>

      <footer className="mt-12 border-t border-border pt-6 text-center text-sm text-muted">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link href="/" className="hover:text-text">
            Home
          </Link>
          <Link href="/terms" className="hover:text-text">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-text">
            Privacy
          </Link>
          <Link href="/app" className="hover:text-text">
            App
          </Link>
        </div>
      </footer>
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
