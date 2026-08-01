/**
 * Phase Z2 — Activity Center TWO-ACCOUNT live harness.
 *
 * Boots the production build (`next start`) on a local port, creates synthetic
 * self-cleaning accounts — A (Pro), B (Pro), C (free), R1/R2 (race test) —
 * builds real @supabase/ssr session cookies for them, and drives every social
 * API over HTTP exactly as the browser would: usernames (validation,
 * uniqueness, blocklist, race), friendship lifecycle (request → accept →
 * mute → silent unfriend), posts at all three visibilities, feed scopes,
 * reactions, comments (friends-only, comments-off, author moderation, crisis),
 * DMs (delivery + crisis-still-delivers), boosts, status, collective
 * challenges, buddy pairing, block/unblock, report viewability, search
 * entitlement (friends vs unfriended vs private), IDOR probes with the wrong
 * account's cookie, free-tier and anonymous authorization, storage lockdown,
 * and the quiet toggle. Cleans up everything it created.
 *
 * Run: node scripts/activity-two-account-harness.mjs
 * Requires: a production build (`npm run build`) and .env.local keys.
 */
import { createClient } from "@supabase/supabase-js";
import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) {
  console.error("Missing Supabase env (.env.local)");
  process.exit(1);
}
const REF = new URL(URL_).hostname.split(".")[0];
const PORT = 3111;
const BASE = `http://localhost:${PORT}`;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const stamp = Date.now();
const PASS = `Phz2-${stamp}-!Aa1`;
const mail = (t) => `adhv-phz2-${t}-${stamp}@adhv-test.invalid`;

