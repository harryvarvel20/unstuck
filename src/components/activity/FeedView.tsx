"use client";

import { useCallback, useEffect, useState } from "react";
import { capture } from "@/lib/analytics";
import { haptic } from "@/lib/design";
import { useEscape } from "@/lib/hooks";
import { PhotoAttach } from "./PhotoAttach";

interface Reaction {
  name: string;
  kind: string;
  mine: boolean;
}
interface Comment {
  id: string;
  name: string;
  content: string;
  mine: boolean;
}
export interface Playbook {
  steps: { title: string; minutes?: number }[];
  tool?: string;
  timeTaken?: string;
  whatWorked?: string;
}
interface Post {
  id: string;
  mine: boolean;
  author: string;
  winText: string;
  caption: string | null;
  tags: string[];
  photoUrl: string | null;
  visibility: string;
  commentsOff: boolean;
  playbook: Playbook | null;
  createdAt: string;
  reactions: Reaction[];
  comments: Comment[];
}

type Scope = "friends" | "public" | "just_me";
type Space = "main" | "parents";

const SCOPES: { key: Scope; label: string }[] = [
  { key: "friends", label: "Friends" },
  { key: "public", label: "Public" },
  { key: "just_me", label: "Just me" },
];

const SEARCH_EXAMPLES = [
  "getting out of bed",
  "the dreaded email",
  "cleaned the kitchen",
];
const SEARCH_EXAMPLES_PARENTS = [
  "morning routine",
  "homework meltdown",
  "bedtime",
];

