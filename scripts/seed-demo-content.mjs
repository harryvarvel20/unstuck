#!/usr/bin/env node
/**
 * Seed the Activity Center with demo content, for marketing screen recordings.
 *
 * ⚠️ READ THIS BEFORE RUNNING IT
 *
 * This writes real rows to whichever database SUPABASE_SERVICE_ROLE_KEY points
 * at. Every account it creates is prefixed `demo_` and every post is tagged
 * `demo-seed`, so `--teardown` can find and remove them precisely. Nothing
 * here touches a row it did not create.
 *
 * On honesty: sample data in a product demo is normal and fine. Implying an
 * active community that does not exist is not — the CPRs and the DMCC Act 2024
 * both bite on misleading consumer practices, which is the same law your
 * creator terms already lean on. Record what the FEATURE does. Do not narrate
 * these as real people, and take them down when you are finished:
 *
 *     node scripts/seed-demo-content.mjs            # create
 *     node scripts/seed-demo-content.mjs --teardown # remove every trace
 *
 * Photos are optional. Drop images into scripts/demo-photos/ and they are
 * uploaded to the social bucket and attached in order. Use images you own or
 * that are licensed for commercial use — these appear in published video.
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

/** Every seeded row carries this. It is how teardown stays surgical. */
const MARK = "demo-seed";
const PREFIX = "demo_";
const PHOTO_DIR = join(process.cwd(), "scripts", "demo-photos");
/** Must match migration 0017 — the bucket is `social-photos`, not `social`. */
const BUCKET = "social-photos";

/* ---------------------------------------------------------------------------
 * The people. Handles read like real ADHD-community usernames rather than
 * firstname1234 — that is most of what makes a seeded feed look plausible.
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
 * Specific detail is what makes a feed feel real — a named dread, a number of
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
  },
  {
    who: "demo_twoboysoneme",
    win: "He asked to do the calm corner. Didn't have to suggest it.",
    caption: "Six weeks of modelling it and something landed.",
    tags: ["calm-corner"],
  },
  {
    who: "demo_schoolrunsurv",
    win: "Homework took 20 minutes instead of two hours of tears.",
    caption: "Broke it into three tiny bits. He did the first one to prove it was stupid, then kept going.",
    tags: ["homework-helper"],
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
    win: "First–Then got shoes on in under a minute.",
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
  console.log("Removing demo content…\n");

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

function photoFiles() {
  if (!existsSync(PHOTO_DIR)) return [];
  return readdirSync(PHOTO_DIR)
    .filter((f) => [".jpg", ".jpeg", ".png", ".webp"].includes(extname(f).toLowerCase()))
    .sort();
}

async function seed() {
  const photos = photoFiles();
  console.log(
    photos.length
      ? `Found ${photos.length} photo(s) in scripts/demo-photos/\n`
      : "No photos found — seeding text-only posts.\n" +
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
  let photoIdx = 0;
  let n = 0;

  async function post(item, space) {
    const userId = ids.get(item.who);
    if (!userId) return;

    let photoPath = null;
    if (photoIdx < photos.length) {
      const file = photos[photoIdx++];
      const bytes = readFileSync(join(PHOTO_DIR, file));
      const path = `${userId}/${Date.now()}-${file}`;
      const { error } = await db.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: `image/${extname(file).slice(1)}` });
      if (!error) photoPath = path;
    }

    // Spread over the last ~10 days so the feed doesn't look bulk-inserted.
    const daysAgo = Math.random() * 10;
    const created = new Date(Date.now() - daysAgo * 86_400_000).toISOString();

    const { error } = await db.from("posts").insert({
      user_id: userId,
      win_text: item.win,
      caption: item.caption,
      tags: [...item.tags, MARK],
      visibility: "public",
      space,
      photo_path: photoPath,
      created_at: created,
    });
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
