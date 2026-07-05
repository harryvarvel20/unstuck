"use client";

import { useState } from "react";
import { SCHOOL_EXPLAINER_UK } from "@/lib/parentsContent";
import { capture } from "@/lib/analytics";

/**
 * School & logistics (W8) — a plain-language explainer (UK SEN / EHCP) plus an
 * AI drafter for home–school communication in the parent's own tone. The app
 * never sends anything: the parent copies and sends manually.
 */
export function SchoolView() {
  const [ask, setAsk] = useState("");
  const [tone, setTone] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [safety, setSafety] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (!ask.trim()) return;
    setLoading(true);
    setDraft("");
    setSafety("");
    setCopied(false);
    try {
      const res = await fetch("/api/parents/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "school", text: ask, detail: tone }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.childSafety) {
        capture("child_safety_routed", { surface: "school" });
        setSafety(body.message as string);
        return;
      }
      const r = body.result as { draft?: string };
      if (res.ok && r?.draft) {
        setDraft(r.draft);
        capture("school_tool_used");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-page-in">
      <h2 className="font-display text-xl font-semibold text-text">School</h2>
      <p className="mt-1.5 text-sm text-muted">
        Getting the right support, and the words to ask for it.
      </p>

      {/* Explainer */}
      <div className="mt-4 flex flex-col gap-2.5">
        {SCHOOL_EXPLAINER_UK.map((s) => (
          <details
            key={s.title}
            className="glass rounded-2xl p-4 shadow-soft [&_summary]:cursor-pointer"
          >
            <summary className="font-semibold text-text">{s.title}</summary>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
          </details>
        ))}
      </div>

      {/* Comms drafter */}
      <div className="mt-6 glass rounded-3xl p-5 shadow-soft">
        <p className="font-semibold text-text">Draft a message to school</p>
        <p className="mt-1 text-sm text-muted">
          We&apos;ll help word it — you copy and send it yourself.
        </p>
        <textarea
          value={ask}
          onChange={(e) => setAsk(e.target.value.slice(0, 1000))}
          rows={3}
          placeholder="What do you want to say or ask? e.g. request a meeting with the SENCO about homework struggles"
          className="mt-3 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <input
          value={tone}
          onChange={(e) => setTone(e.target.value.slice(0, 200))}
          placeholder="Tone / notes (optional) — e.g. warm but firm; it's the third time"
          className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void generate()}
          disabled={!ask.trim() || loading}
          className="grad-primary mt-3 w-full rounded-2xl px-5 py-3 font-semibold shadow-soft disabled:opacity-50"
        >
          {loading ? "Drafting…" : "Draft it"}
        </button>

        {safety && (
          <p className="mt-3 rounded-2xl bg-accent-soft/60 p-3.5 text-sm text-text">
            {safety}
          </p>
        )}

        {draft && (
          <div className="mt-4">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={9}
              className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(draft);
                setCopied(true);
              }}
              className="mt-2 rounded-full border border-accent/50 bg-surface px-4 py-2 text-sm font-semibold text-accent"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
