"use client";

import { useCallback, useEffect, useState } from "react";
import type { SocialProfileDto } from "./ActivityCenter";
import { capture } from "@/lib/analytics";
import { PhotoAttach } from "./PhotoAttach";
import { HandlePicker } from "./HandlePicker";

interface FriendRow {
  id: string;
  friendId: string;
  handle: string;
  name: string;
  mutedByMe: boolean;
  status: string | null;
}
interface FriendsPayload {
  friends: FriendRow[];
  requestsIn: FriendRow[];
  requestsOut: FriendRow[];
  myHandle: string;
}
interface Boost {
  id: string;
  from: string;
  message: string;
  seen: boolean;
}
interface Challenge {
  id: string;
  name: string;
  code: string;
  target: number;
  done: number;
  endsAt: string;
  ended: boolean;
  tickedToday: boolean;
  members: string[];
  photos: { url: string; caption: string | null; who: string }[];
}
interface BuddyPayload {
  pair: {
    id: string;
    status: string;
    awaitingMe: boolean;
    buddyName: string;
    buddyId: string;
  } | null;
  checkins: {
    id: string;
    mine: boolean;
    note: string;
    response: string | null;
    at: string;
  }[];
}

const BOOST_PRESETS = [
  "You've got this. One tiny step. 💛",
  "Thinking of you — no pressure, just cheering.",
  "Remember: done ugly beats perfect and unstarted.",
  "Proof you can do hard things: literally all of last week.",
];

