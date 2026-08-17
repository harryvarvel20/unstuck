#!/usr/bin/env node
/**
 * Seed the Activity Center with demo content, for marketing screen recordings.
 *
 * âš ï¸ READ THIS BEFORE RUNNING IT
 *
 * This writes real rows to whichever database SUPABASE_SERVICE_ROLE_KEY points
 * at. Every account it creates is prefixed `demo_` and every post is tagged
 * `demo-seed`, so `--teardown` can find and remove them precisely. Nothing
 * here touches a row it did not create.
 *
 * On honesty: sample data in a product demo is normal and fine. Implying an
 * active community that does not exist is not â€” the CPRs and the DMCC Act 2024
 * both bite on misleading consumer practices, which is the same law your
 * creator terms already lean on. Record what the FEATURE does. Do not narrate
 * these as real people, and take them down when you are finished:
 *
 *     node scripts/seed-demo-content.mjs            # create
 *     node scripts/seed-demo-content.mjs --teardown # remove every trace
 *
 * Photos are optional. Drop images into scripts/demo-photos/ and they are
 * uploaded to the social bucket and attached in order. Use images you own or
 * that are licensed for commercial use â€” these appear in published video.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run with them loaded from .env.local.",
  );
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });
const TEARDOWN = process.argv.includes("--teardown");

/**
 * Retry a Supabase call a few times with backoff.
 *
 * A seeding run makes ~30 rapid uploads and inserts, and a handful reliably
 * die with a bare `TypeError: fetch failed` — a dropped connection, not a
 * rejection. Without this the run half-succeeds and you are left comparing
 * console output against the database to work out what is missing, which is
 * exactly the wrong job to be doing an hour before filming.
 */
async function withRetry(label, fn, attempts = 4) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fn();
      if (!res?.error) return res;
      if (i === attempts) return res;
    } catch (err) {
      if (i === attempts) {
        console.log(`  ! ${label}: ${err.message}`);
        return { error: err };
      }
    }
    await new Promise((r) => setTimeout(r, 400 * i));
  }
  return { error: new Error("unreachable") };
}

/** Every seeded row carries this. It is how teardown stays surgical. */
const MARK = "demo-seed";
const PREFIX = "demo_";
const PHOTO_DIR = join(process.cwd(), "scripts", "demo-photos");
/** Must match migration 0017 â€” the bucket is `social-photos`, not `social`. */
const BUCKET = "social-photos";

/* ---------------------------------------------------------------------------
 * The people. Handles read like real ADHD-community usernames rather than
 * firstname1234 â€” that is most of what makes a seeded feed look plausible.
 * ------------------------------------------------------------------------ */
const PEOPLE = [
  { handle: "demo_ferngoeswest", name: "Fern", parents: false },
  { handle: "demo_halfdonehal", name: "Hal", parents: false },
  { handle: "demo_quietkettle", name: "Niamh", parents: false },
  { handle: "demo_ninetythings", name: "Sami", parents: false },
  { handle: "demo_mossandmugs", name: "Rea", parents: false },
  { handle: "demo_latebloomingj", name: "Jo", parents: true },
  { handle: "demo_twoboysoneme", name: "Priya", parents: true },
  { handle: "demo_schoolrunsurv", name: "Danny", parents: true },
];

/* ---------------------------------------------------------------------------
 * The posts. Written in ADHV's voice: small, specific, unglamorous, no
 * triumphalism. "I did the thing I'd been avoiding" beats "CRUSHED MY GOALS".
 * Specific detail is what makes a feed feel real â€” a named dread, a number of
 * weeks, a mug.
 * ------------------------------------------------------------------------ */
