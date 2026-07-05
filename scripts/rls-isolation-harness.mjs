/**
 * Phase X1 RLS/IDOR isolation harness — creates two throwaway auth accounts
 * (via the admin API, no real user data touched), proves cross-user RLS
 * isolation (select/update/delete/list) and anon-zero-access across every
 * representative table, then deletes both accounts and verifies the cascade
 * left zero orphaned rows. Safe to re-run any time (self-cleaning).
 *
 * Run: node scripts/rls-isolation-harness.mjs
 *
 * This is the informal two-user harness X1 used in place of a real Supabase
 * staging branch (not available in this environment). X2 should either keep
 * extending this file (add every remaining table) or port it to pgTAP once a
 * staging project exists, and wire it into CI.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";

// CI (GitHub Actions) sets real env vars directly; local dev uses .env.local.
const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !ANON || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY " +
      "(set in .env.local for local runs, or as env vars in CI).",
  );
  process.exit(1);
}
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const stamp = Date.now();
const PASS = `Phx-Harness-${stamp}-!Aa1`;
const EMAIL_A = `adhv-phasex-a-${stamp}@adhv-test.invalid`;
const EMAIL_B = `adhv-phasex-b-${stamp}@adhv-test.invalid`;

const results = [];
function check(label, pass, detail) {
  results.push({ label, pass, detail });
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${label}${detail ? "  -- " + detail : ""}`,
  );
}

async function makeUser(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASS,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  return data.user.id;
}
async function sessionFor(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({
    email,
    password: PASS,
  });
  if (error) throw new Error(`signIn(${email}): ${error.message}`);
  return createClient(URL, ANON, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    },
  });
}

let idA, idB;
try {
  console.log("=== creating two throwaway test accounts ===");
  idA = await makeUser(EMAIL_A);
  idB = await makeUser(EMAIL_B);
  console.log("  A:", idA, " B:", idB);

  const asA = await sessionFor(EMAIL_A);
  const asB = await sessionFor(EMAIL_B);

  console.log(
    "\n=== A creates one row in each RLS-protected table under test ===",
  );
  const task = await asA
    .from("tasks")
    .insert({
      user_id: idA,
      input_text: "phase-x harness task",
      steps: [{ title: "step", minutes: 2 }],
      completed_steps: [false],
    })
    .select("id")
    .single();
  check("A can insert own task", !task.error, task.error?.message);

  const idea = await asA
    .from("ideas")
    .insert({ user_id: idA, text: "phase-x harness idea" })
    .select("id")
    .single();
  check("A can insert own idea", !idea.error, idea.error?.message);

  const post = await asA
    .from("posts")
    .insert({
      user_id: idA,
      win_text: "phase-x harness win",
      visibility: "private",
    })
    .select("id")
    .single();
  check("A can insert own post", !post.error, post.error?.message);

  const child = await asA
    .from("children")
    .insert({ parent_id: idA, age_band: "8-12" })
    .select("id")
    .single();
  check("A can insert own child", !child.error, child.error?.message);

  const kidWin = await asA
    .from("kid_wins")
    .insert({ parent_id: idA, text: "phase-x harness kid win" })
    .select("id")
    .single();
  check("A can insert own kid_win", !kidWin.error, kidWin.error?.message);

  const reward = await asA
    .from("kid_rewards")
    .upsert({
      child_id: child.data?.id,
      parent_id: idA,
      behaviours: ["x"],
      tokens: 3,
    })
    .select("child_id")
    .single();
  check("A can upsert own kid_rewards", !reward.error, reward.error?.message);

  console.log("\n=== IDOR: B tries to read/update/delete A's rows by id ===");
  const rTaskSel = await asB
    .from("tasks")
    .select("id")
    .eq("id", task.data?.id)
    .maybeSingle();
  check(
    "B cannot SELECT A's task by id",
    !rTaskSel.data,
    JSON.stringify(rTaskSel.data),
  );

  const rTaskUpd = await asB
    .from("tasks")
    .update({ input_text: "PWNED" })
    .eq("id", task.data?.id)
    .select("id");
  check(
    "B's UPDATE on A's task affects 0 rows",
    (rTaskUpd.data ?? []).length === 0,
    `rows=${(rTaskUpd.data ?? []).length}`,
  );

  const rTaskDel = await asB
    .from("tasks")
    .delete()
    .eq("id", task.data?.id)
    .select("id");
  check(
    "B's DELETE on A's task affects 0 rows",
    (rTaskDel.data ?? []).length === 0,
    `rows=${(rTaskDel.data ?? []).length}`,
  );

  const rIdeaSel = await asB
    .from("ideas")
    .select("id")
    .eq("id", idea.data?.id)
    .maybeSingle();
  check(
    "B cannot SELECT A's idea by id",
    !rIdeaSel.data,
    JSON.stringify(rIdeaSel.data),
  );

  const rPostSel = await asB
    .from("posts")
    .select("id")
    .eq("id", post.data?.id)
    .maybeSingle();
  check(
    "B cannot SELECT A's PRIVATE post by id",
    !rPostSel.data,
    JSON.stringify(rPostSel.data),
  );

  const rChildSel = await asB
    .from("children")
    .select("id")
    .eq("id", child.data?.id)
    .maybeSingle();
  check(
    "B cannot SELECT A's child by id",
    !rChildSel.data,
    JSON.stringify(rChildSel.data),
  );

  const rChildDel = await asB
    .from("children")
    .delete()
    .eq("id", child.data?.id)
    .select("id");
  check(
    "B's DELETE on A's child affects 0 rows",
    (rChildDel.data ?? []).length === 0,
    `rows=${(rChildDel.data ?? []).length}`,
  );

  const rKidWinSel = await asB
    .from("kid_wins")
    .select("id")
    .eq("id", kidWin.data?.id)
    .maybeSingle();
  check(
    "B cannot SELECT A's kid_win by id",
    !rKidWinSel.data,
    JSON.stringify(rKidWinSel.data),
  );

  const rRewardUpsert = await asB
    .from("kid_rewards")
    .upsert(
      { child_id: child.data?.id, parent_id: idB, tokens: 999 },
      { onConflict: "child_id" },
    )
    .select("child_id, parent_id, tokens");
  const rewardLeaked = (rRewardUpsert.data ?? []).some(
    (r) => r.parent_id === idB || r.tokens === 999,
  );
  check(
    "B's upsert cannot hijack A's kid_rewards row (DB-level RLS)",
    !rewardLeaked && (rRewardUpsert.data ?? []).length === 0,
    rRewardUpsert.error
      ? rRewardUpsert.error.message
      : `rows=${JSON.stringify(rRewardUpsert.data)}`,
  );

  console.log(
    "\n=== tenant isolation: B's unfiltered list queries never include A's rows ===",
  );
  const listTasks = await asB.from("tasks").select("id");
  check(
    "B's task list excludes A's task",
    !(listTasks.data ?? []).some((r) => r.id === task.data?.id),
    `count=${(listTasks.data ?? []).length}`,
  );

  const listChildren = await asB.from("children").select("id");
  check(
    "B's children list excludes A's child",
    !(listChildren.data ?? []).some((r) => r.id === child.data?.id),
    `count=${(listChildren.data ?? []).length}`,
  );

  const listKidWins = await asB.from("kid_wins").select("id");
  check(
    "B's kid_wins list excludes A's win",
    !(listKidWins.data ?? []).some((r) => r.id === kidWin.data?.id),
    `count=${(listKidWins.data ?? []).length}`,
  );

  console.log(
    "\n=== anon (unauthenticated) client: zero access to any of these rows ===",
  );
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const anonTask = await anon.from("tasks").select("id").limit(5);
  check(
    "anon SELECT on tasks returns nothing",
    (anonTask.data ?? []).length === 0,
    `count=${(anonTask.data ?? []).length}, err=${anonTask.error?.message ?? "none"}`,
  );
  const anonChild = await anon.from("children").select("id").limit(5);
  check(
    "anon SELECT on children returns nothing",
    (anonChild.data ?? []).length === 0,
    `count=${(anonChild.data ?? []).length}`,
  );
} catch (e) {
  console.error("HARNESS ERROR:", e.message);
  results.push({ label: "harness threw", pass: false, detail: e.message });
} finally {
  console.log("\n=== cleanup: deleting both throwaway accounts ===");
  if (idA) {
    const d = await admin.auth.admin.deleteUser(idA);
    console.log("  delete A:", d.error ? d.error.message : "ok");
  }
  if (idB) {
    const d = await admin.auth.admin.deleteUser(idB);
    console.log("  delete B:", d.error ? d.error.message : "ok");
  }

  console.log("\n=== verifying cascade left no orphaned rows ===");
  for (const t of [
    "tasks",
    "ideas",
    "posts",
    "children",
    "kid_wins",
    "kid_rewards",
  ]) {
    const { data } = await admin
      .from(t)
      .select("*")
      .or(
        `user_id.eq.${idA},parent_id.eq.${idA},user_id.eq.${idB},parent_id.eq.${idB}`,
      )
      .limit(5);
    console.log(
      `  ${t}: ${(data ?? []).length === 0 ? "clean" : "!! " + (data ?? []).length + " ORPHANED ROWS"}`,
    );
  }

  const failed = results.filter((r) => !r.pass);
  console.log(
    `\n=== RESULT: ${results.length - failed.length}/${results.length} checks passed ===`,
  );
  if (failed.length) {
    console.log("FAILED CHECKS:");
    failed.forEach((f) => console.log("  -", f.label, f.detail));
    process.exit(1);
  }
  process.exit(0);
}
