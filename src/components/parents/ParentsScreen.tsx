"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AGE_BANDS, bandLabel, type AgeBand, type Child } from "@/lib/parents";
import {
  loadChildren,
  addChildLocal,
  removeChildLocal,
} from "@/lib/parentsLocal";
import { childSafetyConcern, CHILD_SAFETY_SIGNPOST } from "@/lib/safety";
import { capture } from "@/lib/analytics";
import { useEscape } from "@/lib/hooks";
import { ParentsHub } from "./ParentsHub";

const ACTIVE_KEY = "adhv-active-child";

/**
 * Parents Mode home: the calm opt-in, adding a child (name optional, age band
 * required, what's-hardest optional), a child switcher, and — once a child
 * exists — the situation-first hub + toolbox (ParentsHub). Every state has a
 * real surface: opt-in, add-your-first-child, or the hub. Never a blank pane.
 */
export function ParentsScreen({
  isPro,
  initialEnabled,
}: {
  isPro: boolean;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  // Children live ONLY on this device (localStorage) — never on our servers.
  const [children, setChildren] = useState<Child[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const list = loadChildren();
    setChildren(list);
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(ACTIVE_KEY);
    } catch {
      /* noop */
    }
    setActiveId(
      stored && list.some((c) => c.id === stored)
        ? stored
        : (list[0]?.id ?? null),
    );
  }, []);

  function selectChild(id: string) {
    setActiveId(id);
    try {
      window.localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      /* noop */
    }
  }

  async function enable() {
    if (!isPro) return; // server enforces too; UI routes to pricing below
    setBusy(true);
    try {
      const res = await fetch("/api/parents", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      if (res.ok) {
        setEnabled(true);
        setAdding(true);
        capture("parents_mode_enabled");
        window.dispatchEvent(new Event("adhv-parents-changed"));
      }
    } finally {
      setBusy(false);
    }
  }

  function onAdded(child: Child) {
    setChildren((prev) => [...prev, child]);
    selectChild(child.id);
    setAdding(false);
  }

  function removeChild(id: string) {
    setChildren((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      const next = children.find((c) => c.id !== id) ?? null;
      setActiveId(next?.id ?? null);
    }
    removeChildLocal(id); // device-only; also clears their reward chart + wins
  }

  // ---- Not enabled: the calm opt-in ---------------------------------
  if (!enabled) {
    return (
      <div className="animate-page-in">
        <div className="glass rounded-3xl p-6 shadow-soft">
          <div className="text-3xl">🫶</div>
          <h1 className="mt-4 font-display text-2xl font-semibold text-text">
            Supporting a child with ADHD too?
          </h1>
          <p className="mt-3 leading-relaxed text-muted">
            ADHV Parents turns the same calm tools inward — for the hard
            mornings, the meltdowns, the homework standoffs. It&apos;s built on
            one idea:{" "}
            <span className="text-text">kids do well if they can.</span> No
            shame, for them or for you.
          </p>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-muted">
            <li>· Real game plans for the moments that are actually hard</li>
            <li>
              · Shared-screen tools you run beside your child — no child login
            </li>
            <li>· A counterweight to the 20,000 extra corrections kids hear</li>
          </ul>

          {isPro ? (
            <button
              type="button"
              onClick={() => void enable()}
              disabled={busy}
              className="grad-primary mt-6 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-60"
            >
              {busy ? "Setting up…" : "Turn on Parents Mode"}
            </button>
          ) : (
            <Link
              href="/pricing"
              className="grad-primary mt-6 block rounded-2xl px-5 py-3.5 text-center font-semibold shadow-soft"
            >
              Parents Mode is part of Pro — see plans
            </Link>
          )}
          <p className="mt-3 text-xs text-muted/80">
            You can turn this off any time. Your child&apos;s details stay on
            this device only — never on our servers — and delete in one tap.
          </p>
        </div>
      </div>
    );
  }

  const active = children.find((c) => c.id === activeId) ?? children[0] ?? null;

  return (
    <div className="animate-page-in">
      <h1 className="font-display text-2xl font-semibold leading-tight text-text sm:text-3xl">
        Parents
      </h1>
      <p className="mt-2 text-muted">
        Kids do well if they can. Let&apos;s make the hard moments a little
        easier — together.
      </p>

      {/* Child switcher */}
      {children.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {children.map((c) => {
            const isActive = c.id === active?.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => selectChild(c.id)}
                aria-pressed={isActive}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-surface text-muted hover:text-text"
                }`}
              >
                {c.name || "My child"}
                <span className="ml-1.5 text-xs opacity-70">
                  {bandLabel(c.ageBand)}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full border border-dashed border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-accent/50 hover:text-accent"
          >
            + Add a child
          </button>
        </div>
      )}

      {/* Active child + situation-first hub */}
      {active && (
        <>
          <div className="mt-4 flex items-center justify-end">
            <button
              type="button"
              onClick={() => void removeChild(active.id)}
              className="text-xs text-muted/80 transition-colors hover:text-accent"
            >
              remove {active.name || "child"}
            </button>
          </div>
          <ParentsHub key={active.id} child={active} />
        </>
      )}

      {/* Enabled but no child yet: a real empty state, never a blank pane. */}
      {!active && !adding && (
        <div className="glass mt-6 rounded-3xl p-6 text-center shadow-soft">
          <div className="text-3xl" aria-hidden>
            👶
          </div>
          <p className="mt-3 font-display text-lg font-semibold text-text">
            Add your child to get started
          </p>
          <p className="mt-1.5 text-sm text-muted">
            The age band tailors every plan and tool. It stays on your account
            only, and deletes in one tap.
          </p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="grad-primary mt-4 inline-block rounded-2xl px-6 py-3 font-semibold shadow-soft"
          >
            Add a child
          </button>
        </div>
      )}

      {/* Add-child sheet */}
      {adding && (
        <AddChildSheet
          onClose={() => setAdding(false)}
          onAdded={onAdded}
          allowCancel={children.length > 0}
        />
      )}

      {/* Turn-off */}
      {children.length > 0 && (
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/parents", {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ enabled: false }),
            });
            setEnabled(false);
            window.dispatchEvent(new Event("adhv-parents-changed"));
          }}
          className="mt-6 text-xs text-muted/70 underline-offset-4 transition-colors hover:text-accent hover:underline"
        >
          Turn off Parents Mode
        </button>
      )}
    </div>
  );
}

function AddChildSheet({
  onClose,
  onAdded,
  allowCancel,
}: {
  onClose: () => void;
  onAdded: (child: Child) => void;
  allowCancel: boolean;
}) {
  const [name, setName] = useState("");
  const [band, setBand] = useState<AgeBand | null>(null);
  const [hardest, setHardest] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEscape(() => {
    if (allowCancel) onClose();
  });

  function save() {
    if (!band || busy) return;
    setBusy(true);
    setNotice(null);
    const h = hardest.trim();
    // Safeguarding runs on-device, before saving — the note never leaves here.
    if (h && childSafetyConcern(h)) {
      capture("child_safety_routed", { surface: "add_child" });
      setNotice(CHILD_SAFETY_SIGNPOST);
      setBusy(false);
      return;
    }
    const child = addChildLocal({
      name: name.trim() || undefined,
      ageBand: band,
      hardest: h || undefined,
    });
    capture("child_added", { ageBand: band });
    onAdded(child);
    setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Add a child"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-5">
        {allowCancel && (
          <button
            type="button"
            onClick={onClose}
            className="self-start text-sm text-muted transition-colors hover:text-text"
          >
            ✕ close
          </button>
        )}

        <div className="flex-1 pt-5">
          <h2 className="font-display text-2xl font-semibold text-text">
            Tell me about your child.
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Only what you want to share. The age band lets everything adapt — a
            5-year-old and a 15-year-old need very different things.
          </p>

          <label className="mt-6 block text-sm font-medium text-muted">
            A name or nickname <span className="font-normal">(optional)</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 40))}
            placeholder="a nickname — or leave blank"
            className="mt-1.5 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <p className="mt-1.5 text-xs text-muted/80">
            No need for their real name — a nickname or nothing is fine. It
            stays on this device only.
          </p>

          <label className="mt-5 block text-sm font-medium text-muted">
            Age band <span className="text-accent">*</span>
          </label>
          <div className="mt-2 flex flex-col gap-2">
            {AGE_BANDS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBand(b.id)}
                aria-pressed={band === b.id}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  band === b.id
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-surface hover:border-accent/50"
                }`}
              >
                <span className="font-semibold text-text">Ages {b.label}</span>
                <span className="mt-0.5 block text-sm text-muted">
                  {b.blurb}
                </span>
              </button>
            ))}
          </div>

          <label className="mt-5 block text-sm font-medium text-muted">
            What&apos;s hardest right now?{" "}
            <span className="font-normal">(optional)</span>
          </label>
          <textarea
            value={hardest}
            onChange={(e) => setHardest(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="e.g. mornings are a battle, homework meltdowns…"
            className="mt-1.5 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />

          {notice && (
            <p className="mt-4 rounded-2xl bg-accent-soft/60 p-3.5 text-sm leading-relaxed text-text">
              {notice}
            </p>
          )}

          <button
            type="button"
            onClick={() => void save()}
            disabled={!band || busy}
            className="grad-primary mt-6 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add child"}
          </button>
          <p className="mt-3 text-center text-xs text-muted/80">
            Kept on this device only — never sent to our servers. No child
            login, ever. Delete any time.
          </p>
        </div>
      </div>
    </div>
  );
}