const MAIN_POSTS = [
  {
    who: "demo_ferngoeswest",
    win: "Opened the letter. Didn't even read it. Just opened it.",
    caption: "Three weeks it sat on the side. Turns out it was a dentist reminder.",
    tags: ["admin", "dread-pile"],
  },
  {
    who: "demo_halfdonehal",
    win: "Washed one mug. Ended up doing the whole sink.",
    caption: "The one-mug thing works annoyingly well.",
    tags: ["kitchen"],
  },
  {
    who: "demo_quietkettle",
    win: "Booked the GP appointment I've rescheduled in my head 40 times.",
    caption: "Phone anxiety is real. Breaking it into 'find the number' first helped.",
    tags: ["health", "phone-calls"],
  },
  {
    who: "demo_ninetythings",
    win: "Wrote 200 words. Wanted 2000. Still counting it.",
    caption: null,
    tags: ["work"],
  },
  {
    who: "demo_mossandmugs",
    win: "Put the laundry AWAY. Not on the chair. Away.",
    caption: "The chair is empty for the first time since March.",
    tags: ["home", "the-chair"],
  },
  {
    who: "demo_halfdonehal",
    win: "Replied to a message from November.",
    caption: "They were completely normal about it, obviously.",
    tags: ["rsd"],
  },
  {
    who: "demo_ferngoeswest",
    win: "Sat down to do 10 minutes of tax stuff. Did 35.",
    caption: "Started the timer expecting to bail. Didn't.",
    tags: ["admin", "focus"],
  },
  {
    who: "demo_quietkettle",
    win: "Had a shower on a day I really did not want to.",
    caption: null,
    tags: ["bad-day"],
  },
  {
    who: "demo_ninetythings",
    win: "Cancelled a thing instead of silently not going.",
    caption: "Weirdly harder than going. Did it anyway.",
    tags: ["boundaries"],
  },
  {
    who: "demo_mossandmugs",
    win: "Made the bed. That's the whole post.",
    caption: null,
    tags: ["small"],
  },
  {
    who: "demo_ferngoeswest",
    win: "Cooked instead of ordering. Beans on toast counts.",
    caption: "It absolutely counts.",
    tags: ["food"],
    photo: "food",
  },
  {
    who: "demo_ninetythings",
    win: "Went for the run I've been putting off for two weeks.",
    caption: "Got as far as putting trainers on and decided that was enough. Then went anyway.",
    tags: ["movement"],
    photo: "running",
  },
  {
    who: "demo_quietkettle",
    win: "Got to the gym. Didn't train hard. Went.",
    caption: "Turning up was the whole goal.",
    tags: ["movement"],
    photo: "gym",
  },
  {
    who: "demo_mossandmugs",
    win: "Walked up the hill instead of doomscrolling on the sofa.",
    caption: null,
    tags: ["outside"],
    photo: "mountain",
  },
  {
    who: "demo_halfdonehal",
    win: "Twenty minutes outside. First time this week.",
    caption: "Didn't take headphones. Weirdly that was the hard bit.",
    tags: ["outside"],
    photo: "woods",
  },
  {
    who: "demo_halfdonehal",
    win: "Deleted 4,000 emails. Kept 12.",
    caption: "Inbox zero by way of scorched earth.",
    tags: ["admin"],
  },
];

const PARENTS_POSTS = [
  {
    who: "demo_latebloomingj",
    win: "Got through the morning without raising my voice once.",
    caption: "Used the visual routine. She checked the steps off herself.",
    tags: ["visual-routine"],
    photo: "breakfast",
  },
  {
    who: "demo_schoolrunsurv",
    win: "Homework took 20 minutes instead of two hours of tears.",
    caption: "Broke it into three tiny bits. He did the first one to prove it was stupid, then kept going.",
    tags: ["homework-helper"],
    photo: "homework",
  },
  {
    who: "demo_twoboysoneme",
    win: "Shoes on and out the door in under a minute.",
    caption: "First shoes, then the podcast in the car. That's the whole trick and I feel daft for not trying it sooner.",
    tags: ["first-then"],
    photo: "shoes",
  },
  {
    who: "demo_twoboysoneme",
    win: "We tidied the front room together. Sort of.",
    caption: "Set a timer for six minutes and made it a race. Got about 80% of it. I'll take 80%.",
    tags: ["visual-routine"],
    photo: "lego",
  },
  {
    who: "demo_latebloomingj",
    win: "Baked with her instead of putting a screen on.",
    caption: "She measured, I did the oven. Forty minutes and nobody cried, including me.",
    tags: ["together"],
    photo: "baking",
  },
  {
    who: "demo_twoboysoneme",
    win: "He asked to do the calm corner. Didn't have to suggest it.",
    caption: "Six weeks of modelling it and something landed.",
    tags: ["calm-corner"],
  },
  {
    who: "demo_latebloomingj",
    win: "Caught her being brilliant four times today and said so.",
    caption: "Counting them is the only way I remember to.",
    tags: ["praise"],
  },
  {
    who: "demo_twoboysoneme",
    win: "Meltdown lasted 4 minutes, not 40.",
    caption: "I stopped trying to reason with him and just sat down next to him.",
    tags: ["meltdown"],
  },
  {
    who: "demo_schoolrunsurv",
    win: "Emailed the SENCO. Actually sent it this time.",
    caption: "Used a template. Removed three apologies from it before hitting send.",
    tags: ["school"],
  },
  {
    who: "demo_latebloomingj",
    win: "Firstâ€“Then got shoes on in under a minute.",
    caption: "First shoes, then the podcast in the car. That's it. That's the whole trick.",
    tags: ["first-then"],
  },
];

/* ------------------------------------------------------------------------ */

async function findDemoUsers() {
  const { data } = await db.auth.admin.listUsers({ perPage: 200 });
  return (data?.users ?? []).filter((u) => u.email?.startsWith(PREFIX));
}

