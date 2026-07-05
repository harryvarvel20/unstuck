"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEscape } from "@/lib/hooks";
import { capture } from "@/lib/analytics";
import { PhotoAttach } from "./PhotoAttach";

interface ThreadSummary {
  id: string;
  name: string;
  last: { content: string; mine: boolean; at: string } | null;
}
interface Message {
  id: string;
  mine: boolean;
  content: string;
  photoUrl: string | null;
  at: string;
}

/**
 * 1:1 messages between friends. Deliberately calm: no typing indicators,
 * no read receipts (unless BOTH opt in — v1 ships without them entirely),
 * no "online now" pressure. Just letters between friends, delivered fast.
 */
export function MessagesView({
  initialThreadId,
}: {
  initialThreadId?: string | null;
}) {
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialThreadId ?? null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/social/dms");
    if (res.ok) {
      const body = (await res.json()) as { threads: ThreadSummary[] };
      setThreads(body.threads);
    } else {
      setThreads([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (openId) {
    return (
      <ThreadView
        threadId={openId}
        onBack={() => {
          setOpenId(null);
          void refresh();
        }}
      />
    );
  }

  return (
    <div>
      {threads === null && <div className="skeleton h-24 rounded-3xl" />}
      {threads !== null && threads.length === 0 && (
        <div className="rounded-3xl border border-border bg-surface p-6 text-center">
          <p className="text-text">No conversations yet.</p>
          <p className="mt-2 text-sm text-muted">
            Open one from the People tab — tap “message” next to any friend.
          </p>
        </div>
      )}
      <ul className="flex flex-col gap-2.5">
        {(threads ?? []).map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => setOpenId(t.id)}
              className="glass w-full rounded-2xl p-4 text-left shadow-soft transition-transform active:scale-[0.99]"
            >
              <p className="font-semibold text-text">{t.name}</p>
              {t.last && (
                <p className="mt-0.5 truncate text-sm text-muted">
                  {t.last.mine ? "you: " : ""}
                  {t.last.content}
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThreadView({
  threadId,
  onBack,
}: {
  threadId: string;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEscape(onBack);

  const load = useCallback(async () => {
    const res = await fetch(`/api/social/dms/${threadId}`);
    if (res.ok) {
      const body = (await res.json()) as { name: string; messages: Message[] };
      setName(body.name);
      setMessages(body.messages);
    }
  }, [threadId]);

  // Load now, then poll gently while the thread is open.
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const text = draft.trim();
    if ((!text && !photo) || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/social/dms/${threadId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: text || undefined,
          photoBase64: photo ?? undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setDraft("");
        setPhoto(null);
        capture("dm_sent", { photo: Boolean(photo) });
        if (body.crisis) setNotice(body.message as string);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[65dvh] flex-col">
      <div className="flex items-center gap-3 border-b border-border/60 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted transition-colors hover:text-text"
        >
          ← back
        </button>
        <p className="font-semibold text-text">{name || "…"}</p>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <ul className="flex flex-col gap-2">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`flex max-w-[80%] flex-col gap-2 ${
                m.mine ? "self-end" : "self-start"
              }`}
            >
              {m.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.photoUrl}
                  alt="Shared photo"
                  loading="lazy"
                  className="max-h-64 rounded-2xl border border-border object-cover"
                />
              )}
              {m.content && (
                <span
                  className={`rounded-2xl px-3.5 py-2 text-[0.95rem] leading-snug ${
                    m.mine
                      ? "bg-accent text-accent-ink"
                      : "bg-surface-2 text-text"
                  }`}
                >
                  {m.content}
                </span>
              )}
            </li>
          ))}
        </ul>
        <div ref={bottomRef} />
      </div>

      {notice && (
        <p className="mb-2 rounded-2xl bg-accent-soft/50 p-3 text-sm text-text">
          {notice}
        </p>
      )}

      <div className="border-t border-border/60 pt-3">
        {photo && (
          <div className="mb-2">
            <PhotoAttach value={photo} onChange={setPhoto} compact />
          </div>
        )}
        <div className="flex items-center gap-2">
          {!photo && (
            <PhotoAttach value={photo} onChange={setPhoto} label="Photo" />
          )}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
            placeholder="Write something…"
            className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={(!draft.trim() && !photo) || busy}
            className="rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
