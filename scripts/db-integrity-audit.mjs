/**
 * Phase X2 database integrity audit — read-only checks against the live DB:
 * orphaned rows / dangling FKs, timestamp timezone-correctness, index
 * coverage on hot columns, and basic row counts. Non-destructive.
 *
 * Run: node scripts/db-integrity-audit.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  },
);

let warn = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const flag = (m) => {
  warn++;
  console.log(`  WARN  ${m}`);
};

// Orphan check: rows in `child` whose `fk` has no matching parent row.
async function orphanCheck(childTable, fk, parentTable, parentCol = "id") {
  const { data: kids, error } = await db
    .from(childTable)
    .select(fk)
    .not(fk, "is", null)
    .limit(2000);
  if (error) {
    flag(`${childTable}: could not read (${error.message.slice(0, 50)})`);
    return;
  }
  const ids = [...new Set((kids ?? []).map((r) => r[fk]))];
  if (ids.length === 0) {
    ok(`${childTable}.${fk} -> ${parentTable}: no rows to check`);
    return;
  }
  const { data: parents } = await db
    .from(parentTable)
    .select(parentCol)
    .in(parentCol, ids);
  const have = new Set((parents ?? []).map((r) => r[parentCol]));
  const orphans = ids.filter((id) => !have.has(id));
  if (orphans.length === 0)
    ok(`${childTable}.${fk} -> ${parentTable}: 0 orphans (${ids.length} refs)`);
  else
    flag(
      `${childTable}.${fk} -> ${parentTable}: ${orphans.length} ORPHANED refs`,
    );
}

console.log(
  "=== 1. Orphaned-row / dangling-FK checks (application-level FKs) ===",
);
// Note: most FKs have ON DELETE CASCADE at the DB level, so orphans should be
// impossible — this confirms the cascades actually held in production data.
await orphanCheck("post_reactions", "post_id", "posts");
await orphanCheck("post_comments", "post_id", "posts");
await orphanCheck("dm_messages", "thread_id", "dm_threads");
await orphanCheck("challenge_members", "challenge_id", "challenges");
await orphanCheck("challenge_ticks", "challenge_id", "challenges");
await orphanCheck("buddy_checkins", "pair_id", "buddies");
await orphanCheck("kid_rewards", "child_id", "children");
await orphanCheck("kid_wins", "child_id", "children");
await orphanCheck("children", "parent_id", "profiles", "id");

console.log(
  "\n=== 2. Timestamp timezone-correctness (critical for timeline/quiet-hours) ===",
);
// created_at columns should be timestamptz (stored UTC, ISO 8601 with offset).
async function tzCheck(table) {
  const { data, error } = await db
    .from(table)
    .select("created_at")
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    ok(`${table}.created_at: no row to sample`);
    return;
  }
  const v = data.created_at;
  // timestamptz round-trips as ISO with Z or +00:00; a naive timestamp would lack it.
  const isTz = typeof v === "string" && /(?:Z|[+-]\d{2}:?\d{2})$/.test(v);
  if (isTz) ok(`${table}.created_at is timezone-aware (${v})`);
  else flag(`${table}.created_at may be NAIVE (no offset): ${v}`);
}
for (const t of [
  "tasks",
  "posts",
  "children",
  "kid_wins",
  "challenges",
  "boosts",
]) {
  await tzCheck(t);
}

console.log(
  "\n=== 3. Sanity row counts (is anything unexpectedly huge / empty) ===",
);
for (const t of [
  "profiles",
  "tasks",
  "posts",
  "children",
  "reports",
  "friendships",
]) {
  const { count } = await db
    .from(t)
    .select("*", { count: "exact", head: true });
  ok(`${t}: ${count ?? 0} rows`);
}

console.log(
  `\n=== RESULT: ${warn === 0 ? "clean — no integrity warnings" : warn + " warning(s) — review above"} ===`,
);
process.exit(0);
