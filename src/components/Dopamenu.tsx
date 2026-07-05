"use client";

import { useEffect, useState } from "react";
import {
  chooseDopamine,
  COURSES,
  type Course,
  type DopaItem,
} from "@/lib/dopamenu";
import { parseObjectsArray, parseStreamingMessage } from "@/lib/parseBreakdown";
import { streamPost, ProRequiredError } from "@/lib/streamClient";
import { haptic } from "@/lib/design";
import { capture } from "@/lib/analytics";
import { useEscape } from "@/lib/hooks";

let idc = 0;
const newId = () => `d${Date.now()}-${idc++}`;

function toItems(objs: Record<string, unknown>[]): DopaItem[] {
  return objs
    .map((o) => {
      const text = typeof o.text === "string" ? o.text.trim() : "";
      const course = String(o.course) as Course;
      if (!text || !["appetiser", "entree", "side", "special"].includes(course))
        return null;
      let minutes =
        typeof o.minutes === "number"
          ? o.minutes
          : parseInt(String(o.minutes), 10);
      if (!Number.isFinite(minutes) || minutes <= 0)
        minutes = course === "appetiser" ? 3 : course === "entree" ? 30 : 10;
      return { id: newId(), course, text, minutes, shows: 0, picks: 0 };
    })
    .filter((x): x is DopaItem => x !== null);
}

const TIME_CHIPS = [5, 15, 30] as const;

export function Dopamenu() {
  const [items, setItems] = useState<DopaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"menu" | "setup" | "pick">("menu");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/dopamenu");
        if (res.ok) {
          const body = (await res.json()) as { items: DopaItem[] };
          setItems(body.items);
          if (body.items.length === 0) setMode("setup");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function persist(next: DopaItem[]) {
    setItems(next);
    void fetch("/api/dopamenu", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: next }),
    }).catch(() => {});
  }

  if (loading) return <p className="text-muted">Loading your menu…</p>;
  if (mode === "setup")
    return (
      <Setup
        existing={items}
        onDone={(next) => {
          persist(next);
          setMode("menu");
        }}
      />
    );
  if (mode === "pick")
    return (
      <Picker
        items={items}
        onUpdate={persist}
        onClose={() => setMode("menu")}
      />
    );

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          capture("dopamenu_opened");
          setMode("pick");
        }}
        className="grad-primary mb-5 w-full rounded-2xl px-5 py-4 text-lg font-semibold shadow-soft"
      >
        I feel flat — feed me something
      </button>

      <MenuView items={items} />

      <div className="mt-5 flex justify-center gap-4 text-sm">
        <button
          type="button"
          onClick={() => setMode("setup")}
          className="text-muted hover:text-accent hover:underline"
        >
          edit menu
        </button>
        <ShareButton items={items} />
      </div>
    </div>
  );
}