async function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** People tab: friends, boosts, status, challenges, buddy, settings. */
export function PeopleView({
  profile,
  onProfileChange,
  onRefresh,
  onMessage,
}: {
  profile: SocialProfileDto;
  onProfileChange: (patch: Record<string, unknown>) => Promise<void>;
  onRefresh: () => Promise<void>;
  onMessage: (friendId: string) => void;
}) {
  const [data, setData] = useState<FriendsPayload | null>(null);
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [buddy, setBuddy] = useState<BuddyPayload | null>(null);

  const refresh = useCallback(async () => {
    const [f, b, c, bd] = await Promise.all([
      fetch("/api/social/friends").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/social/boosts").then((r) =>
        r.ok ? r.json() : { boosts: [] },
      ),
      fetch("/api/social/challenges").then((r) =>
        r.ok ? r.json() : { challenges: [] },
      ),
      fetch("/api/social/buddy").then((r) =>
        r.ok ? r.json() : { pair: null },
      ),
    ]);
    if (f) setData(f as FriendsPayload);
    setBoosts((b as { boosts: Boost[] }).boosts ?? []);
    setChallenges((c as { challenges: Challenge[] }).challenges ?? []);
    setBuddy(bd as BuddyPayload);
    // Seeing your boosts marks them read — words, not badges.
    if ((b as { boosts: Boost[] }).boosts?.some((x) => !x.seen)) {
      void fetch("/api/social/boosts", { method: "PATCH" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex flex-col gap-6">
      <BoostInbox boosts={boosts} />
      <StatusCard />
      <FriendsCard
        data={data}
        onChanged={refresh}
        onMessage={onMessage}
        buddy={buddy}
      />
      <ChallengesCard challenges={challenges} onChanged={refresh} />
      <BuddyCard
        buddy={buddy}
        friends={data?.friends ?? []}
        onChanged={refresh}
      />
      <SettingsCard
        profile={profile}
        onProfileChange={onProfileChange}
        onRefresh={onRefresh}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- */
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass rounded-3xl p-5 shadow-soft">
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function BoostInbox({ boosts }: { boosts: Boost[] }) {
  if (boosts.length === 0) return null;
  return (
    <Card title="Boosts for you">
      <ul className="flex flex-col gap-2.5">
        {boosts.slice(0, 6).map((b) => (
          <li
            key={b.id}
            className={`rounded-2xl p-3.5 ${b.seen ? "bg-surface" : "bg-accent-soft/50"}`}
          >
            <p className="text-[0.95rem] text-text">{b.message}</p>
            <p className="mt-1 text-xs text-muted">— {b.from}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StatusCard() {
  const [kind, setKind] = useState<string | null>(null);
  useEffect(() => {
    void fetch("/api/social/status").then(async (r) => {
      if (r.ok) setKind(((await r.json()) as { kind: string | null }).kind);
    });
  }, []);
  async function set(next: string | null) {
    setKind(next);
    await post("/api/social/status", { kind: next, audience: "friends" });
    if (next) capture("status_shared", { kind: next });
  }
  return (
    <Card title="Let friends know (optional)">
      <p className="text-sm text-muted">
        Shares one soft line with friends for 24h. They can only answer with a
        boost — no advice pile-on.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void set(kind === "slow_start" ? null : "slow_start")}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            kind === "slow_start"
              ? "border-accent bg-accent-soft text-accent"
              : "border-border bg-surface text-muted hover:text-text"
          }`}
        >
          🐌 having a slow start
        </button>
        <button
          type="button"
          onClick={() => void set(kind === "frozen" ? null : "frozen")}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            kind === "frozen"
              ? "border-accent bg-accent-soft text-accent"
              : "border-border bg-surface text-muted hover:text-text"
          }`}
        >
          🧊 a bit frozen today
        </button>
      </div>
    </Card>
  );
}

function FriendsCard({
  data,
  onChanged,
  onMessage,
  buddy,
}: {
  data: FriendsPayload | null;
  onChanged: () => Promise<void>;
  onMessage: (friendId: string) => void;
  buddy: BuddyPayload | null;
}) {
  const [handle, setHandle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [boostFor, setBoostFor] = useState<FriendRow | null>(null);

  async function add() {
    if (!handle.trim()) return;
    const res = await post("/api/social/friends", {
      handle: handle.trim().replace(/^@/, ""),
    });
    if (res.ok) {
      setMsg("Request sent. They'll see it in their People tab.");
      setHandle("");
      capture("friend_requested");
      await onChanged();
    } else if (res.status === 404) {
      setMsg("Couldn't find that handle — double-check the spelling.");
    } else {
      setMsg("Couldn't send that just now.");
    }
  }

  async function act(id: string, action: string) {
    await fetch("/api/social/friends", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (action === "accept") capture("friend_accepted");
    await onChanged();
  }

  async function unfriend(id: string) {
    await fetch("/api/social/friends", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await onChanged();
  }

  return (
    <Card title="Friends">
      {data && (
        <p className="text-sm text-muted">
          Your handle:{" "}
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(`@${data.myHandle}`);
              setMsg("Handle copied — send it to someone you trust.");
            }}
            className="font-semibold text-accent underline-offset-4 hover:underline"
          >
            @{data.myHandle}
          </button>{" "}
          — share it so people can add you.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value.slice(0, 60))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
          placeholder="add by handle, e.g. @sunny-otter-317"
          className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={!handle.trim()}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}

      {(data?.requestsIn.length ?? 0) > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-text">Wants to connect</p>
          <ul className="mt-2 flex flex-col gap-2">
            {data!.requestsIn.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-3"
              >
                <span className="text-sm text-text">@{r.handle}</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void act(r.id, "accept")}
                    className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(r.id, "decline")}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted"
                  >
                    Not now
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {(data?.friends ?? []).map((f) => (
          <li key={f.id} className="rounded-2xl bg-surface p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-text">
                  {f.name}
                  {buddy?.pair?.buddyId === f.friendId && (
                    <span className="ml-1.5 text-xs text-accent">· buddy</span>
                  )}
                </p>
                {f.status && (
                  <p className="text-xs text-muted">
                    {f.status === "frozen"
                      ? "🧊 a bit frozen today"
                      : "🐌 having a slow start"}
                  </p>
                )}
              </div>
              <div className="flex flex-shrink-0 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setBoostFor(f)}
                  className="rounded-full border border-accent/50 px-2.5 py-1 font-semibold text-accent transition-colors hover:bg-accent-soft"
                >
                  ⚡ boost
                </button>
                <button
                  type="button"
                  onClick={() => onMessage(f.friendId)}
                  className="rounded-full border border-border px-2.5 py-1 text-muted transition-colors hover:text-text"
                >
                  message
                </button>
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-3 text-xs text-muted/80">
              <button
                type="button"
                onClick={() => void act(f.id, f.mutedByMe ? "unmute" : "mute")}
                className="transition-colors hover:text-text"
              >
                {f.mutedByMe ? "unmute" : "mute"}
              </button>
              <button
                type="button"
                onClick={() => void unfriend(f.id)}
                className="transition-colors hover:text-accent"
              >
                unfriend (silent)
              </button>
            </div>
          </li>
        ))}
      </ul>

      {(data?.requestsOut.length ?? 0) > 0 && (
        <p className="mt-3 text-xs text-muted">
          Waiting on: {data!.requestsOut.map((r) => `@${r.handle}`).join(", ")}
        </p>
      )}

      {boostFor && (
        <BoostSheet friend={boostFor} onClose={() => setBoostFor(null)} />
      )}
    </Card>
  );
}

function BoostSheet({
  friend,
  onClose,
}: {
  friend: FriendRow;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");
  const [sent, setSent] = useState(false);

  async function send(message: string) {
    const res = await post("/api/social/boosts", {
      toUserId: friend.friendId,
      message,
    });
    if (res.ok) {
      capture("boost_sent");
      setSent(true);
      setTimeout(onClose, 1200);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-accent/40 bg-accent-soft/30 p-4 animate-fade-in">
      {sent ? (
        <p className="text-sm font-medium text-text">Sent. 💛</p>
      ) : (
        <>
          <p className="text-sm font-semibold text-text">
            Send {friend.name} a boost — private, just between you.
          </p>
          <div className="mt-2.5 flex flex-col gap-1.5">
            {BOOST_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => void send(m)}
                className="rounded-xl bg-surface px-3.5 py-2 text-left text-sm text-text transition-colors hover:text-accent"
              >
                {m}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value.slice(0, 200))}
              placeholder="or your own words…"
              className="min-w-0 flex-1 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => custom.trim() && void send(custom.trim())}
              disabled={!custom.trim()}
              className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-50"
            >
              Send
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 text-xs text-muted hover:text-text"
          >
            cancel
          </button>
        </>
      )}
    </div>
  );
}

function ChallengesCard({
  challenges,
  onChanged,
}: {
  challenges: Challenge[];
  onChanged: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return;
    const res = await post("/api/social/challenges", {
      name: name.trim(),
      target: 20,
      days: 7,
    });
    if (res.ok) {
      const body = (await res.json()) as { code: string };
      setMsg(`Created! Join code: ${body.code} — send it to your people.`);
      setName("");
      setCreating(false);
      capture("challenge_created");
      await onChanged();
    }
  }

  async function join() {
    if (!joinCode.trim()) return;
    const res = await post("/api/social/challenges", {
      code: joinCode.trim(),
    });
    if (res.ok) {
      setJoinCode("");
      setMsg("You're in. One tiny thing a day — together.");
      capture("challenge_joined");
      await onChanged();
    } else {
      setMsg("That code didn't match a live challenge.");
    }
  }

  return (
    <Card title="Group challenges">
      <p className="text-sm text-muted">
        One shared pot, everyone tips in. Never person-vs-person — the group
        total is the only number, and it only goes up. Add a photo of your tiny
        thing and it joins the group&apos;s wall.
      </p>

      <ul className="mt-3 flex flex-col gap-3">
        {challenges.map((c) => (
          <ChallengeItem key={c.id} c={c} onChanged={onChanged} />
        ))}
      </ul>

      {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}

      <div className="mt-3 flex flex-col gap-2">
        {creating ? (
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 80))}
              placeholder="e.g. 20 tiny things this week"
              autoFocus
              className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-text focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void create()}
              disabled={!name.trim()}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
            >
              Go
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text transition-colors hover:border-accent/50"
          >
            + Start a challenge (7 days, 20 tiny things)
          </button>
        )}
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.slice(0, 12))}
            placeholder="have a code? join here"
            className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-text focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void join()}
            disabled={!joinCode.trim()}
            className="rounded-full border border-accent/50 px-4 py-2 text-sm font-semibold text-accent disabled:opacity-50"
          >
            Join
          </button>
        </div>
      </div>
    </Card>
  );
}

function ChallengeItem({
  c,
  onChanged,
}: {
  c: Challenge;
  onChanged: () => Promise<void>;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const pct = Math.min(100, Math.round((c.done / c.target) * 100));

  async function tick() {
    if (busy) return;
    setBusy(true);
    try {
      await post("/api/social/challenges", {
        challengeId: c.id,
        photoBase64: photo ?? undefined,
        caption: caption.trim() || undefined,
      });
      setPhoto(null);
      setCaption("");
      capture("challenge_ticked", { photo: Boolean(photo) });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold text-text">{c.name}</p>
        <span className="text-xs text-muted">
          {c.ended
            ? "finished"
            : `${Math.max(1, Math.ceil((new Date(c.endsAt).getTime() - Date.now()) / 86400000))}d left`}
        </span>
      </div>
      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="grad-primary h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {c.done} of {c.target} tiny things, together · {c.members.join(", ")}
      </p>

      {/* The group's shared photo wall — moments, not metrics. */}
      {c.photos.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {c.photos.map((p, i) => (
            <div key={i} className="flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.caption ?? `A moment from ${p.who}`}
                title={p.caption ? `${p.caption} — ${p.who}` : p.who}
                loading="lazy"
                className="h-20 w-20 rounded-xl border border-border object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {!c.ended && (
        <div className="mt-3">
          {!c.tickedToday && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <PhotoAttach
                value={photo}
                onChange={setPhoto}
                label="Add a photo"
                compact
              />
              {photo && (
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 140))}
                  placeholder="a word about it (optional)"
                  className="min-w-0 flex-1 rounded-full border border-border bg-bg px-3.5 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
                />
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => void tick()}
            disabled={c.tickedToday && !photo}
            className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold ${
              c.tickedToday && !photo
                ? "bg-surface-2 text-muted"
                : "grad-primary shadow-soft"
            }`}
          >
            {c.tickedToday
              ? photo
                ? "Add my photo to the wall"
                : "✓ counted for today"
              : "I did my one tiny thing"}
          </button>
        </div>
      )}
      <p className="mt-1.5 text-center text-xs text-muted/70">code: {c.code}</p>
    </li>
  );
}

function BuddyCard({
  buddy,
  friends,
  onChanged,
}: {
  buddy: BuddyPayload | null;
  friends: FriendRow[];
  onChanged: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [respondTo, setRespondTo] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  if (!buddy) return null;

  if (!buddy.pair) {
    return (
      <Card title="Accountability buddy">
        <p className="text-sm text-muted">
          One person, one gentle daily check-in: “did my one thing”. No streaks,
          no guilt — a missed day just says nothing.
        </p>
        {friends.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Add a friend first.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {friends.map((f) => (
              <button
                key={f.friendId}
                type="button"
                onClick={async () => {
                  const res = await post("/api/social/buddy", {
                    friendId: f.friendId,
                  });
                  if (res.status === 409)
                    setNotice("One of you already has a buddy.");
                  else if (res.ok) {
                    capture("buddy_requested");
                    await onChanged();
                  }
                }}
                className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-text transition-colors hover:border-accent/50"
              >
                ask {f.name}
              </button>
            ))}
          </div>
        )}
        {notice && <p className="mt-2 text-sm text-muted">{notice}</p>}
      </Card>
    );
  }

  const { pair, checkins } = buddy;

  return (
    <Card title="Accountability buddy">
      {pair.status === "pending" ? (
        pair.awaitingMe ? (
          <div>
            <p className="text-sm text-text">
              <strong>{pair.buddyName}</strong> asked to be your buddy.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await post("/api/social/buddy", { action: "accept" });
                  await onChanged();
                }}
                className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink"
              >
                Yes, let&apos;s
              </button>
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/social/buddy", { method: "DELETE" });
                  await onChanged();
                }}
                className="rounded-full border border-border px-4 py-1.5 text-sm text-muted"
              >
                Not now
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Waiting for {pair.buddyName} to say yes. No rush.
          </p>
        )
      ) : (
        <div>
          <p className="text-sm text-muted">
            You +{" "}
            <span className="font-semibold text-text">{pair.buddyName}</span>.
            Today&apos;s check-in:
          </p>
          <div className="mt-2.5 flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 240))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && note.trim()) {
                  void (async () => {
                    const res = await post("/api/social/buddy", {
                      note: note.trim(),
                    });
                    const body = await res.json().catch(() => ({}));
                    if (body.crisis) setNotice(body.message as string);
                    else if (res.ok) {
                      setNote("");
                      capture("buddy_checkin");
                      await onChanged();
                    }
                  })();
                }
              }}
              placeholder="did my one thing: …"
              className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-text focus:border-accent focus:outline-none"
            />
          </div>
          {notice && (
            <p className="mt-2 rounded-2xl bg-accent-soft/50 p-3 text-sm text-text">
              {notice}
            </p>
          )}
          <ul className="mt-3 flex flex-col gap-2">
            {checkins.slice(0, 6).map((c) => (
              <li key={c.id} className="rounded-2xl bg-surface p-3 text-sm">
                <p className="text-text">
                  <span className="font-semibold">
                    {c.mine ? "you" : pair.buddyName}:
                  </span>{" "}
                  {c.note}
                </p>
                {c.response && (
                  <p className="mt-1 text-xs text-muted">↳ {c.response}</p>
                )}
                {!c.mine && !c.response && (
                  <div className="mt-1.5">
                    {respondTo === c.id ? (
                      <div className="flex gap-2">
                        <input
                          value={response}
                          onChange={(e) =>
                            setResponse(e.target.value.slice(0, 160))
                          }
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && response.trim()) {
                              void (async () => {
                                await post("/api/social/buddy", {
                                  checkinId: c.id,
                                  response: response.trim(),
                                });
                                setRespondTo(null);
                                setResponse("");
                                await onChanged();
                              })();
                            }
                          }}
                          placeholder="nice one! / proud of you"
                          className="min-w-0 flex-1 rounded-full border border-border bg-bg px-3 py-1 text-xs text-text focus:border-accent focus:outline-none"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRespondTo(c.id)}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        cheer back
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={async () => {
          await fetch("/api/social/buddy", { method: "DELETE" });
          await onChanged();
        }}
        className="mt-3 text-xs text-muted/80 transition-colors hover:text-accent"
      >
        unpair (silent)
      </button>
    </Card>
  );
}

function SettingsCard({
  profile,
  onProfileChange,
  onRefresh,
}: {
  profile: SocialProfileDto;
  onProfileChange: (patch: Record<string, unknown>) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [name, setName] = useState(profile.displayName ?? "");
  const [changingHandle, setChangingHandle] = useState(false);

  function Toggle({
    label,
    hint,
    value,
    onChange,
  }: {
    label: string;
    hint?: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }) {
    return (
      <label className="flex items-start justify-between gap-4 py-2">
        <span>
          <span className="block text-sm font-medium text-text">{label}</span>
          {hint && <span className="block text-xs text-muted">{hint}</span>}
        </span>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[rgb(var(--accent))]"
        />
      </label>
    );
  }

  return (
    <Card title="Social settings">
      {changingHandle ? (
        <div className="mb-4">
          <HandlePicker
            mode="change"
            onDone={() => {
              setChangingHandle(false);
              void onRefresh();
            }}
            onCancel={() => setChangingHandle(false)}
          />
        </div>
      ) : (
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-text">
              Your name here
            </span>
            <span className="block truncate text-sm text-accent">
              @{profile.handle}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setChangingHandle(true)}
            className="flex-shrink-0 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent/50 hover:text-text"
          >
            Change
          </button>
        </div>
      )}

      <label className="block text-sm font-medium text-muted">
        Display name (what friends see)
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 40))}
          placeholder={`@${profile.handle}`}
          className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-text focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void onProfileChange({ displayName: name.trim() })}
          className="rounded-full border border-accent/50 px-4 py-2 text-sm font-semibold text-accent"
        >
          Save
        </button>
      </div>

      <div className="mt-4 divide-y divide-border/50">
        <Toggle
          label="I'm 18 or over"
          hint="Needed before anything of yours can be public."
          value={profile.adultConfirmed}
          onChange={(v) => void onProfileChange({ adultConfirmed: v })}
        />
        <Toggle
          label="Allow direct messages"
          value={profile.allowDms}
          onChange={(v) => void onProfileChange({ allowDms: v })}
        />
        <Toggle
          label="Quiet the social layer"
          hint="Everything sleeps until you wake it. Nobody is told."
          value={profile.quiet}
          onChange={(v) => void onProfileChange({ quiet: v })}
        />
      </div>
      <p className="mt-3 text-xs text-muted/80">
        Read receipts are off for everyone. Reactions are faces, never counts.
        Leaving anything is always silent.
      </p>
    </Card>
  );
}
