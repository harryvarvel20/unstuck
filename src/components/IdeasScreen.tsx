"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  parseStringField,
  parseStringsArray,
  parseItemsArray,
  parseStreamingMessage,
} from "@/lib/parseBreakdown";
import { streamPost, ProRequiredError } from "@/lib/streamClient";
import { capture } from "@/lib/analytics";

interface Developed {
  summary: string;
  why: string;
  hard_parts: string[];
  steps: { title: string; minutes: number }[];
  google: string[];
  cost_time: string;
}

interface Idea {
  id: string;
  text: string;
  developed: Developed | null;
  status: "seed" | "developing" | "active" | "done";
  created_at: string;
}

function parseDeveloped(buf: string): Developed {
  return {
    summary: parseStringField(buf, "summary") ?? "",
    why: parseStringField(buf, "why") ?? "",
    hard_parts: parseStringsArray(buf, "hard_parts"),
    steps: parseItemsArray(buf, "steps"),
    google: parseStringsArray(buf, "google"),
    cost_time: parseStringField(buf, "cost_time") ?? "",
  };
}

export function IdeasScreen({ isPro }: { isPro: boolean }) {
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [developing, setDeveloping] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Developed>>({});

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/ideas");
        if (res.ok) {
          const body = (await res.json()) as { ideas: Idea[] };
          setIdeas(body.ideas);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function capture_(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    const t = text.trim();
    setText("");
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      if (res.ok) {
        const body = (await res.json()) as { idea: Idea };
        setIdeas((prev) => [body.idea, ...prev]);
        capture("idea_captured");
      }
    } catch {
      setText(t);
    }
  }

  async function develop(idea: Idea) {
    if (!isPro) {
      router.push("/pricing");
      return;
    }
    setDeveloping(idea.id);
    try {
      const buf = await streamPost(
        `/api/ideas/${idea.id}/develop`,
        {},
        (buffer) => {
          const m = parseStreamingMessage(buffer);
          if (m.crisis) return;
          setDraft((prev) => ({ ...prev, [idea.id]: parseDeveloped(buffer) }));
        },
      );
      const dev = parseDeveloped(buf);
      setIdeas((prev) =>
        prev.map((i) =>
          i.id === idea.id ? { ...i, developed: dev, status: "developing" } : i,
        ),
      );
      capture("idea_developed");
      void fetch(`/api/ideas/${idea.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ developed: dev, status: "developing" }),
      }).catch(() => {});
    } catch (err) {
      if (err instanceof ProRequiredError) router.push("/pricing");
    } finally {
      setDeveloping(null);
    }
  }

  async function makeReal(idea: Idea) {
    const dev = idea.developed ?? draft[idea.id];
    if (!dev || dev.steps.length === 0) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input_text: idea.text.slice(0, 300),
          steps: dev.steps.map((s) => ({
            title: s.title,
            minutes: Math.min(120, s.minutes),
          })),
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { id: string };
        void fetch(`/api/ideas/${idea.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        }).catch(() => {});
        capture("idea_made_real");
        router.push(`/app?task=${body.id}`);
      }
    } catch {
      /* noop */
    }
  }

  async function remove(id: string) {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/ideas/${id}`, { method: "DELETE" }).catch(() => {});
  }

  const inDevelopment = ideas.filter(
    (i) => i.status === "developing" || i.status === "active",
  ).length;

  return (
    <div>
      <form onSubmit={capture_} className="mb-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 2000))}
          rows={2}
          placeholder="Capture a brilliant idea before it escapes… (it's safe here — stop holding it)"
          className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="grad-primary mt-2 w-full rounded-2xl px-5 py-3 font-semibold shadow-soft disabled:opacity-50"
        >
          Capture
        </button>
      </form>

      {inDevelopment >= 3 && (
        <div className="mb-5 rounded-2xl border border-accent/40 bg-accent-soft/40 p-4">
          <p className="text-sm text-text">
            You&apos;ve got {inDevelopment} ideas in flight. Every idea deserves
            focus — which ONE earns it this week? The rest keep as seeds; they
            aren&apos;t going anywhere.
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-muted">Opening the vault…</p>
      ) : ideas.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface p-6 text-center">
          <div className="mb-3 text-3xl">💡</div>
          <p className="text-text">No seeds yet.</p>
          <p className="mt-2 text-muted">
            Every half-thought is welcome. Capture it here and your working
            memory gets to let go.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {ideas.map((idea) => {
            const dev = idea.developed ?? draft[idea.id];
            return (
              <li
                key={idea.id}
                className="glass flex flex-col rounded-2xl p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-text">{idea.text}</p>
                  <button
                    type="button"
                    onClick={() => void remove(idea.id)}
                    aria-label="Delete idea"
                    className="flex-shrink-0 text-sm text-muted hover:text-accent"
                  >
                    ✕
                  </button>
                </div>

                {dev ? (
                  <div className="mt-3 flex flex-col gap-2 text-sm">
                    {dev.summary && (
                      <p className="text-text">
                        <span className="text-muted">It&apos;s really: </span>
                        {dev.summary}
                      </p>
                    )}
                    {dev.why && (
                      <p className="text-muted">Why it works: {dev.why}</p>
                    )}
                    {dev.hard_parts.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                          Honest hard parts
                        </p>
                        <ul className="mt-1 flex flex-col gap-0.5 text-muted">
                          {dev.hard_parts.map((h, i) => (
                            <li key={i}>· {h}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {dev.steps.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                          First tiny steps
                        </p>
                        <ol className="mt-1 flex flex-col gap-0.5 text-text">
                          {dev.steps.map((s, i) => (
                            <li key={i}>
                              {i + 1}. {s.title}
                              <span className="ml-1 text-xs text-muted">
                                {s.minutes}m
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {dev.google.length > 0 && (
                      <p className="text-muted">
                        <span className="text-xs font-semibold uppercase">
                          Google:{" "}
                        </span>
                        {dev.google.join(", ")}
                      </p>
                    )}
                    {dev.cost_time && (
                      <p className="text-muted">
                        Rough cost/time: {dev.cost_time}
                      </p>
                    )}

                    {developing !== idea.id && dev.steps.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void makeReal(idea)}
                        className="grad-primary mt-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-soft"
                      >
                        Make it real →
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void develop(idea)}
                    disabled={developing === idea.id}
                    className="mt-3 self-start rounded-full border border-accent/50 bg-surface px-4 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft disabled:opacity-60"
                  >
                    {developing === idea.id ? "Developing…" : "Develop this"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!isPro && (
        <p className="mt-5 text-center text-sm text-muted">
          Capturing is free. Developing an idea into a plan is a{" "}
          <Link href="/pricing" className="text-accent hover:underline">
            Pro
          </Link>{" "}
          thing.
        </p>
      )}
    </div>
  );
}