const REACTION_EMOJI: Record<string, string> = {
  clap: "👏",
  heart: "💛",
  rocket: "🚀",
  party: "🎉",
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * The wins feed: finite, reverse-chron, ends with "you're all caught up".
 * A scope selector (Friends / Public / Just me — Y6) filters WHAT YOU VIEW,
 * enforced server-side, and is deliberately distinct from the per-post "who
 * can see this" control. Caption/how-to search (Y5) sits above it. In the
 * parents space (Y4) the copy steers to the parent's own strategy.
 */
export function FeedView({
  sharePrefill,
  space = "main",
}: {
  sharePrefill?: string;
  space?: Space;
}) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [composing, setComposing] = useState(Boolean(sharePrefill));
  const [scope, setScope] = useState<Scope>("friends");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Post[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [crisis, setCrisis] = useState<string | null>(null);

  const storeKey = `adhv-feed-scope-${space}`;

  // Restore this space's last-used scope.
  useEffect(() => {
    try {
      const s = localStorage.getItem(storeKey);
      if (s === "friends" || s === "public" || s === "just_me") setScope(s);
    } catch {
      /* noop */
    }
  }, [storeKey]);

  const refresh = useCallback(async () => {
    setPosts(null);
    const res = await fetch(`/api/social/posts?scope=${scope}&space=${space}`);
    if (res.ok) {
      const body = (await res.json()) as { posts: Post[] };
      setPosts(body.posts);
    } else {
      setPosts([]);
    }
  }, [scope, space]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function changeScope(s: Scope) {
    if (s === scope) return;
    setScope(s);
    try {
      localStorage.setItem(storeKey, s);
    } catch {
      /* noop */
    }
    capture("feed_scope_changed", { scope: s, space });
  }

  // Debounced search (server-side; RLS-respecting).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setCrisis(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/social/search?q=${encodeURIComponent(q)}&space=${space}`,
        );
        const body = (await res.json()) as {
          posts?: Post[];
          crisis?: boolean;
          message?: string;
        };
        if (body.crisis && body.message) {
          setCrisis(body.message);
          setResults([]);
        } else {
          setCrisis(null);
          setResults(body.posts ?? []);
          capture("activity_search_performed", { len: q.length, space });
        }
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, space]);

  const isParents = space === "parents";
  const searching2 = query.trim().length >= 2;
  const examples = isParents ? SEARCH_EXAMPLES_PARENTS : SEARCH_EXAMPLES;

  return (
    <div>
      <button
        type="button"
        onClick={() => setComposing(true)}
        className="grad-primary w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft"
      >
        {isParents ? "Share what worked" : "Share a win"}
      </button>

      {composing && (
        <ShareWinSheet
          prefill={sharePrefill}
          space={space}
          onClose={() => setComposing(false)}
          onShared={() => {
            setComposing(false);
            void refresh();
          }}
        />
      )}

      {/* Search (Y5.3) */}
      <div className="mt-3">
        <label htmlFor="feed-search" className="sr-only">
          Search {isParents ? "parent playbooks" : "wins and how-tos"}
        </label>
        <input
          id="feed-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value.slice(0, 80))}
          placeholder={
            isParents ? "Search parent playbooks…" : "Search wins and how-tos…"
          }
          className="w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
      </div>

      {searching2 ? (
        <SearchResultsView
          results={results}
          searching={searching}
          crisis={crisis}
          examples={examples}
          onChange={() => {
            // a search-result action (react/comment/report) refreshes the feed
            void refresh();
          }}
        />
      ) : (
        <>
          {/* Scope selector (Y6) — "what you're viewing", not "who can see". */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-medium text-muted">Show:</span>
            <div
              role="tablist"
              aria-label="Whose wins to show"
              className="flex flex-1 gap-1 rounded-full bg-surface/60 p-1"
            >
              {SCOPES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={scope === s.key}
                  onClick={() => changeScope(s.key)}
                  className={`flex-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    scope === s.key
                      ? "bg-surface-2 text-text shadow-soft"
                      : "text-muted hover:text-text"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {posts === null && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="skeleton h-28 rounded-3xl" />
              <div className="skeleton h-28 rounded-3xl" />
            </div>
          )}

          {posts !== null && posts.length === 0 && (
            <ScopeEmptyState scope={scope} isParents={isParents} />
          )}

          <ul className="mt-4 flex flex-col gap-4">
            {(posts ?? []).map((p) => (
              <PostCard key={p.id} post={p} onChange={refresh} />
            ))}
          </ul>

          {posts !== null && posts.length > 0 && (
            <p className="mt-8 text-center text-sm text-muted">
              ✨ You&apos;re all caught up. Nothing else to scroll — go be
              somewhere nice.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ScopeEmptyState({
  scope,
  isParents,
}: {
  scope: Scope;
  isParents: boolean;
}) {
  const copy: Record<Scope, { body: string; cta?: string }> = {
    friends: {
      body: "No wins from friends yet.",
      cta: "Add a friend from the People tab.",
    },
    public: {
      body: isParents
        ? "No public parent playbooks yet — be the first to share what worked."
        : "No public wins yet — be the first to share one.",
    },
    just_me: {
      body: "You haven't shared anything here yet.",
      cta: "Share your first win — small counts double.",
    },
  };
  const c = copy[scope];
  return (
    <div className="mt-4 rounded-3xl border border-border bg-surface p-6 text-center">
      <p className="text-text">{c.body}</p>
      {c.cta && <p className="mt-2 text-sm text-muted">{c.cta}</p>}
    </div>
  );
}

function SearchResultsView({
  results,
  searching,
  crisis,
  examples,
  onChange,
}: {
  results: Post[] | null;
  searching: boolean;
  crisis: string | null;
  examples: string[];
  onChange: () => void;
}) {
  if (crisis) {
    return (
      <div
        className="mt-4 animate-fade-in rounded-3xl border border-accent/40 bg-accent-soft/70 p-5"
        role="status"
      >
        <div className="mb-2 text-2xl">💛</div>
        <p className="text-[1.02rem] leading-relaxed text-text">{crisis}</p>
      </div>
    );
  }
  if (searching && results === null) {
    return (
      <div className="mt-4 flex flex-col gap-3">
        <div className="skeleton h-24 rounded-3xl" />
      </div>
    );
  }
  if (results !== null && results.length === 0) {
    return (
      <div className="mt-4 rounded-3xl border border-border bg-surface p-6 text-center">
        <p className="text-text">Nothing matched that yet.</p>
        <p className="mt-2 text-sm text-muted">
          Try something like {examples.map((e) => `“${e}”`).join(", ")}.
        </p>
      </div>
    );
  }
  return (
    <ul className="mt-4 flex flex-col gap-4">
      {(results ?? []).map((p) => (
        <PostCard key={p.id} post={p} onChange={onChange} />
      ))}
    </ul>
  );
}

function PostCard({ post, onChange }: { post: Post; onChange: () => void }) {
  const [showPicker, setShowPicker] = useState(false);
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [nudge, setNudge] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function react(kind: string | null) {
    setShowPicker(false);
    haptic(6);
    await fetch("/api/social/react", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId: post.id, kind: kind ?? undefined }),
    });
    capture("post_reacted");
    onChange();
  }

  async function sendComment(force = false) {
    const text = commentText.trim();
    if (!text || busy) return;
    setBusy(true);
    setNudge(null);
    try {
      // Gentle tone-guard: a nudge, never a block. Skipped when re-sending.
      if (!force) {
        const guard = await fetch("/api/social/assist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "toneguard", text }),
        })
          .then((r) => (r.ok ? r.json() : { kind: true }))
          .catch(() => ({ kind: true }));
        if (guard.kind === false && guard.nudge) {
          setNudge(guard.nudge as string);
          return;
        }
      }
      const res = await fetch("/api/social/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: post.id, content: text }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.crisis) {
        setNotice(body.message as string);
        return;
      }
      if (res.ok) {
        setCommentText("");
        capture("post_commented");
        onChange();
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(id: string) {
    await fetch("/api/social/comments", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    onChange();
  }

  async function reportComment(id: string) {
    await fetch("/api/social/safety", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "report",
        subjectType: "comment",
        subjectId: id,
      }),
    });
    capture("comment_reported");
  }

  const mine = post.reactions.find((r) => r.mine);

  return (
    <li className="glass rounded-3xl p-5 shadow-soft">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-accent">
          {post.mine ? "You" : post.author}
        </p>
        <span className="flex-shrink-0 text-xs text-muted">
          {timeAgo(post.createdAt)}
          {post.mine && (
            <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5">
              {post.visibility}
            </span>
          )}
        </span>
      </div>

      <p className="mt-2 text-[1.05rem] font-medium leading-snug text-text">
        {post.winText}
      </p>
      {post.caption && <p className="mt-1.5 text-muted">{post.caption}</p>}
      {post.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.photoUrl}
          alt="Attached to this win"
          loading="lazy"
          className="mt-3 max-h-96 w-full rounded-2xl border border-border object-cover"
        />
      )}
      {post.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {post.playbook && (
        <div className="mt-3 rounded-2xl border border-border bg-surface p-3.5">
          <button
            type="button"
            onClick={() => setShowPlaybook(!showPlaybook)}
            className="flex w-full items-center justify-between text-left text-sm font-semibold text-text"
          >
            📖 How I did it
            <span className="text-muted">{showPlaybook ? "−" : "+"}</span>
          </button>
          {showPlaybook && (
            <div className="mt-2 animate-fade-in">
              <ol className="flex flex-col gap-1.5 text-sm text-text">
                {post.playbook.steps.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted">{i + 1}.</span>
                    <span>
                      {s.title}
                      {s.minutes ? (
                        <span className="text-muted"> · {s.minutes}m</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
              {post.playbook.whatWorked && (
                <p className="mt-2 text-sm italic text-muted">
                  “{post.playbook.whatWorked}”
                </p>
              )}
              <TryButton winText={post.winText} playbook={post.playbook} />
            </div>
          )}
        </div>
      )}

      {/* Reactions: named faces, never a number. */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {post.reactions.map((r, i) => (
          <span
            key={i}
            title={r.name}
            className="rounded-full bg-surface-2 px-2 py-0.5 text-sm"
          >
            {REACTION_EMOJI[r.kind] ?? "💛"}{" "}
            <span className="text-xs text-muted">{r.name}</span>
          </span>
        ))}
        {!post.mine && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-sm text-muted transition-colors hover:border-accent/50 hover:text-accent"
            >
              {mine ? REACTION_EMOJI[mine.kind] : "+"}
            </button>
            {showPicker && (
              <div className="absolute bottom-full left-0 z-10 mb-1.5 flex gap-1 rounded-full border border-border bg-surface-2 p-1.5 shadow-float">
                {Object.entries(REACTION_EMOJI).map(([kind, emoji]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => void react(kind)}
                    className="rounded-full px-1.5 text-lg transition-transform hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
                {mine && (
                  <button
                    type="button"
                    onClick={() => void react(null)}
                    className="px-1.5 text-sm text-muted"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comments: small, kind, bounded — each reportable/deletable. */}
      {post.comments.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-border/60 pt-3">
          {post.comments.map((c) => (
            <li key={c.id} className="group flex items-start gap-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-text">{c.name}</span>{" "}
                <span className="text-muted">{c.content}</span>
              </span>
              {c.mine || post.mine ? (
                <button
                  type="button"
                  onClick={() => void deleteComment(c.id)}
                  className="flex-shrink-0 text-xs text-muted/70 opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                  aria-label="Delete comment"
                >
                  delete
                </button>
              ) : (
                <ReportInline onReport={() => void reportComment(c.id)} />
              )}
            </li>
          ))}
        </ul>
      )}
      {!post.commentsOff && !post.mine && (
        <div className="mt-3 flex gap-2">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value.slice(0, 400))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void sendComment();
            }}
            placeholder="Say something kind…"
            className="min-w-0 flex-1 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void sendComment()}
            disabled={!commentText.trim() || busy}
            className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}
      {nudge && (
        <div className="mt-2 rounded-2xl bg-accent-soft/50 p-3 text-sm">
          <p className="text-text">{nudge}</p>
          <button
            type="button"
            onClick={() => void sendComment(true)}
            className="mt-1.5 text-xs font-medium text-muted underline-offset-2 hover:underline"
          >
            send it anyway
          </button>
        </div>
      )}
      {notice && (
        <p className="mt-2 rounded-2xl bg-accent-soft/50 p-3 text-sm text-text">
          {notice}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-3 text-xs text-muted">
        {post.mine ? (
          <>
            <select
              value={post.visibility}
              onChange={async (e) => {
                await fetch("/api/social/posts", {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    id: post.id,
                    visibility: e.target.value,
                  }),
                });
                onChange();
              }}
              className="rounded-lg border border-border bg-surface px-1.5 py-0.5 text-xs text-muted"
              aria-label="Who can see this win"
            >
              <option value="private">only me</option>
              <option value="friends">friends</option>
              <option value="public">public</option>
            </select>
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/social/posts", {
                  method: "DELETE",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ id: post.id }),
                });
                onChange();
              }}
              className="transition-colors hover:text-accent"
            >
              delete
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/social/safety", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  action: "report",
                  subjectType: "post",
                  subjectId: post.id,
                }),
              });
              setCopied(true);
            }}
            className="transition-colors hover:text-accent"
          >
            {copied ? "reported — a human will look" : "report"}
          </button>
        )}
      </div>
    </li>
  );
}

function ReportInline({ onReport }: { onReport: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        onReport();
        setDone(true);
      }}
      className="flex-shrink-0 text-xs text-muted/70 opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
      aria-label="Report comment"
    >
      {done ? "reported" : "report"}
    </button>
  );
}

/** "Try this myself" — copies a playbook into your own task list. */
export function TryButton({
  winText,
  playbook,
}: {
  winText: string;
  playbook: Playbook;
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "signin">(
    "idle",
  );

  async function tryIt() {
    setState("busy");
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input_text: winText.slice(0, 500),
        steps: playbook.steps.slice(0, 40).map((s) => ({
          title: s.title,
          minutes: Math.min(240, Math.max(1, s.minutes ?? 5)),
        })),
      }),
    });
    if (res.status === 401 || res.status === 503) {
      setState("signin");
      return;
    }
    capture("playbook_copied");
    setState(res.ok ? "done" : "idle");
  }

  if (state === "done") {
    return (
      <a
        href="/tasks"
        className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
      >
        Saved to your tasks — open it →
      </a>
    );
  }
  if (state === "signin") {
    return (
      <a
        href="/login"
        className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
      >
        Sign in to save this →
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void tryIt()}
      disabled={state === "busy"}
      className="mt-3 rounded-full border border-accent/50 bg-surface px-4 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
    >
      Try this myself
    </button>
  );
}

/** Share-a-win composer — sharing is explicit, always. */
function ShareWinSheet({
  prefill,
  space = "main",
  onClose,
  onShared,
}: {
  prefill?: string;
  space?: Space;
  onClose: () => void;
  onShared: () => void;
}) {
  const isParents = space === "parents";
  const [winText, setWinText] = useState(prefill ?? "");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<
    "private" | "friends" | "public"
  >("friends");
  const [anon, setAnon] = useState(false);
  const [commentsOff, setCommentsOff] = useState(false);
  const [withPlaybook, setWithPlaybook] = useState(false);
  const [steps, setSteps] = useState<string>("");
  const [whatWorked, setWhatWorked] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEscape(onClose);

  async function draftPlaybook() {
    if (!winText.trim() || drafting) return;
    setDrafting(true);
    try {
      const res = await fetch("/api/social/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "playbook",
          title: winText,
          steps: steps
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as {
          steps: { title: string; minutes: number }[];
          whatWorked: string;
        };
        setSteps(
          body.steps.map((s) => `${s.title} (${s.minutes}m)`).join("\n"),
        );
        if (body.whatWorked) setWhatWorked(body.whatWorked);
      }
    } finally {
      setDrafting(false);
    }
  }

  async function share() {
    if (!winText.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const playbook = withPlaybook
        ? {
            steps: steps
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 12)
              .map((line) => {
                const m = line.match(/^(.*?)\s*\((\d+)m\)$/);
                const title = (m?.[1] ?? line).slice(0, 200);
                const rawMin = m?.[2];
                return {
                  title,
                  minutes: rawMin
                    ? Math.min(240, Math.max(1, parseInt(rawMin, 10)))
                    : undefined,
                };
              }),
            whatWorked: whatWorked.trim() || undefined,
          }
        : null;
      if (playbook && playbook.steps.length === 0) {
        setNotice("Add at least one step to share the how.");
        return;
      }

      const res = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          winText: winText.trim(),
          caption: caption.trim() || undefined,
          tags: tags
            .split(/[,\s#]+/)
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 5),
          visibility,
          anon: visibility === "public" ? anon : false,
          commentsOff,
          playbook,
          photoBase64: isParents ? undefined : (photo ?? undefined),
          space,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.crisis) {
        setNotice(body.message as string);
        return;
      }
      if (res.ok) {
        capture("win_shared", {
          visibility,
          playbook: Boolean(playbook),
          space,
        });
        onShared();
      } else {
        setNotice("Couldn't share just now — try again in a moment.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isParents ? "Share what worked" : "Share a win"}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-5">
        <button
          type="button"
          onClick={onClose}
          className="self-start text-sm text-muted transition-colors hover:text-text"
        >
          ✕ close
        </button>

        <div className="flex-1 pt-5">
          <h2 className="font-display text-2xl font-semibold text-text">
            {isParents ? "Share what worked with your kid." : "Share a win."}
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            {isParents
              ? "About YOUR strategy — the thing that finally helped. No child names, photos, or schools; keep it about what you did."
              : "Small counts double here. Nothing posts until you hit share."}
          </p>

          <label className="mt-5 block text-sm font-medium text-muted">
            {isParents ? "What worked?" : "What did you do?"}
          </label>
          <input
            value={winText}
            onChange={(e) => setWinText(e.target.value.slice(0, 300))}
            autoFocus
            placeholder={
              isParents
                ? "e.g. a visual morning chart cut the battles"
                : "e.g. finally sent the dentist email"
            }
            className="mt-1.5 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />

          <label className="mt-4 block text-sm font-medium text-muted">
            Anything to add? <span className="font-normal">(optional)</span>
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 500))}
            rows={2}
            className="mt-1.5 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
            placeholder={
              isParents
                ? "what changed, how you'll keep it going…"
                : "the backstory, the drama, the relief…"
            }
          />

          <label className="mt-4 block text-sm font-medium text-muted">
            Tags{" "}
            <span className="font-normal">
              {isParents
                ? "(optional, e.g. mornings, homework)"
                : "(optional, e.g. admin, laundry)"}
            </span>
          </label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value.slice(0, 120))}
            className="mt-1.5 w-full rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
          />

          {/* No photos in the parents space — child-safety hard rule. */}
          {!isParents && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-muted">
                Photo <span className="font-normal">(optional)</span>
              </label>
              <div className="mt-1.5">
                <PhotoAttach
                  value={photo}
                  onChange={setPhoto}
                  label="Add a photo"
                />
              </div>
            </div>
          )}

          {/* The how — optional, and the heart of the library. */}
          <button
            type="button"
            onClick={() => setWithPlaybook(!withPlaybook)}
            className="mt-5 flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-text">
              📖 Attach “how I did it”
            </span>
            <span className="text-muted">{withPlaybook ? "−" : "+"}</span>
          </button>
          {withPlaybook && (
            <div className="mt-2 rounded-2xl border border-border bg-surface p-3.5 animate-fade-in">
              <textarea
                value={steps}
                onChange={(e) => setSteps(e.target.value.slice(0, 2000))}
                rows={4}
                placeholder={
                  "One step per line, e.g.\nOpen the email app (2m)\nWrite one ugly draft (10m)"
                }
                className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-muted/50 focus:border-accent focus:outline-none"
              />
              <input
                value={whatWorked}
                onChange={(e) => setWhatWorked(e.target.value.slice(0, 400))}
                placeholder="What made it possible? (one line)"
                className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-muted/50 focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void draftPlaybook()}
                disabled={!winText.trim() || drafting}
                className="mt-2 text-sm font-medium text-accent underline-offset-4 hover:underline disabled:opacity-50"
              >
                {drafting ? "drafting…" : "✨ draft it for me"}
              </button>
            </div>
          )}

          {/* Audience — explicit every time. */}
          <label className="mt-5 block text-sm font-medium text-muted">
            Who sees this?
          </label>
          <div className="mt-1.5 flex gap-2">
            {(["private", "friends", "public"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`flex-1 rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors ${
                  visibility === v
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-surface text-muted hover:text-text"
                }`}
              >
                {v === "private"
                  ? "Only me"
                  : v === "friends"
                    ? "Friends"
                    : "Public"}
              </button>
            ))}
          </div>
          {visibility === "public" && (
            <label className="mt-3 flex items-center gap-2.5 text-sm text-text">
              <input
                type="checkbox"
                checked={anon}
                onChange={(e) => setAnon(e.target.checked)}
                className="h-4 w-4 accent-[rgb(var(--accent))]"
              />
              Post without my name (as “someone with ADHD”)
            </label>
          )}
          <label className="mt-2.5 flex items-center gap-2.5 text-sm text-text">
            <input
              type="checkbox"
              checked={commentsOff}
              onChange={(e) => setCommentsOff(e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--accent))]"
            />
            Turn comments off for this one
          </label>

          {notice && (
            <p className="mt-4 rounded-2xl bg-accent-soft/50 p-3.5 text-sm text-text">
              {notice}
            </p>
          )}

          <button
            type="button"
            onClick={() => void share()}
            disabled={!winText.trim() || busy}
            className="grad-primary mt-5 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-50"
          >
            {busy ? "Sharing…" : "Share it"}
          </button>
        </div>
      </div>
    </div>
  );
}
