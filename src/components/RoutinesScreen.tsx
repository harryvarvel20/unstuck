"use client";

import { useEffect, useState } from "react";
import {
  parseObjectsArray,
  parseStringField,
  parseStreamingMessage,
} from "@/lib/parseBreakdown";
import { streamPost, ProRequiredError } from "@/lib/streamClient";
import type { Routine, RoutineStep } from "@/lib/routines";
import { RoutineRunner } from "./RoutineRunner";
import { capture } from "@/lib/analytics";

type Kind = "morning" | "evening" | "work-startup" | "leaving" | "custom";

const KIND_LABEL: Record<Kind, string> = {
  morning: "Morning",
  evening: "Evening",
  "work-startup": "Work start-up",
  leaving: "Leaving the house",
  custom: "Custom",
};

function toSteps(objs: Record<string, unknown>[]): RoutineStep[] {
  return objs
    .map((o) => {
      const title = typeof o.title === "string" ? o.title.trim() : "";
      if (!title) return null;
      let minutes =
        typeof o.minutes === "number"
          ? o.minutes
          : parseInt(String(o.minutes), 10);
      if (!Number.isFinite(minutes) || minutes <= 0) minutes = 3;
      minutes = Math.max(1, Math.min(60, Math.round(minutes)));
      return { title, minutes, skippable: o.skippable === true };
    })
    .filter((s): s is RoutineStep => s !== null);
}

export function RoutinesScreen() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [running, setRunning] = useState<Routine | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/routines");
        if (res.ok) {
          const body = (await res.json()) as { routines: Routine[] };
          setRoutines(body.routines);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function onSaved(r: Routine) {
    setRoutines((prev) => [r, ...prev]);
    setBuilding(false);
  }

  async function remove(id: string) {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/routines/${id}`, { method: "DELETE" }).catch(() => {});
  }

  if (running) {
    return <RoutineRunner routine={running} onClose={() => setRunning(null)} />;
  }

  return (
    <div>
      {building ? (
        <RoutineBuilder onSaved={onSaved} onCancel={() => setBuilding(false)} />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setBuilding(true)}
            className="grad-primary mb-5 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft"
          >
            + Build a routine
          </button>

          {loading ? (
            <p className="text-muted">Loading…</p>
          ) : routines.length === 0 ? (
            <div className="rounded-3xl border border-border bg-surface p-6 text-center">
              <div className="mb-3 text-3xl">🔁</div>
              <p className="text-text">No routines yet.</p>
              <p className="mt-2 text-muted">
                Answer three quick questions and I&apos;ll draft one that bends
                on rushed days instead of breaking.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {routines.map((r) => (
                <li key={r.id} className="glass rounded-2xl p-4 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-text">{r.name}</p>
                      <p className="text-sm text-muted">
                        {r.steps.length} steps ·{" "}
                        {r.steps.reduce((a, s) => a + s.minutes, 0)} min ·{" "}
                        {r.steps.filter((s) => !s.skippable).length}{" "}
                        non-negotiable
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void remove(r.id)}
                      aria-label="Delete routine"
                      className="text-sm text-muted hover:text-accent"
                    >
                      ✕
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRunning(r)}
                    className="mt-3 w-full rounded-2xl border border-accent/50 bg-surface px-5 py-2.5 font-semibold text-accent transition-colors hover:bg-accent-soft"
                  >
                    Run it
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function RoutineBuilder({
  onSaved,
  onCancel,
}: {
  onSaved: (r: Routine) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<Kind>("morning");
  const [when, setWhen] = useState("");
  const [must, setMust] = useState("");
  const [wrong, setWrong] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<RoutineStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function draft() {
    setDrafting(true);
    setError(null);
    setSteps([]);
    try {
      await streamPost(
        "/api/routines/draft",
        { kind, when, must, wrong },
        (buffer) => {
          const msg = parseStreamingMessage(buffer);
          if (msg.crisis) {
            setError(
              "It sounds like there's something heavier going on — if so, please reach out to someone you trust, or Samaritans on 116 123.",
            );
            return;
          }
          const nm = parseStringField(buffer, "name");
          if (nm) setName(nm);
          setSteps(toSteps(parseObjectsArray(buffer, "steps")));
        },
      );
    } catch (err) {
      if (err instanceof ProRequiredError) {
        setError("Routines are a Pro thing — see /pricing.");
      } else {
        setError("Couldn't draft it just now — try again in a moment.");
      }
    } finally {
      setDrafting(false);
    }
  }

  function toggleSkippable(i: number) {
    setSteps((prev) =>
      prev.map((s, j) => (j === i ? { ...s, skippable: !s.skippable } : s)),
    );
  }

  async function save() {
    if (steps.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/routines", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name || KIND_LABEL[kind], kind, steps }),
      });
      if (!res.ok) throw new Error("save failed");
      const body = (await res.json()) as { id: string };
      capture("routine_created", { kind, steps: steps.length });
      onSaved({ id: body.id, name: name || KIND_LABEL[kind], kind, steps });
    } catch {
      setError("Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onCancel}
        className="mb-4 text-sm text-muted hover:text-text"
      >
        ← back
      </button>

      {steps.length === 0 ? (
        <div>
          <label className="text-sm font-medium text-text">
            Which routine?
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  kind === k
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-surface text-muted hover:border-accent/40"
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>

          <Field
            label="When do you do it?"
            value={when}
            onChange={setWhen}
            placeholder="e.g. 7:30am on work days"
          />
          <Field
            label="What must happen?"
            value={must}
            onChange={setMust}
            placeholder="e.g. meds, shower, feed the cat, leave by 8:15"
          />
          <Field
            label="What always goes wrong?"
            value={wrong}
            onChange={setWrong}
            placeholder="e.g. I fall down my phone and lose 40 minutes"
          />

          <button
            type="button"
            onClick={() => void draft()}
            disabled={drafting}
            className="grad-primary mt-5 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-60"
          >
            {drafting ? "Drafting…" : "Draft my routine"}
          </button>
        </div>
      ) : (
        <div className="animate-fade-in">
          <h2 className="font-display text-xl font-semibold text-text">
            {name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Tap a step to toggle whether it&apos;s skippable on a rushed day.
            Non-negotiables always survive.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {steps.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => toggleSkippable(i)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3.5 text-left transition-colors hover:border-accent/40"
                >
                  <span className="text-text">
                    {s.title}
                    <span className="ml-2 text-xs text-muted">
                      {s.minutes} min
                    </span>
                  </span>
                  <span
                    className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      s.skippable
                        ? "bg-surface-2 text-muted"
                        : "bg-accent-soft text-accent"
                    }`}
                  >
                    {s.skippable ? "skippable" : "must-do"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="grad-primary mt-5 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save routine"}
          </button>
          <button
            type="button"
            onClick={() => setSteps([])}
            className="mt-2 w-full rounded-xl px-5 py-2 text-sm text-muted hover:text-text"
          >
            Start over
          </button>
        </div>
      )}

      {error && (
        <p className="mt-4 text-center text-sm text-accent" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="mt-4">
      <label className="text-sm font-medium text-text">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 400))}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
    </div>
  );
}
