"use client";

import { useState } from "react";
import { streamPost } from "@/lib/streamClient";
import { parseStreamingMessage } from "@/lib/parseBreakdown";
import { capture } from "@/lib/analytics";

interface Person {
  id: string;
  name: string;
  relationship: string | null;
  cadence_days: number;
  last_contacted: string | null;
}

const CADENCES = [
  { label: "weekly", days: 7 },
  { label: "fortnightly", days: 14 },
  { label: "monthly", days: 30 },
];

function agoLabel(iso: string | null): string {
  if (!iso) return "not yet";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

function nudge(p: Person): boolean {
  if (!p.last_contacted) return true;
  const days = (Date.now() - new Date(p.last_contacted).getTime()) / 86_400_000;
  return days >= p.cadence_days;
}

export function ConnectionScreen({
  initialPeople,
  initialGoal,
}: {
  initialPeople: Person[];
  initialGoal: string | null;
}) {
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [goal, setGoal] = useState<string | null>(initialGoal);
  const [name, setName] = useState("");
  const [rel, setRel] = useState("");
  const [cadence, setCadence] = useState(14);
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [goalInput, setGoalInput] = useState(initialGoal ?? "");
  const [stretch, setStretch] = useState("");
  const [stretchBusy, setStretchBusy] = useState(false);

  async function add(e?: React.FormEvent) {
    e?.preventDefault();
    if (!name.trim()) return;
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          relationship: rel.trim(),
          cadence_days: cadence,
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { person: Person };
        setPeople((prev) => [...prev, body.person]);
        setName("");
        setRel("");
        capture("connection_person_added");
      }
    } catch {
      /* noop */
    }
  }

  async function reachedOut(p: Person) {
    setPeople((prev) =>
      prev.map((x) =>
        x.id === p.id ? { ...x, last_contacted: new Date().toISOString() } : x,
      ),
    );
    capture("connection_reached_out");
    await fetch(`/api/people/${p.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reached_out: true }),
    }).catch(() => {});
  }

  async function remove(p: Person) {
    setPeople((prev) => prev.filter((x) => x.id !== p.id));
    await fetch(`/api/people/${p.id}`, { method: "DELETE" }).catch(() => {});
  }

  async function draftHello(p: Person) {
    setDraftFor(p.id);
    setDraft("");
    try {
      await streamPost(
        "/api/connect",
        {
          kind: "message",
          relationship: p.relationship || "someone I care about",
        },
        (buffer) => {
          const m = parseStreamingMessage(buffer);
          if (!m.crisis) setDraft(m.message);
        },
      );
    } catch {
      setDraft(
        "Thinking of you — hope you're doing okay. No need to reply fast.",
      );
    }
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      capture("connection_message_copied");
    } catch {
      /* noop */
    }
  }

  async function saveGoal(g: string | null) {
    setGoal(g);
    setStretch("");
    await fetch("/api/connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "goal", goal: g ?? "" }),
    }).catch(() => {});
  }

  async function getStretch() {
    if (!goal) return;
    setStretchBusy(true);
    setStretch("");
    try {
      await streamPost("/api/connect", { kind: "stretch", goal }, (buffer) => {
        const m = parseStreamingMessage(buffer);
        if (!m.crisis) setStretch(m.message);
      });
      capture("connection_stretch");
    } catch {
      setStretch(
        "Message one person you've been meaning to. That's the whole stretch.",
      );
    } finally {
      setStretchBusy(false);
    }
  }

  return (
    <div>
      {/* people */}
      <ul className="flex flex-col gap-2">
        {people.map((p) => (
          <li key={p.id} className="glass rounded-2xl p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-text">
                  {p.name}
                  {p.relationship && (
                    <span className="ml-2 text-sm text-muted">
                      {p.relationship}
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted">
                  last: {agoLabel(p.last_contacted)}
                  {nudge(p) && (
                    <span className="ml-2 text-accent">
                      · might be nice to say hi
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove(p)}
                aria-label={`Remove ${p.name}`}
                className="text-sm text-muted hover:text-accent"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void draftHello(p)}
                className="rounded-full border border-accent/50 bg-surface px-3.5 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft"
              >
                Draft a hello
              </button>
              <button
                type="button"
                onClick={() => void reachedOut(p)}
                className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-muted transition-colors hover:text-text"
              >
                I reached out
              </button>
            </div>

            {draftFor === p.id && (
              <div className="mt-3 rounded-2xl border border-border bg-surface p-3 animate-fade-in">
                <p className="text-text">{draft || "Writing something…"}</p>
                {draft && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void copyDraft()}
                      className="grad-primary rounded-xl px-3 py-1.5 text-sm font-semibold"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftFor(null)}
                      className="rounded-xl border border-border px-3 py-1.5 text-sm text-muted"
                    >
                      Close
                    </button>
                  </div>
                )}
                <p className="mt-2 text-xs text-muted">
                  You copy and send it yourself — ADHV never messages anyone.
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* add person */}
      <form
        onSubmit={add}
        className="mt-4 rounded-2xl border border-border bg-surface p-4"
      >
        <p className="text-sm font-medium text-text">Add someone who matters</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 80))}
            placeholder="name"
            className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-text placeholder:text-muted/60"
          />
          <input
            value={rel}
            onChange={(e) => setRel(e.target.value.slice(0, 80))}
            placeholder="e.g. old friend"
            className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-text placeholder:text-muted/60"
          />
          <select
            value={cadence}
            onChange={(e) => setCadence(Number(e.target.value))}
            className="rounded-xl border border-border bg-bg px-2 py-2 text-sm text-text"
          >
            {CADENCES.map((c) => (
              <option key={c.days} value={c.days}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!name.trim()}
          className="grad-primary mt-3 w-full rounded-xl px-4 py-2.5 font-semibold shadow-soft disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {/* comfort-zone stretch (opt-in) */}
      <div className="mt-6 rounded-2xl border border-border bg-surface-2/40 p-5">
        <p className="font-medium text-text">Comfort-zone stretch</p>
        {goal ? (
          <div className="mt-2">
            <p className="text-sm text-muted">
              Working toward: <span className="text-text">{goal}</span>
            </p>
            <button
              type="button"
              onClick={() => void getStretch()}
              disabled={stretchBusy}
              className="grad-primary mt-3 rounded-xl px-4 py-2 text-sm font-semibold shadow-soft disabled:opacity-60"
            >
              {stretchBusy ? "Thinking…" : "This week's tiny stretch"}
            </button>
            {stretch && (
              <div className="mt-3 rounded-2xl border border-accent/40 bg-accent-soft/40 p-3.5 animate-fade-in">
                <p className="text-text">{stretch}</p>
                <p className="mt-1.5 text-xs text-muted">
                  One, small, skippable. Not this week? It&apos;ll be here.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => void saveGoal(null)}
              className="mt-3 block text-xs text-muted hover:text-text"
            >
              turn this off
            </button>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-muted">
              Optional. If there&apos;s something you&apos;d like more of —
              getting out, seeing people — I&apos;ll suggest one tiny stretch a
              week, matched to how your brain works. No streaks, no pressure.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value.slice(0, 300))}
                placeholder="e.g. I want to get out more"
                className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-text placeholder:text-muted/60"
              />
              <button
                type="button"
                onClick={() =>
                  goalInput.trim() && void saveGoal(goalInput.trim())
                }
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
              >
                Set
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-5 text-center text-sm text-muted">
        Connection is love, not homework. No streaks here — ever.
      </p>
    </div>
  );
}
