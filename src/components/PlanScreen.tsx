"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseItemsArray,
  parseStreamingMessage,
  parseStringsArray,
  type ParsedItem,
} from "@/lib/parseBreakdown";
import { streamPost, ProRequiredError } from "@/lib/streamClient";
import { capture, EVENTS } from "@/lib/analytics";

type Stage = "input" | "planning" | "planned" | "crisis";

function defaultHours(): number {
  const h = new Date().getHours();
  // Rough usable hours until ~9pm, clamped to something humane.
  return Math.max(1, Math.min(10, 21 - h));
}

export function PlanScreen() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [hours, setHours] = useState(defaultHours());
  const [stage, setStage] = useState<Stage>("input");
  const [message, setMessage] = useState("");
  const [today, setToday] = useState<ParsedItem[]>([]);
  const [captured, setCaptured] = useState<string[]>([]);
  const [crisisMsg, setCrisisMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function plan() {
    if (!text.trim()) return;
    setStage("planning");
    setError(null);
    try {
      await streamPost(
        "/api/brain-dump",
        { text: text.trim(), availableHours: hours },
        (buffer) => {
          const msg = parseStreamingMessage(buffer);
          if (msg.crisis) {
            setCrisisMsg(msg.message);
            setStage("crisis");
            return;
          }
          setMessage(msg.message);
          setToday(parseItemsArray(buffer, "today").slice(0, 5));
          setCaptured(parseStringsArray(buffer, "captured"));
        },
      );
      setStage((s) => (s === "crisis" ? s : "planned"));
    } catch (err) {
      if (err instanceof ProRequiredError) {
        setError("Morning plans are a Pro thing — see /pricing.");
      } else {
        setError("Couldn't sort it just now — give it another go in a moment.");
      }
      setStage("input");
    }
  }

  async function makeMyDay() {
    if (today.length === 0 || saving) return;
    setSaving(true);
    capture(EVENTS.morningPlanCreated, { items: today.length });

    // The plan becomes a real task so every existing tool works on it.
    try {
      const label = new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short",
      });
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input_text: `Today — ${label}`,
          steps: today.map(({ title, minutes }) => ({
            title,
            minutes: Math.min(120, minutes),
          })),
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { id: string };

        // Persist the plan record with links back to the task's steps, so the
        // timeline check-offs mirror into the task. Best-effort.
        await fetch("/api/plans", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            today: today.map(({ title, minutes }, i) => ({
              id: `t-${body.id}-${i}`,
              title,
              minutes,
              taskId: body.id,
              stepIndex: i,
            })),
            captured,
          }),
        }).catch(() => {});

        router.push("/today");
        return;
      }
      setError("Couldn't save the plan — try again in a moment.");
    } catch {
      setError("Couldn't save the plan — try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  if (stage === "crisis") {
    return (
      <section
        className="animate-fade-in rounded-3xl border border-accent/40 bg-accent-soft/70 p-6"
        role="status"
      >
        <div className="mb-3 text-2xl">💛</div>
        <p className="text-[1.05rem] leading-relaxed text-text">
          {crisisMsg ||
            "It sounds like you're carrying something really heavy right now. You don't have to hold it alone — please reach out to someone you trust, or in the UK you can call Samaritans free any time on 116 123."}
        </p>
      </section>
    );
  }

  if (stage === "planned") {
    return (
      <div className="animate-fade-in">
        {message && <p className="text-[0.95rem] text-accent">“{message}”</p>}

        <section className="mt-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text">
            Today — realistically
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {today.map((item, i) => (
              <li
                key={i}
                className="rounded-2xl border border-border bg-surface p-3.5"
              >
                <span className="text-text">{item.title}</span>
                <span className="ml-2 text-sm text-muted">
                  ~{item.minutes} min
                </span>
              </li>
            ))}
          </ul>
        </section>

        {captured.length > 0 && (
          <section className="mt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              It&apos;s captured — stop holding it
            </h2>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted">
              {captured.map((c, i) => (
                <li key={i}>· {c}</li>
              ))}
            </ul>
          </section>
        )}

        <button
          type="button"
          onClick={() => void makeMyDay()}
          disabled={saving || today.length === 0}
          className="mt-7 w-full rounded-2xl bg-accent px-5 py-3.5 font-semibold text-accent-ink transition-all hover:brightness-105 disabled:opacity-60"
        >
          {saving ? "Setting up…" : "Make this my day"}
        </button>
        <button
          type="button"
          onClick={() => setStage("input")}
          className="mt-2 w-full rounded-xl px-5 py-2 text-sm text-muted transition-colors hover:text-text"
        >
          Start the dump again
        </button>

        {error && (
          <p className="mt-3 text-center text-sm text-accent" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="dump" className="sr-only">
        What&apos;s in your head?
      </label>
      <textarea
        id="dump"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 2000))}
        placeholder="Everything. Half-thoughts welcome. Nothing needs to be in order."
        rows={7}
        maxLength={2000}
        className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3.5 text-[1.05rem] text-text placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
      />

      <div className="mt-3 flex items-center justify-between">
        <label htmlFor="hours" className="text-sm text-muted">
          Usable hours today
        </label>
        <select
          id="hours"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-text"
        >
          {[1, 2, 3, 4, 5, 6, 8, 10].map((h) => (
            <option key={h} value={h}>
              {h}h
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => void plan()}
        disabled={!text.trim() || stage === "planning"}
        className="mt-4 w-full rounded-2xl bg-accent px-5 py-3.5 text-[1.05rem] font-semibold text-accent-ink transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {stage === "planning" ? "Sorting the chaos…" : "Sort it for me"}
      </button>

      {stage === "planning" && (message || today.length > 0) && (
        <div className="mt-5 animate-fade-in">
          {message && <p className="text-sm text-accent">“{message}”</p>}
          {today.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {today.map((item, i) => (
                <li
                  key={i}
                  className="rounded-2xl border border-border bg-surface p-3 text-sm text-text"
                >
                  {item.title}
                  <span className="ml-2 text-muted">~{item.minutes} min</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 text-center text-sm text-accent" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
