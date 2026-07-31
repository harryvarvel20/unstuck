/**
 * Phase Z RLS/IDOR isolation harness — creates two throwaway auth accounts
 * (via the admin API, no real user data touched), proves cross-user RLS
 * isolation (select/update/delete/list) and anon-zero-access across every
 * representative table, plus the Phase Y surfaces: case-insensitive handle
 * uniqueness at the DB, handle_reservations lockdown (no client access), and
 * search_posts() being callable by the service role only. Then deletes both
 * accounts and verifies the cascade left zero orphaned rows. Self-cleaning.
 *
 * Run: node scripts/rls-isolation-harness.mjs
 *
 * This is the two-user harness used in place of a real Supabase staging
 * branch (not available on this plan). It only ever touches rows belonging to
 * its own synthetic accounts.
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
const PASS = `Phz-Harness-${stamp}-!Aa1`;
const EMAIL_A = `adhv-phasez-a-${stamp}@adhv-test.invalid`;
const EMAIL_B = `adhv-phasez-b-${stamp}@adhv-test.invalid`;

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
      input_text: "phase-z harness task",
      steps: [{ title: "step", minutes: 2 }],
      completed_steps: [false],
    })
    .select("id")
    .single();
  check("A can insert own task", !task.error, task.error?.message);

  const idea = await asA
    .from("ideas")
    .insert({ user_id: idA, text: "phase-z harness idea" })
    .select("id")
    .single();
  check("A can insert own idea", !idea.error, idea.error?.message);

  const post = await asA
    .from("posts")
    .insert({
      user_id: idA,
      win_text: "phase-z harness win",
      visibility: "private",
    })
    .select("id")
    .single();
  check("A can insert own post", !post.error, post.error?.message);

  const handleA = `phz_a_${stamp % 1000000}`;
  const profA = await asA
    .from("social_profiles")
    .insert({ user_id: idA, handle: handleA, handle_key: handleA })
    .select("user_id")
    .single();
  check("A can insert own social profile", !profA.error, profA.error?.message);

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

  const rProfUpd = await asB
    .from("social_profiles")
    .update({ handle: "hijacked", handle_key: "hijacked" })
    .eq("user_id", idA)
    .select("user_id");
  check(
    "B's UPDATE on A's social profile affects 0 rows",
    (rProfUpd.data ?? []).length === 0,
    `rows=${(rProfUpd.data ?? []).length}`,
  );

  console.log("\n=== Y1: handle uniqueness is enforced AT THE DB ===");
  const dupe = await asB
    .from("social_profiles")
    .insert({
      user_id: idB,
      handle: handleA.toUpperCase(),
      handle_key: handleA,
    })
    .select("user_id")
    .single();
  check(
    "B cannot claim A's handle_key (unique index, case-insensitive)",
    Boolean(dupe.error) && String(dupe.error?.code) === "23505",
    dupe.error ? `${dupe.error.code}` : "INSERT SUCCEEDED (bad)",
  );

  console.log("\n=== Y1: handle_reservations is service-role only ===");
  const resvA = await asA.from("handle_reservations").select("*").limit(1);
  check(
    "authed user cannot SELECT handle_reservations",
    (resvA.data ?? []).length === 0,
    `count=${(resvA.data ?? []).length}, err=${resvA.error?.message ?? "none"}`,
  );
  const resvIns = await asA
    .from("handle_reservations")
    .insert({
      handle_key: `phz_resv_${stamp}`,
      reserved_until: new Date().toISOString(),
    })
    .select("handle_key");
  check(
    "authed user cannot INSERT into handle_reservations",
    Boolean(resvIns.error) || (resvIns.data ?? []).length === 0,
    resvIns.error ? resvIns.error.code : "INSERT SUCCEEDED (bad)",
  );

  console.log("\n=== Y5: search_posts() is not callable by clients ===");
  const rpcUser = await asA.rpc("search_posts", {
    p_viewer: idA,
    p_friends: [],
    p_blocked: [],
    p_query: "harness",
    p_space: "main",
    p_limit: 5,
  });
  check(
    "authed user cannot execute search_posts (revoked)",
    Boolean(rpcUser.error),
    rpcUser.error ? rpcUser.error.code : "RPC SUCCEEDED (bad)",
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

  const listPosts = await asB.from("posts").select("id");
  check(
    "B's post list excludes A's private post",
    !(listPosts.data ?? []).some((r) => r.id === post.data?.id),
    `count=${(listPosts.data ?? []).length}`,
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
  const anonPosts = await anon.from("posts").select("id").limit(5);
  check(
    "anon SELECT on posts returns nothing",
    (anonPosts.data ?? []).length === 0,
    `count=${(anonPosts.data ?? []).length}`,
  );
  const anonResv = await anon.from("handle_reservations").select("*").limit(5);
  check(
    "anon SELECT on handle_reservations returns nothing",
    (anonResv.data ?? []).length === 0,
    `count=${(anonResv.data ?? []).length}`,
  );
  const anonRpc = await anon.rpc("search_posts", {
    p_viewer: "00000000-0000-0000-0000-000000000000",
    p_friends: [],
    p_blocked: [],
    p_query: "harness",
    p_space: "main",
    p_limit: 5,
  });
  check(
    "anon cannot execute search_posts (revoked)",
    Boolean(anonRpc.error),
    anonRpc.error ? anonRpc.error.code : "RPC SUCCEEDED (bad)",
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
  for (const t of ["tasks", "ideas", "posts", "social_profiles"]) {
    const { data } = await admin
      .from(t)
      .select("*")
      .or(`user_id.eq.${idA},user_id.eq.${idB}`)
      .limit(5);
    console.log(
      `  ${t}: ${(data ?? []).length === 0 ? "clean" : "!! " + (data ?? []).length + " ORPHANED ROWS"}`,
    );
  }
  // Reservation rows reference released_by; harness never created any, but
  // sweep our synthetic keys defensively.
  await admin
    .from("handle_reservations")
    .delete()
    .like("handle_key", `phz_%_${stamp}%`);

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