function MenuView({ items }: { items: DopaItem[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-[rgb(var(--surface))] to-[rgb(var(--surface-2))] p-5 shadow-float">
      <p className="text-center font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
        My Dopamenu
      </p>
      <div className="mt-4 flex flex-col gap-4">
        {COURSES.map((c) => {
          const list = items.filter((i) => i.course === c.key);
          if (list.length === 0) return null;
          return (
            <div key={c.key}>
              <p className="text-sm font-semibold text-text">
                {c.emoji} {c.label}
                <span className="ml-2 text-xs font-normal text-muted">
                  {c.hint}
                </span>
              </p>
              <ul className="mt-1.5 flex flex-col gap-1 border-l-2 border-accent/30 pl-3">
                {list.map((i) => (
                  <li key={i.id} className="text-[0.95rem] text-text">
                    {i.text}
                    <span className="ml-1.5 text-xs text-muted">
                      · {i.minutes}m
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Picker({
  items,
  onUpdate,
  onClose,
}: {
  items: DopaItem[];
  onUpdate: (n: DopaItem[]) => void;
  onClose: () => void;
}) {
  const [, setMinutes] = useState<number | null>(null);
  const [choices, setChoices] = useState<DopaItem[]>([]);
  const [picked, setPicked] = useState<DopaItem | null>(null);
  const [stage, setStage] = useState<"time" | "choose" | "commit" | "checkin">(
    "time",
  );

  useEscape(onClose);

  function pickTime(m: number) {
    setMinutes(m);
    const c = chooseDopamine(items, m);
    setChoices(c);
    // Count shows.
    const shown = new Set(c.map((x) => x.id));
    onUpdate(
      items.map((i) => (shown.has(i.id) ? { ...i, shows: i.shows + 1 } : i)),
    );
    setStage("choose");
  }

  function choose(item: DopaItem) {
    setPicked(item);
    haptic();
    setStage("commit");
  }

  function committed() {
    if (picked) {
      onUpdate(
        items.map((i) =>
          i.id === picked.id ? { ...i, picks: i.picks + 1 } : i,
        ),
      );
      capture("dopamenu_picked", { course: picked.course });
    }
    setStage("checkin");
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Dopamine menu"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-5">
        <button
          type="button"
          onClick={onClose}
          className="self-start text-sm text-muted hover:text-text"
        >
          ✕ close
        </button>
        <div className="flex flex-1 flex-col justify-center pb-16 text-center">
          {stage === "time" && (
            <div>
              <h1 className="font-display text-2xl font-semibold text-text">
                How much have you got?
              </h1>
              <div className="mt-6 flex justify-center gap-3">
                {TIME_CHIPS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pickTime(m)}
                    className="h-16 w-20 rounded-2xl border border-border bg-surface text-lg font-semibold text-text transition-colors hover:border-accent/50"
                  >
                    {m}
                    <span className="block text-[10px] font-normal text-muted">
                      min
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {stage === "choose" && (
            <div className="animate-fade-in">
              <p className="text-sm uppercase tracking-widest text-muted">
                Three things. Pick whichever pulls you.
              </p>
              <div className="mt-5 flex flex-col gap-2.5">
                {choices.length === 0 && (
                  <p className="text-muted">
                    Nothing sized for that yet — add a few menu items first.
                  </p>
                )}
                {choices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => choose(c)}
                    className="glass rounded-2xl p-4 text-left text-[1.05rem] font-medium text-text shadow-soft transition-all active:scale-[0.99]"
                  >
                    {c.text}
                    <span className="ml-2 text-xs text-muted">
                      · {c.minutes}m
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {stage === "commit" && picked && (
            <div className="animate-fade-in">
              <div className="text-4xl">🎯</div>
              <h1 className="mt-4 font-display text-2xl font-semibold text-text">
                {picked.text}
              </h1>
              <p className="mt-4 text-muted">
                Just start it. That&apos;s the whole job — no finishing
                required.
              </p>
              <button
                type="button"
                onClick={committed}
                className="grad-primary mt-8 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft"
              >
                Okay, doing it
              </button>
            </div>
          )}

          {stage === "checkin" && (
            <div className="animate-fade-in">
              <h1 className="font-display text-2xl font-semibold text-text">
                Did it help?
              </h1>
              <p className="mt-2 text-muted">
                Tuning the menu — no wrong answer.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="grad-primary rounded-2xl px-6 py-3 font-semibold shadow-soft"
                >
                  A bit, yeah
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (picked) {
                      // Not helpful → nudge it down by reducing its pick weight.
                      onUpdate(
                        items.map((i) =>
                          i.id === picked.id
                            ? {
                                ...i,
                                picks: Math.max(0, i.picks - 1),
                                shows: i.shows + 2,
                              }
                            : i,
                        ),
                      );
                    }
                    onClose();
                  }}
                  className="rounded-2xl border border-border bg-surface px-6 py-3 font-medium text-text"
                >
                  Not really
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Setup({
  existing,
  onDone,
}: {
  existing: DopaItem[];
  onDone: (items: DopaItem[]) => void;
}) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<DopaItem[]>(existing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [manualCourse, setManualCourse] = useState<Course>("appetiser");

  async function suggest(refresh: boolean) {
    setBusy(true);
    setError(null);
    try {
      const buf = await streamPost(
        "/api/dopamenu/suggest",
        { text, refresh },
        (buffer) => {
          const m = parseStreamingMessage(buffer);
          if (m.crisis)
            setError("Let's not right now — take care of you first.");
        },
      );
      const suggested = toItems(parseObjectsArray(buf, "items"));
      // Merge, de-dup by text.
      const seen = new Set(draft.map((d) => d.text.toLowerCase()));
      setDraft([
        ...draft,
        ...suggested.filter((s) => !seen.has(s.text.toLowerCase())),
      ]);
    } catch (err) {
      if (err instanceof ProRequiredError) setError("Dopamenu is a Pro thing.");
      else setError("Couldn't get suggestions — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    setDraft(draft.filter((d) => d.id !== id));
  }
  function addManual() {
    if (!manual.trim()) return;
    setDraft([
      ...draft,
      {
        id: newId(),
        course: manualCourse,
        text: manual.trim().slice(0, 200),
        minutes:
          manualCourse === "appetiser"
            ? 3
            : manualCourse === "entree"
              ? 30
              : 10,
        shows: 0,
        picks: 0,
      },
    ]);
    setManual("");
  }

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-text">
        Build your menu
      </h2>
      <p className="mt-2 text-muted">
        Tell me what lifts you and I&apos;ll suggest a menu — then keep only
        what&apos;s truly yours.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 1000))}
        rows={3}
        placeholder="e.g. loud music, being outside, my dog, drawing, cold showers"
        className="mt-4 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void suggest(false)}
          disabled={busy}
          className="grad-primary flex-1 rounded-2xl px-4 py-3 font-semibold shadow-soft disabled:opacity-60"
        >
          {busy ? "Cooking…" : "Suggest a menu"}
        </button>
        {draft.length > 0 && (
          <button
            type="button"
            onClick={() => void suggest(true)}
            disabled={busy}
            className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text disabled:opacity-60"
          >
            Fresh appetisers
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {draft.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          {COURSES.map((c) => {
            const list = draft.filter((d) => d.course === c.key);
            if (list.length === 0) return null;
            return (
              <div key={c.key}>
                <p className="text-sm font-semibold text-text">
                  {c.emoji} {c.label}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {list.map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => remove(i.id)}
                        className="group rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-text transition-colors hover:border-accent/40"
                        title="Remove"
                      >
                        {i.text}
                        <span className="ml-1.5 text-muted group-hover:text-accent">
                          ✕
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-surface p-3">
        <p className="text-sm font-medium text-text">Add your own</p>
        <div className="mt-2 flex gap-2">
          <select
            value={manualCourse}
            onChange={(e) => setManualCourse(e.target.value as Course)}
            className="rounded-xl border border-border bg-surface px-2 py-2 text-sm text-text"
          >
            {COURSES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value.slice(0, 200))}
            onKeyDown={(e) => e.key === "Enter" && addManual()}
            placeholder="e.g. 10 star jumps"
            className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted/60"
          />
          <button
            type="button"
            onClick={addManual}
            className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-ink"
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDone(draft)}
        disabled={draft.length === 0}
        className="grad-primary mt-6 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-50"
      >
        Save my menu
      </button>
    </div>
  );
}

function ShareButton({ items }: { items: DopaItem[] }) {
  async function share() {
    const text =
      "My Dopamenu 🍽️\n\n" +
      COURSES.map((c) => {
        const list = items.filter((i) => i.course === c.key);
        if (list.length === 0) return "";
        return (
          `${c.emoji} ${c.label}\n` + list.map((i) => `· ${i.text}`).join("\n")
        );
      })
        .filter(Boolean)
        .join("\n\n") +
      "\n\n— made with ADHV";
    capture("dopamenu_shared");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text, title: "My Dopamenu" });
        return;
      }
      await navigator.clipboard.writeText(text);
    } catch {
      /* cancelled */
    }
  }
  return (
    <button
      type="button"
      onClick={() => void share()}
      className="text-muted hover:text-accent hover:underline"
    >
      share menu
    </button>
  );
}
