import Link from "next/link";
import type { Metadata } from "next";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Community Guidelines",
  description:
    "How the ADHV Activity Center works, what's not allowed, and how to report something.",
};

export default function GuidelinesPage() {
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
          Community Guidelines
        </h1>
        <p className="text-sm text-muted">
          For the Activity Center and Parents space. Last updated 31 July 2026.
        </p>

        <p className="text-muted">
          The Activity Center exists for one reason: so people whose brains work
          like yours can cheer each other on. It is a cheer wall, not a feed to
          perform for. These guidelines form part of our{" "}
          <Link href="/terms" className="text-accent hover:underline">
            Terms
          </Link>
          .
        </p>

        <Section title="What this place is built to avoid">
          <p>
            There are no follower counts, no like tallies, no leaderboards, no
            ranked or endless feed, and no public &ldquo;you missed a day&rdquo;
            states. Reactions are faces, never scores. Leaving anything —
            unfriending, muting, unpairing — is silent and nobody is notified.
            None of that is an oversight; it is the product.
          </p>
        </Section>

        <Section title="The spirit of it">
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong className="text-text">Celebrate small.</strong> Someone
              posting &ldquo;I opened the letter&rdquo; may have fought hard for
              it. Treat it that way.
            </li>
            <li>
              <strong className="text-text">
                Share the how, not the halo.
              </strong>{" "}
              Playbooks help people more than perfection does.
            </li>
            <li>
              <strong className="text-text">Advice only if asked.</strong> The
              default response to a win is warmth, not tips.
            </li>
            <li>
              <strong className="text-text">
                No one here is anyone&apos;s therapist.
              </strong>{" "}
              Support each other, but don&apos;t diagnose, prescribe, or offer
              medical or medication advice.
            </li>
          </ul>
        </Section>

        <Section title="What isn't allowed">
          <p>Don&apos;t post, send, or share anything that:</p>
          <ul className="mt-2 ml-5 list-disc space-y-1">
            <li>is illegal or helps someone break the law;</li>
            <li>
              bullies, harasses, mocks, shames, or attacks a person or group —
              including anything hateful about race, religion, disability, sex,
              gender identity or sexuality;
            </li>
            <li>
              encourages or glorifies suicide, self-harm, or disordered eating,
              or gives methods;
            </li>
            <li>
              sexualises a child in any way, or contains child sexual abuse
              material — we remove this and report it;
            </li>
            <li>threatens or incites violence, terrorism or extremism;</li>
            <li>
              identifies a child: in the Parents space never post a child&apos;s
              name, face, photo, school, or anything that could identify them.
              Write about <em>your</em> strategy, not their behaviour;
            </li>
            <li>
              shares someone else&apos;s private information, or impersonates
              another person;
            </li>
            <li>
              sells, spams, scams, or promotes treatments, supplements or
              &ldquo;cures&rdquo;;
            </li>
            <li>is sexual content, or graphic violence.</li>
          </ul>
        </Section>

        <Section title="If you're struggling">
          <p>
            If what you write suggests you&apos;re in crisis, ADHV will show you
            support information rather than post it. That isn&apos;t a
            punishment or a judgement — it&apos;s because you deserve a real
            person, not a feed. In the UK: Samaritans 116 123, any time, free.
            For a child: Childline 0800 1111. Worried about a child: NSPCC 0808
            800 5000. In immediate danger: 999.
          </p>
          <p className="mt-2">
            Direct messages are different — a message to a friend still sends,
            because reaching out to someone you trust should never be blocked.
            You&apos;ll just see the support information too.
          </p>
        </Section>

        <Section title="Reporting, blocking and what we do">
          <p>
            Every post, comment, message and profile has a{" "}
            <strong className="text-text">report</strong> option, and you can{" "}
            <strong className="text-text">block</strong> or{" "}
            <strong className="text-text">mute</strong> anyone at any time.
            Blocking is immediate and silent: it severs the feed, messages and
            any pairing in both directions.
          </p>
          <p className="mt-2">
            Reports go to a human review queue. Content reported independently
            by several people may be hidden automatically while we look at it.
            Depending on what we find we may leave it, remove it, restrict
            features, or close an account. Anything involving a child at risk is
            escalated immediately and, where appropriate, reported to the
            authorities.
          </p>
          <p className="mt-2">
            If you think we made the wrong call, email{" "}
            <span className="text-text">harryvarvel@gmail.com</span> — we will
            review it again and reply to you.
          </p>
        </Section>

        <Section title="Your controls">
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Every win is private by default until you choose otherwise.</li>
            <li>Comments can be turned off per post, or limited to friends.</li>
            <li>Direct messages can be switched off entirely.</li>
            <li>
              &ldquo;Quiet the social layer&rdquo; puts the whole thing to sleep
              without losing your friendships.
            </li>
          </ul>
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
