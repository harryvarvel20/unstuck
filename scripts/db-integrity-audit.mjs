/**
 * Phase Z1 database integrity audit — read-only checks against the DB:
 * orphaned rows / dangling FKs, timestamp timezone-correctness, schema-drift
 * checks (dropped child tables really gone; Phase Y columns present), and
 * basic row counts. Non-destructive.
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
await orphanCheck("social_profiles", "user_id", "profiles", "id");

console.log(
  "\n=== 2. Zero-child-data invariant: dropped tables are really gone ===",
);
// Migration 0023 dropped these. If any still answers, the no-child-data
// guarantee is NOT true in this environment.
for (const t of ["children", "kid_rewards", "kid_wins"]) {
  const { error } = await db.from(t).select("*").limit(1);
  if (error) ok(`${t}: gone (${error.code ?? error.message.slice(0, 40)})`);
  else flag(`${t}: STILL EXISTS — migration 0023 not applied here`);
}

console.log("\n=== 3. Phase Y schema present (0021/0022 applied) ===");
{
  const { error: e1 } = await db
    .from("social_profiles")
    .select("handle_key, handle_set, handle_changed_at")
    .limit(1);
  if (e1)
    flag(`social_profiles Y1 columns missing: ${e1.message.slice(0, 60)}`);
  else ok("social_profiles has handle_key / handle_set / handle_changed_at");

  const { error: e2 } = await db
    .from("posts")
    .select("space, search_doc")
    .limit(1);
  if (e2) flag(`posts Y4/Y5 columns missing: ${e2.message.slice(0, 60)}`);
  else ok("posts has space / search_doc");

  const { error: e3 } = await db
    .from("handle_reservations")
    .select("handle_key")
    .limit(1);
  if (e3) flag(`handle_reservations missing: ${e3.message.slice(0, 60)}`);
  else ok("handle_reservations exists (service-role readable)");
}

console.log(
  "\n=== 4. Timestamp timezone-correctness (timeline/quiet-hours) ===",
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
for (const t of ["tasks", "posts", "challenges", "boosts", "social_profiles"]) {
  await tzCheck(t);
}

console.log(
  "\n=== 5. Sanity row counts (is anything unexpectedly huge / empty) ===",
);
for (const t of [
  "profiles",
  "tasks",
  "posts",
  "reports",
  "friendships",
  "social_profiles",
  "handle_reservations",
]) {
  const { count, error } = await db
    .from(t)
    .select("*", { count: "exact", head: true });
  if (error) flag(`${t}: could not count (${error.message.slice(0, 40)})`);
  else ok(`${t}: ${count ?? 0} rows`);
}

console.log(
  `\n=== RESULT: ${warn === 0 ? "clean — no integrity warnings" : warn + " warning(s) — review above"} ===`,
);
process.exit(warn === 0 ? 0 : 1);
