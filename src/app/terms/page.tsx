import Link from "next/link";
import type { Metadata } from "next";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-sm text-muted">
          Plain English, but these are the actual terms of our agreement. Last
          updated 11 August 2026.
        </p>

        <p className="text-muted">
          These terms are between you and ADHV (&ldquo;we&rdquo;,
          &ldquo;us&rdquo;). By creating an account or using ADHV you agree to
          them. If you don&apos;t agree, please don&apos;t use the service.
        </p>

        <Section title="1. What ADHV is — and what it isn't">
          <p>
            ADHV is a{" "}
            <strong className="text-text">
              self-management and skills tool
            </strong>{" "}
            that helps you break down and start tasks, and (in Parents Mode)
            supports a parent of a child with ADHD.
          </p>
          <p className="mt-2">
            ADHV is{" "}
            <strong className="text-text">
              not medical advice, therapy, diagnosis, treatment, or a medical
              device
            </strong>
            . It does not diagnose any condition and must not be used as a
            substitute for professional healthcare. If you are struggling with
            your mental health, please speak to your GP, a qualified
            professional, or someone you trust. In the UK you can call
            Samaritans free at any time on 116 123. If anyone is in immediate
            danger, call 999.
          </p>
        </Section>

        <Section title="2. Who can use ADHV">
          <p>
            You must be <strong className="text-text">18 or over</strong> to
            create an account. ADHV is not directed at children and we do not
            knowingly allow under-18s to register. Parents Mode is designed for
            an adult to use — there is no child login and children are not
            account holders. If we learn an account belongs to someone under 18,
            we will close it.
          </p>
        </Section>

        <Section title="3. Your account">
          <p>
            You sign in with a magic link sent to your email — there is no
            password. Keep access to that inbox secure: anyone who can read it
            can sign in as you. You&apos;re responsible for activity on your
            account. Tell us promptly if you think someone else has access.
          </p>
        </Section>

        <Section title="4. Acceptable use — what's not allowed">
          <p>
            ADHV includes places where you can post, comment and send private
            messages. To keep those safe, you must not use ADHV to create,
            share, or send content that:
          </p>
          <ul className="mt-2 ml-5 list-disc space-y-1">
            <li>is illegal, or encourages or facilitates illegal activity;</li>
            <li>
              is abusive, harassing, bullying, hateful, or targets someone
              because of a protected characteristic;
            </li>
            <li>
              encourages, glorifies or provides instructions for suicide,
              self-harm, or an eating disorder;
            </li>
            <li>
              sexualises children, or contains any child sexual abuse material
              (we report this to the authorities);
            </li>
            <li>
              is threatening, incites violence, or promotes terrorism or
              extremism;
            </li>
            <li>
              identifies a child — in the Parents space, no child names, faces,
              photos, schools, or other identifying details;
            </li>
            <li>
              shares someone else&apos;s personal information without their
              consent, or impersonates another person;
            </li>
            <li>
              is spam, scams, fraud, or unsolicited advertising; or infringes
              someone&apos;s intellectual property;
            </li>
            <li>
              presents itself as medical, diagnostic, or therapeutic advice to
              other users.
            </li>
          </ul>
          <p className="mt-2">
            You also must not attempt to break, overload, scrape, reverse
            engineer, or gain unauthorised access to ADHV or other users&apos;
            data, or use automated tools to bulk-generate AI content. Our{" "}
            <Link href="/guidelines" className="text-accent hover:underline">
              Community Guidelines
            </Link>{" "}
            explain the spirit of the social spaces in more detail and form part
            of these terms.
          </p>
        </Section>

        <Section title="5. Reporting, moderation and enforcement">
          <p>
            Every post, comment, message and profile can be reported from inside
            the app, and you can block or mute anyone. We review reports and may
            remove content, hide it pending review, restrict features, or
            suspend or close an account that breaks these terms — proportionate
            to what happened. Content that receives multiple independent reports
            may be hidden automatically while we review it.
          </p>
          <p className="mt-2">
            If you think we got a decision wrong, email{" "}
            <span className="text-text">harryvarvel@gmail.com</span> and we will
            look at it again and reply.
          </p>
        </Section>

        <Section title="6. Your content">
          <p>
            What you write stays yours. You give us a limited licence to store,
            process and display it only so we can run the service for you — for
            example showing a win to the friends you chose, or sending your text
            to our AI provider to generate steps. We don&apos;t sell your
            content, and we don&apos;t use it to train AI models. You choose the
            audience for everything you share, and you can delete it at any
            time.
          </p>
        </Section>

        <Section title="7. Parents Mode">
          <p>
            Parents Mode is for you, the parent. We deliberately hold{" "}
            <strong className="text-text">no data about your child</strong> on
            our servers — the optional nickname, age band, reward chart and wins
            log stay on your device only. Because of that, this information does
            not sync between devices and is lost if you clear your browser data,
            sign out, or delete your account. Please don&apos;t enter your
            child&apos;s real name, school, or other identifying details
            anywhere in ADHV.
          </p>
        </Section>

        <Section title="8. The AI, and its limits">
          <p>
            ADHV uses AI (Google Gemini) to generate steps, plans, drafts and
            suggestions. AI output can be wrong, incomplete, or unsuitable for
            your situation. Use your judgement — you decide what you actually
            do. Never rely on ADHV for medical, legal, financial, or safety
            decisions.
          </p>
          <p className="mt-2">
            If what you write suggests a crisis or a child-safety concern, ADHV
            will show you support information instead of generating a task or
            posting your content. That is a safety feature, not a judgement
            about you, and it is never behind a paywall.
          </p>
        </Section>

        <Section title="9. Free plan, fair use and limits">
          <p>
            The free plan includes daily limits (for example 3 breakdowns and 1
            focus session a day) because AI costs real money to run. We also
            apply per-minute limits to protect the service from abuse. Safety
            tools — the cool-down, SOS, and crisis signposting — are never
            limited or paywalled.
          </p>
          <p className="mt-2">
            Pro is unlimited in normal use, subject to fair use: a ceiling of{" "}
            <strong className="text-text">50 AI breakdowns per day</strong>,
            which resets at midnight. That is far more than anyone uses in a day
            — it exists only to stop automated abuse running up costs, and you
            are very unlikely ever to see it. If you genuinely need more, email
            us and we will sort it out.
          </p>
        </Section>

        <Section title="10. Pro subscriptions and payment">
          <p>
            Pro is <strong className="text-text">£9.99 per month</strong> or{" "}
            <strong className="text-text">£99 per year</strong>. Prices are in
            pounds sterling and are the total you pay — we are not currently VAT
            registered, so no VAT is added. Payments are processed by Stripe; we
            never see or store your card details.
          </p>
          <p className="mt-2">
            New subscriptions include a{" "}
            <strong className="text-text">5-day free trial</strong>. You will
            not be charged during the trial. Unless you cancel before it ends,
            the subscription starts automatically and your card is charged, then{" "}
            <strong className="text-text">renews automatically</strong> each
            month or year until you cancel.
          </p>
        </Section>

        <Section title="11. Cancelling, your 14-day right, and refunds">
          <p>
            You can cancel at any time in one tap from your{" "}
            <Link href="/account" className="text-accent hover:underline">
              account page
            </Link>
            . Cancelling stops all future charges and you keep Pro until the end
            of the period you have already paid for. We don&apos;t ask you why
            and there are no retention hoops.
          </p>
          <p className="mt-2">
            <strong className="text-text">14-day cancellation right.</strong> As
            a consumer you normally have 14 days to cancel a purchase of digital
            content. Because Pro gives you immediate access to digital content,
            by starting your subscription you ask us to begin supplying it right
            away and acknowledge that you lose the automatic 14-day right to
            cancel once supply has begun. In practice the 5-day free trial means
            you can try Pro fully without being charged, and if you are charged
            and are unhappy, contact us — we would rather refund you than have
            you feel trapped.
          </p>
          <p className="mt-2">
            <strong className="text-text">Refunds.</strong> If ADHV is faulty or
            not as described, you have statutory rights under the Consumer
            Rights Act 2015 and we will repair, replace or refund as
            appropriate. Outside that, we consider refund requests within 14
            days of a charge in good faith — email us.
          </p>
        </Section>

        <Section title="12. Changes to the service or these terms">
          <p>
            We may improve, change or discontinue features. If we make a change
            to these terms that materially affects you, we&apos;ll tell you by
            email or in the app before it takes effect, and you can cancel if
            you don&apos;t accept it. If we change the price of your
            subscription, we will give you notice before it applies and you can
            cancel first.
          </p>
        </Section>

        <Section title="13. Ending your account">
          <p>
            You can delete your account and all your data at any time from your
            account page — it happens immediately and cannot be undone. We may
            suspend or close an account that seriously or repeatedly breaks
            these terms, or where we must to comply with the law. Where it is
            fair to do so, we&apos;ll tell you why and give you a chance to
            respond.
          </p>
        </Section>

        <Section title="14. Our responsibility to you">
          <p>
            We provide ADHV with reasonable care and skill, but we don&apos;t
            promise it will always be available, uninterrupted, or error-free.
          </p>
          <p className="mt-2">
            Nothing in these terms limits our liability for death or personal
            injury caused by our negligence, for fraud, or for anything else
            that cannot lawfully be limited — and nothing affects your statutory
            rights as a consumer. Subject to that, we are not liable for losses
            that were not reasonably foreseeable, and our total liability to you
            in any 12-month period is limited to the amount you paid us in that
            period.
          </p>
        </Section>

        <Section title="15. Law and disputes">
          <p>
            These terms are governed by the law of England and Wales, and the
            courts of England and Wales have jurisdiction — though if you live
            elsewhere in the UK you can bring proceedings in your own country.
            If something goes wrong, please contact us first: most things are
            solved with an email.
          </p>
        </Section>

        <Section title="16. Contact">
          <p>
            ADHV — <span className="text-text">harryvarvel@gmail.com</span>. We
            aim to reply within a few days, and to any formal data-protection
            request within one month.
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
          <Link href="/privacy" className="hover:text-text">
            Privacy
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