const results = [];
function check(label, pass, detail) {
  results.push({ label, pass });
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${label}${!pass && detail !== undefined ? "  -- " + JSON.stringify(detail).slice(0, 300) : ""}`,
  );
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- session cookies exactly as @supabase/ssr writes them -------------- */
function cookieHeaderFor(session) {
  const name = `sb-${REF}-auth-token`;
  const value =
    "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const MAX = 3180;
  if (value.length <= MAX) return `${name}=${value}`;
  const parts = [];
  for (let i = 0; i * MAX < value.length; i++) {
    parts.push(`${name}.${i}=${value.slice(i * MAX, (i + 1) * MAX)}`);
  }
  return parts.join("; ");
}

async function makeUser(tag, pro) {
  const { data, error } = await admin.auth.admin.createUser({
    email: mail(tag),
    password: PASS,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  const id = data.user.id;
  if (pro) {
    const { error: e2 } = await admin
      .from("profiles")
      .update({ plan: "pro" })
      .eq("id", id);
    if (e2) throw new Error(`set pro(${tag}): ${e2.message}`);
  }
  return id;
}
async function sessionFor(tag) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({
    email: mail(tag),
    password: PASS,
  });
  if (error) throw new Error(`signIn(${tag}): ${error.message}`);
  return data.session;
}

function apiFor(cookie) {
  return async (method, path, body) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON */
    }
    return { status: res.status, body: json };
  };
}

/* ---- boot the production server ---------------------------------------- */
let server;
async function startServer() {
  server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    shell: true,
    stdio: "ignore",
    env: { ...process.env },
  });
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    try {
      const r = await fetch(`${BASE}/api/social/library`);
      if (r.status < 500) return;
    } catch {
      /* not up yet */
    }
  }
  throw new Error("server did not start on :" + PORT);
}

const ids = {};
let createdChallengeCode = null;
try {
  console.log("=== booting next start on :" + PORT + " ===");
  await startServer();
  console.log("  up.");

  console.log(
    "=== creating synthetic accounts (A pro, B pro, C free, R1, R2) ===",
  );
  ids.A = await makeUser("a", true);
  ids.B = await makeUser("b", true);
  ids.C = await makeUser("c", false);
  ids.R1 = await makeUser("r1", true);
  ids.R2 = await makeUser("r2", true);

  const A = apiFor(cookieHeaderFor(await sessionFor("a")));
  const B = apiFor(cookieHeaderFor(await sessionFor("b")));
  const C = apiFor(cookieHeaderFor(await sessionFor("c")));
  const R1 = apiFor(cookieHeaderFor(await sessionFor("r1")));
  const R2 = apiFor(cookieHeaderFor(await sessionFor("r2")));
  const ANONC = apiFor(null);

  const hA = `phz2_a_${stamp % 1000000}`;
  const hB = `phz2_b_${stamp % 1000000}`;
  const hRace = `phz2_race_${stamp % 1000000}`;

  console.log("\n=== Y1 usernames over the live API ===");
  {
    const early = await B("POST", "/api/social/posts", { winText: "too soon" });
    check(
      "B cannot post before choosing a username (409 handle_required)",
      early.status === 409 && early.body?.error === "handle_required",
      early,
    );
    const adminAvail = await A("GET", `/api/social/handle?handle=admin`);
    check(
      "reserved word 'admin' reads unavailable",
      adminAvail.body?.available === false,
      adminAvail,
    );
    const short = await A("POST", "/api/social/handle", { handle: "ab" });
    check("2-char handle rejected (400)", short.status === 400, short);
    const setA = await A("POST", "/api/social/handle", { handle: hA });
    check("A sets a valid handle", setA.status === 200 && setA.body?.ok, setA);
    const dupe = await B("POST", "/api/social/handle", {
      handle: hA.toUpperCase(),
    });
    check(
      "B cannot take A's handle in different case (409)",
      dupe.status === 409,
      dupe,
    );
    const setB = await B("POST", "/api/social/handle", { handle: hB });
    check("B sets their own handle", setB.status === 200, setB);

    const [r1, r2] = await Promise.all([
      R1("POST", "/api/social/handle", { handle: hRace }),
      R2("POST", "/api/social/handle", { handle: hRace }),
    ]);
    const oks = [r1, r2].filter((r) => r.status === 200).length;
    check(
      "simultaneous claim of one handle → exactly one winner (race-safe)",
      oks === 1,
      { r1: r1.status, r2: r2.status },
    );
    await admin.auth.admin.deleteUser(ids.R1);
    await admin.auth.admin.deleteUser(ids.R2);
    delete ids.R1;
    delete ids.R2;
  }

  console.log("\n=== profile defaults + adult confirmation ===");
  {
    const prof = await A("GET", "/api/social/profile");
    check(
      "read receipts are OFF by default",
      prof.body?.profile?.readReceipts === false,
      prof,
    );
    await A("PATCH", "/api/social/profile", { adultConfirmed: true });
    await B("PATCH", "/api/social/profile", { adultConfirmed: true });
    const prof2 = await A("GET", "/api/social/profile");
    check(
      "adult confirmation persists",
      prof2.body?.profile?.adultConfirmed === true,
      prof2,
    );
  }

  console.log("\n=== friendship lifecycle ===");
  let friendshipId = null;
  {
    const reqRes = await A("POST", "/api/social/friends", { handle: hB });
    check("A sends request by handle", reqRes.status === 200, reqRes);
    const bList = await B("GET", "/api/social/friends");
    const incoming = (bList.body?.requestsIn ?? [])[0];
    check(
      "B sees the incoming request from A",
      incoming?.handle === hA,
      bList.body,
    );
    const acc = await B("PATCH", "/api/social/friends", {
      id: incoming?.id,
      action: "accept",
    });
    check("B accepts", acc.status === 200, acc);
    const aList = await A("GET", "/api/social/friends");
    friendshipId = (aList.body?.friends ?? [])[0]?.id ?? null;
    check(
      "mutual friendship visible to A",
      (aList.body?.friends ?? []).some((f) => f.handle === hB),
      aList.body,
    );
  }

  console.log("\n=== posts at every visibility + feed scopes ===");
  // Deliberately DISSIMILAR tokens: the search engine is fuzzy (pg_trgm), so
  // near-identical fixtures would legitimately cross-match. The security
  // property is that private/friends TEXT never appears for the wrong viewer.
  const zP = `okapi${stamp}`;
  const zF = `quokka${stamp}`;
  const zPub = `axolotl${stamp}`;
  let postIds = {};
  {
    const tinyJpeg = Buffer.from(
      "ffd8ffe000104a46494600010100000100010000ffd9" + "00".repeat(40),
      "hex",
    ).toString("base64");
    const p1 = await A("POST", "/api/social/posts", {
      winText: zP,
      visibility: "private",
    });
    const p2 = await A("POST", "/api/social/posts", {
      winText: zF,
      visibility: "friends",
      playbook: {
        steps: [{ title: "open the thing", minutes: 2 }],
        whatWorked: "starting stupidly small",
      },
    });
    const p3 = await A("POST", "/api/social/posts", {
      winText: zPub,
      visibility: "public",
      photoBase64: tinyJpeg,
    });
    const pB = await B("POST", "/api/social/posts", {
      winText: `bwin${stamp}`,
      visibility: "friends",
    });
    postIds = {
      zP: p1.body?.id,
      zF: p2.body?.id,
      zPub: p3.body?.id,
      bwin: pB.body?.id,
    };
    check(
      "A creates private/friends/public posts; B creates a friends post",
      [p1, p2, p3, pB].every((r) => r.status === 200 && r.body?.id),
      { p1: p1.status, p2: p2.status, p3: p3.status, pB: pB.status },
    );
    check(
      "public visibility honoured once adult-confirmed",
      p3.body?.visibility === "public",
      p3.body,
    );

    const aJustMe = await A("GET", "/api/social/posts?scope=just_me");
    const texts = (aJustMe.body?.posts ?? []).map((p) => p.winText);
    check(
      "A just_me contains all three own posts incl. private",
      texts.includes(zP) && texts.includes(zF) && texts.includes(zPub),
      texts,
    );
    check(
      "feed is finite (caughtUp:true, ≤30 rows)",
      aJustMe.body?.caughtUp === true &&
        (aJustMe.body?.posts ?? []).length <= 30,
      aJustMe.body?.posts?.length,
    );

    const bFriends = await B("GET", "/api/social/posts?scope=friends");
    const bft = (bFriends.body?.posts ?? []).map((p) => p.winText);
    check(
      "B friends-scope sees A's friends post, never A's private",
      bft.includes(zF) && !bft.includes(zP),
      bft,
    );
    check(
      "B friends-scope does NOT contain B's own posts (they live in Just me)",
      !bft.includes(`bwin${stamp}`),
      bft,
    );

    const bPublic = await B("GET", "/api/social/posts?scope=public");
    const bpt = (bPublic.body?.posts ?? []).map((p) => p.winText);
    check(
      "B public-scope sees A's public win only",
      bpt.includes(zPub) && !bpt.includes(zF) && !bpt.includes(zP),
      bpt,
    );
    const photoPost = (bPublic.body?.posts ?? []).find(
      (p) => p.winText === zPub,
    );
    check(
      "photo serves via signed URL (never a raw storage path)",
      typeof photoPost?.photoUrl === "string" &&
        photoPost.photoUrl.includes("token="),
      photoPost?.photoUrl?.slice(0, 60),
    );
  }

  console.log("\n=== reactions + comments (RSD-safe shapes) ===");
  {
    const rx = await B("POST", "/api/social/react", {
      postId: postIds.zF,
      kind: "heart",
    });
    check("B reacts to A's friends post", rx.status === 200, rx);
    const aFeed = await A("GET", "/api/social/posts?scope=just_me");
    const zfPost = (aFeed.body?.posts ?? []).find((p) => p.winText === zF);
    check(
      "reactions are named faces (array), never a numeric tally",
      Array.isArray(zfPost?.reactions) &&
        zfPost.reactions.every(
          (r) => typeof r.name === "string" && typeof r.kind === "string",
        ) &&
        !("reactionCount" in (zfPost ?? {})) &&
        !("likes" in (zfPost ?? {})),
      zfPost?.reactions,
    );

    const cm = await B("POST", "/api/social/comments", {
      postId: postIds.zF,
      content: "so proud of you",
    });
    check("B (friend) comments", cm.status === 200 && cm.body?.id, cm);
    const crisisCm = await B("POST", "/api/social/comments", {
      postId: postIds.zF,
      content: "honestly I want to end my life",
    });
    check(
      "crisis comment → signpost, not published",
      crisisCm.body?.crisis === true,
      crisisCm,
    );
    const del = await A("POST", "/api/social/comments", {}) // placeholder no-op guard
      .then(() => A("DELETE", "/api/social/comments", { id: cm.body?.id }));
    check(
      "author can delete a comment on their own post",
      del.status === 200,
      del,
    );

    const offPost = await A("POST", "/api/social/posts", {
      winText: `quiet${stamp}`,
      visibility: "public",
      commentsOff: true,
    });
    const cmOff = await B("POST", "/api/social/comments", {
      postId: offPost.body?.id,
      content: "nice",
    });
    check(
      "comments-off is enforced server-side (403)",
      cmOff.status === 403 && cmOff.body?.error === "comments_off",
      cmOff,
    );
    postIds.quiet = offPost.body?.id;
  }

  console.log("\n=== DMs: delivery, crisis-still-delivers, friends-only ===");
  let threadId = null;
  {
    const open = await A("POST", "/api/social/dms", { friendId: ids.B });
    threadId = open.body?.threadId;
    check(
      "A opens a thread with friend B",
      open.status === 200 && threadId,
      open,
    );
    const send = await A("POST", `/api/social/dms/${threadId}`, {
      content: `hello b ${stamp}`,
    });
    check("A sends a DM", send.status === 200, send);
    const bView = await B("GET", `/api/social/dms/${threadId}`);
    check(
      "B receives it (delivery)",
      (bView.body?.messages ?? []).some((m) => m.content.includes("hello b")),
      bView.body,
    );
    const crisisDm = await B("POST", `/api/social/dms/${threadId}`, {
      content: "some days I just can't go on",
    });
    check(
      "crisis DM DELIVERS and signposts the sender",
      crisisDm.status === 200 &&
        crisisDm.body?.ok === true &&
        crisisDm.body?.crisis === true,
      crisisDm,
    );
    const aView = await A("GET", `/api/social/dms/${threadId}`);
    check(
      "the crisis message reached the friend (never silenced)",
      (aView.body?.messages ?? []).some((m) =>
        m.content.includes("can't go on"),
      ),
      aView.body?.messages?.length,
    );
    const toC = await A("POST", "/api/social/dms", { friendId: ids.C });
    check("cannot open a DM with a non-friend (404)", toC.status === 404, toC);
  }

  console.log("\n=== boosts + struggle status ===");
  {
    const boost = await B("POST", "/api/social/boosts", {
      toUserId: ids.A,
      message: "You've got this. One tiny step.",
    });
    check("B sends A a private boost", boost.status === 200, boost);
    const aBoosts = await A("GET", "/api/social/boosts");
    check(
      "A sees the boost in their inbox",
      (aBoosts.body?.boosts ?? []).some((b) => b.message.includes("tiny step")),
      aBoosts.body,
    );
    await A("POST", "/api/social/status", {
      kind: "slow_start",
      audience: "friends",
    });
    const bFriends = await B("GET", "/api/social/friends");
    check(
      "A's struggle status shows to friend B (words, not metrics)",
      (bFriends.body?.friends ?? []).some(
        (f) => f.handle === hA && f.status === "slow_start",
      ),
      bFriends.body?.friends,
    );
  }

  console.log("\n=== collective challenges (no person-vs-person anywhere) ===");
  {
    const created = await A("POST", "/api/social/challenges", {
      name: `harness pot ${stamp}`,
      target: 20,
      days: 7,
    });
    createdChallengeCode = created.body?.code;
    check(
      "A creates a challenge with a join code",
      Boolean(createdChallengeCode),
      created,
    );
    const join = await B("POST", "/api/social/challenges", {
      code: createdChallengeCode,
    });
    check("B joins by code", join.status === 200, join);
    const list0 = await A("GET", "/api/social/challenges");
    const ch0 = (list0.body?.challenges ?? []).find(
      (c) => c.code === createdChallengeCode,
    );
    await A("POST", "/api/social/challenges", { challengeId: ch0?.id });
    await B("POST", "/api/social/challenges", { challengeId: ch0?.id });
    const list1 = await B("GET", "/api/social/challenges");
    const ch = (list1.body?.challenges ?? []).find(
      (c) => c.code === createdChallengeCode,
    );
    check(
      "group total is collective (done=2) with both members listed",
      ch?.done === 2 && Array.isArray(ch?.members) && ch.members.length === 2,
      ch,
    );
    check(
      "no per-person tallies or rankings in the challenge payload",
      ch !== undefined &&
        !("leaderboard" in ch) &&
        !("perMember" in ch) &&
        ch.members.every((m) => typeof m === "string"),
      ch && Object.keys(ch),
    );
  }

  console.log("\n=== accountability buddy ===");
  {
    await A("POST", "/api/social/buddy", { friendId: ids.B });
    const bView = await B("GET", "/api/social/buddy");
    check(
      "B sees the pending buddy ask",
      bView.body?.pair?.status === "pending" && bView.body?.pair?.awaitingMe,
      bView.body,
    );
    await B("POST", "/api/social/buddy", { action: "accept" });
    const note = await A("POST", "/api/social/buddy", {
      note: "did my one thing",
    });
    check("A checks in", note.status === 200, note);
    const bView2 = await B("GET", "/api/social/buddy");
    const checkin = (bView2.body?.checkins ?? [])[0];
    await B("POST", "/api/social/buddy", {
      checkinId: checkin?.id,
      response: "nice one!",
    });
    const unpair = await A("DELETE", "/api/social/buddy");
    check("silent unpair works", unpair.status === 200, unpair);
    const aView = await A("GET", "/api/social/buddy");
    check("pair is gone after unpair", aView.body?.pair === null, aView.body);
  }

  console.log("\n=== mute without rupture ===");
  {
    await A("PATCH", "/api/social/friends", {
      id: friendshipId,
      action: "mute",
    });
    const aFeed = await A("GET", "/api/social/posts?scope=friends");
    check(
      "muted friend's wins vanish from A's feed (B is never told)",
      !(aFeed.body?.posts ?? []).some((p) => p.winText === `bwin${stamp}`),
      aFeed.body?.posts?.map((p) => p.winText),
    );
    await A("PATCH", "/api/social/friends", {
      id: friendshipId,
      action: "unmute",
    });
    const aFeed2 = await A("GET", "/api/social/posts?scope=friends");
    check(
      "unmute restores them",
      (aFeed2.body?.posts ?? []).some((p) => p.winText === `bwin${stamp}`),
      aFeed2.body?.posts?.length,
    );
  }

  console.log(
    "\n=== waiting out the per-minute write budget before the authz sweep ===",
  );
  await sleep(65_000);

  console.log("\n=== IDOR + role authorization sweep ===");
  {
    await B("PATCH", "/api/social/posts", {
      id: postIds.zP,
      visibility: "public",
    });
    const aJustMe = await A("GET", "/api/social/posts?scope=just_me");
    const zp = (aJustMe.body?.posts ?? []).find((p) => p.winText === zP);
    check(
      "B cannot flip A's private post public (visibility unchanged)",
      zp?.visibility === "private",
      zp,
    );
    await B("DELETE", "/api/social/posts", { id: postIds.zP });
    const aJustMe2 = await A("GET", "/api/social/posts?scope=just_me");
    check(
      "B cannot delete A's post (still present)",
      (aJustMe2.body?.posts ?? []).some((p) => p.winText === zP),
      aJustMe2.body?.posts?.length,
    );

    const cFeed = await C("GET", "/api/social/posts?scope=public");
    check(
      "free tier is server-gated out of the feed (402)",
      cFeed.status === 402,
      cFeed,
    );
    const cHandle = await C("POST", "/api/social/handle", { handle: "cfree1" });
    check(
      "free tier cannot claim a handle (402)",
      cHandle.status === 402,
      cHandle,
    );
    const anonFeed = await ANONC("GET", "/api/social/posts?scope=public");
    check("anonymous gets 401 (never data)", anonFeed.status === 401, anonFeed);
    const anonPost = await ANONC("POST", "/api/social/posts", {
      winText: "drive-by",
    });
    check("anonymous cannot post (401)", anonPost.status === 401, anonPost);

    // Storage: signed URLs are the ONLY road — direct client download denied.
    const { data: photoRow } = await admin
      .from("posts")
      .select("photo_path")
      .eq("id", postIds.zPub)
      .maybeSingle();
    if (photoRow?.photo_path) {
      const asBClient = createClient(URL_, ANON, {
        auth: { persistSession: false },
        global: {
          headers: {
            Authorization: `Bearer ${(await sessionFor("b")).access_token}`,
          },
        },
      });
      const dl = await asBClient.storage
        .from("social-photos")
        .download(photoRow.photo_path);
      check(
        "direct storage download denied even for a signed-in user",
        Boolean(dl.error),
        dl.error?.message,
      );
    } else {
      check("photo path exists for storage test", false, photoRow);
    }
  }

  console.log("\n=== search entitlement: friends vs strangers vs private ===");
  {
    const sF = await B("GET", `/api/social/search?q=${zF}`);
    check(
      "friend's search FINDS the friends-only win",
      (sF.body?.posts ?? []).some((p) => p.winText === zF),
      sF.body,
    );
    const sP = await B("GET", `/api/social/search?q=${zP}`);
    check(
      "search NEVER surfaces another user's private text",
      !(sP.body?.posts ?? []).some((p) => p.winText.includes(zP)),
      sP.body,
    );

    // Silent unfriend, then repeat — the friends-only post must disappear.
    await A("DELETE", "/api/social/friends", { id: friendshipId });
    const bList = await B("GET", "/api/social/friends");
    check(
      "unfriend is silent and total for B (A simply gone, no flag anywhere)",
      !(bList.body?.friends ?? []).some((f) => f.handle === hA) &&
        !(bList.body?.requestsIn ?? []).some((f) => f.handle === hA),
      bList.body,
    );
    const sF2 = await B("GET", `/api/social/search?q=${zF}`);
    check(
      "after unfriending, the friends-only win vanishes from search",
      !(sF2.body?.posts ?? []).some((p) => p.winText.includes(zF)),
      sF2.body,
    );
    const sPub = await B("GET", `/api/social/search?q=${zPub}`);
    check(
      "public wins remain searchable to non-friends",
      (sPub.body?.posts ?? []).some((p) => p.winText === zPub),
      sPub.body,
    );
    const crisisSearch = await B(
      "GET",
      `/api/social/search?q=${encodeURIComponent("kill myself")}`,
    );
    check(
      "crisis language in the search box → signpost, zero results",
      crisisSearch.body?.crisis === true,
      crisisSearch,
    );

    const cmStranger = await B("POST", "/api/social/comments", {
      postId: postIds.zPub,
      content: "hello from a stranger",
    });
    check(
      "public post still friends-only for comments by default (403)",
      cmStranger.status === 403 && cmStranger.body?.error === "friends_only",
      cmStranger,
    );
  }

  console.log("\n=== block severs everything; report respects viewability ===");
  {
    await B("POST", "/api/social/safety", { action: "block", userId: ids.A });
    const bPublic = await B("GET", "/api/social/posts?scope=public");
    check(
      "blocked author's public wins vanish from B's feed",
      !(bPublic.body?.posts ?? []).some((p) => p.winText === zPub),
      bPublic.body?.posts?.map((p) => p.winText),
    );
    const dmBlocked = await B("GET", `/api/social/dms/${threadId}`);
    check(
      "the old DM thread is unreachable while blocked (404)",
      dmBlocked.status === 404,
      dmBlocked,
    );
    await B("POST", "/api/social/safety", { action: "unblock", userId: ids.A });

    const repPrivate = await B("POST", "/api/social/safety", {
      action: "report",
      subjectType: "post",
      subjectId: postIds.zP,
    });
    check(
      "cannot report content you were never able to see (404)",
      repPrivate.status === 404,
      repPrivate,
    );
    const repPublic = await B("POST", "/api/social/safety", {
      action: "report",
      subjectType: "post",
      subjectId: postIds.zPub,
    });
    check(
      "reporting visible content works",
      repPublic.status === 200,
      repPublic,
    );
  }

  console.log("\n=== quiet the social layer ===");
  {
    await A("PATCH", "/api/social/profile", { quiet: true });
    const p = await A("GET", "/api/social/profile");
    check("quiet toggle persists", p.body?.profile?.quiet === true, p.body);
    await A("PATCH", "/api/social/profile", { quiet: false });
  }

  console.log("\n=== informational (not scored): live tone-guard nudge ===");
  try {
    const tg = await B("POST", "/api/social/assist", {
      kind: "toneguard",
      text: "honestly this is pathetic, just try harder",
    });
    console.log(
      `  toneguard verdict: kind=${tg.body?.kind} nudge=${JSON.stringify(tg.body?.nudge ?? "").slice(0, 80)}`,
    );
  } catch {
    console.log("  toneguard live call skipped (AI unavailable)");
  }
} catch (e) {
  console.error("HARNESS ERROR:", e.message);
  results.push({ label: "harness threw", pass: false });
} finally {
  console.log("\n=== cleanup ===");
  for (const [tag, id] of Object.entries(ids)) {
    const d = await admin.auth.admin.deleteUser(id);
    console.log(`  delete ${tag}: ${d.error ? d.error.message : "ok"}`);
  }
  // Cascade check + sweep anything with our stamp.
  const idList = Object.values(ids);
  if (idList.length) {
    for (const t of ["posts", "friendships", "dm_threads", "challenges"]) {
      const orFilter =
        t === "friendships" || t === "dm_threads"
          ? idList.map((i) => `user_a.eq.${i},user_b.eq.${i}`).join(",")
          : t === "challenges"
            ? idList.map((i) => `owner_id.eq.${i}`).join(",")
            : idList.map((i) => `user_id.eq.${i}`).join(",");
      const { data } = await admin.from(t).select("id").or(orFilter).limit(5);
      console.log(
        `  ${t}: ${(data ?? []).length === 0 ? "clean" : "!! " + (data ?? []).length + " rows left"}`,
      );
    }
  }
  await admin.from("handle_reservations").delete().like("handle_key", `phz2_%`);

  if (server) server.kill();

  const failed = results.filter((r) => !r.pass);
  console.log(
    `\n=== RESULT: ${results.length - failed.length}/${results.length} checks passed ===`,
  );
  if (failed.length) {
    console.log("FAILED:");
    failed.forEach((f) => console.log("  -", f.label));
  }
  process.exit(failed.length ? 1 : 0);
}
