/**
 * Z2 addendum — "Try this myself" pipe: a viewer copying a playbook POSTs its
 * steps to /api/tasks and gets their own task. Proves the pipe server-side.
 * Self-cleaning. Run: node scripts/playbook-copy-check.mjs
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
const REF = new URL(URL_).hostname.split(".")[0];
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const PORT = 3112;
const BASE = `http://localhost:${PORT}`;
const stamp = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cookieFor(session) {
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

let server;
let uid;
let failed = false;
try {
  server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    shell: true,
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    try {
      if ((await fetch(`${BASE}/api/social/library`)).status < 500) break;
    } catch {
      /* booting */
    }
  }

  const email = `adhv-phz2-copy-${stamp}@adhv-test.invalid`;
  const pass = `Phz2c-${stamp}-!Aa1`;
  const { data: u, error } = await admin.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  uid = u.user.id;
  const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: s } = await anon.auth.signInWithPassword({
    email,
    password: pass,
  });

  // Exactly what TryButton sends when copying a playbook.
  const res = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: {
      cookie: cookieFor(s.session),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      input_text: "quokka playbook copy test",
      steps: [
        { title: "open the thing", minutes: 2 },
        { title: "one ugly draft", minutes: 10 },
      ],
    }),
  });
  const body = await res.json().catch(() => null);
  const okCreate = (res.status === 200 || res.status === 201) && body?.id;
  console.log(
    `${okCreate ? "PASS" : "FAIL"}  Try-this-myself: POST /api/tasks creates the copier's own task`,
  );
  if (!okCreate) {
    failed = true;
    console.log("  --", res.status, JSON.stringify(body));
  } else {
    const { data: row } = await admin
      .from("tasks")
      .select("user_id, steps")
      .eq("id", body.id)
      .maybeSingle();
    const okRow =
      row?.user_id === uid &&
      Array.isArray(row?.steps) &&
      row.steps.length === 2 &&
      row.steps[0].title === "open the thing";
    console.log(
      `${okRow ? "PASS" : "FAIL"}  copied steps land on the COPIER'S row, intact`,
    );
    if (!okRow) failed = true;
  }
} catch (e) {
  console.error("CHECK ERROR:", e.message);
  failed = true;
} finally {
  if (uid) {
    const d = await admin.auth.admin.deleteUser(uid);
    console.log("cleanup:", d.error ? d.error.message : "ok");
  }
  if (server) server.kill();
  process.exit(failed ? 1 : 0);
}