async function teardown() {
  console.log("Removing demo contentâ€¦\n");

  const { data: posts } = await db
    .from("posts")
    .select("id, photo_path")
    .contains("tags", [MARK]);

  const paths = (posts ?? []).map((p) => p.photo_path).filter(Boolean);
  if (paths.length) {
    await db.storage.from(BUCKET).remove(paths);
    console.log(`  photos removed:   ${paths.length}`);
  }

  const { count } = await db
    .from("posts")
    .delete({ count: "exact" })
    .contains("tags", [MARK]);
  console.log(`  posts removed:    ${count ?? 0}`);

  const users = await findDemoUsers();
  for (const u of users) await db.auth.admin.deleteUser(u.id);
  console.log(`  accounts removed: ${users.length}`);

  console.log("\nDone. Every seeded row is gone.");
}

/**
 * Match a post's `photo` keyword to a file in scripts/demo-photos/.
 *
 * Deliberately keyword-matched, NOT attached in filename order. Order-based
 * attachment put a mountain on a post about opening a letter â€” fine in a
 * database, obviously wrong the moment it is on camera. A post only gets an
 * image if it asked for one by name.
 */
function photoIndex() {
  if (!existsSync(PHOTO_DIR)) return new Map();
  const files = readdirSync(PHOTO_DIR).filter((f) =>
    [".jpg", ".jpeg", ".png", ".webp"].includes(extname(f).toLowerCase()),
  );
  const map = new Map();
  for (const f of files) {
    const lower = f.toLowerCase();
    // Skip Windows' "- Copy" duplicates so the same shot doesn't appear twice.
    if (lower.includes("- copy")) continue;
    const keys = [
      // main-space wins
      "food",
      "running",
      "gym",
      "mountain",
      "woods",
      // parents-space wins
      "homework",
      "lego",
      "shoes",
      "breakfast",
      "baking",
    ];
    for (const key of keys) {
      if (lower.includes(key) && !map.has(key)) map.set(key, f);
    }
  }
  return map;
}

async function seed() {
  const photos = photoIndex();
  console.log(
    photos.size
      ? `Matched ${photos.size} photo(s): ${[...photos.keys()].join(", ")}\n`
      : "No photos found â€” seeding text-only posts.\n" +
          "  (drop images into scripts/demo-photos/ to attach them)\n",
  );

  // --- accounts ---
  const ids = new Map();
  for (const p of PEOPLE) {
    const email = `${p.handle}@example.invalid`; // reserved TLD: can never receive mail
    const { data, error } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { demo: true },
    });
    if (error) {
      console.log(`  ! ${p.handle}: ${error.message}`);
      continue;
    }
    const id = data.user.id;
    ids.set(p.handle, id);

    // Pro, because the Activity Center is Pro-gated.
    await db
      .from("profiles")
      .upsert({ id, plan: "pro", parents_mode: p.parents });

    await db.from("social_profiles").upsert({
      user_id: id,
      handle: p.handle,
      handle_key: p.handle.toLowerCase(),
      handle_set: true,
      display_name: p.name,
      adult_confirmed: true, // required for `public` visibility
      onboarded: true,
      default_visibility: "public",
    });
    console.log(`  + ${p.handle}`);
  }

  // --- posts ---

  let n = 0;

  async function post(item, space) {
    const userId = ids.get(item.who);
    if (!userId) return;

    let photoPath = null;
    const file = item.photo ? photos.get(item.photo) : null;
    if (file) {
      const bytes = readFileSync(join(PHOTO_DIR, file));
      // Spaces in object keys need encoding downstream; strip them here.
      const safe = file.replace(/[^a-zA-Z0-9.-]+/g, "-").toLowerCase();
      const path = `${userId}/${Date.now()}-${safe}`;
      const ext = extname(file).slice(1).toLowerCase();
      const { error } = await withRetry(`photo ${file}`, () =>
        db.storage.from(BUCKET).upload(path, bytes, {
          contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
        }),
      );
      if (error) console.log(`  ! photo ${file}: ${error.message}`);
      else photoPath = path;
    }

    // Spread over the last ~10 days so the feed doesn't look bulk-inserted.
    const daysAgo = Math.random() * 10;
    const created = new Date(Date.now() - daysAgo * 86_400_000).toISOString();

    const { error } = await withRetry(`post "${item.win.slice(0, 32)}…"`, () =>
      db.from("posts").insert({
        user_id: userId,
        win_text: item.win,
        caption: item.caption,
        tags: [...item.tags, MARK],
        visibility: "public",
        space,
        photo_path: photoPath,
        created_at: created,
      }),
    );
    if (error) console.log(`  ! post failed: ${error.message}`);
    else n++;
  }

  for (const item of MAIN_POSTS) await post(item, "main");
  for (const item of PARENTS_POSTS) await post(item, "parents");

  console.log(`\n  ${n} posts created (${MAIN_POSTS.length} main, ${PARENTS_POSTS.length} parents)`);
  console.log(`\nEvery post is tagged "${MARK}".`);
  console.log("When you've finished recording:");
  console.log("  node scripts/seed-demo-content.mjs --teardown");
}

await (TEARDOWN ? teardown() : seed());
