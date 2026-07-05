import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * POST /api/account/delete — permanently delete the signed-in user and all
 * their data. Cascade deletes handle most rows (FKs to auth.users), but we
 * also clear them explicitly, then remove the auth user via admin.
 */
export async function POST(_req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const service = getServiceClient();
  if (!service) return json({ error: "unavailable" }, 503);

  const uid = user.id;

  // Explicit deletes (defence in depth alongside FK cascades).
  await Promise.allSettled([
    service.from("step_completions").delete().eq("user_id", uid),
    service.from("focus_sessions").delete().eq("user_id", uid),
    service.from("plans").delete().eq("user_id", uid),
    service.from("tasks").delete().eq("user_id", uid),
    service.from("usage_log").delete().eq("user_id", uid),
    service.from("profiles").delete().eq("id", uid),
  ]);

  // Remove any stored task photos under the user's folder.
  try {
    const { data: files } = await service.storage
      .from("task-photos")
      .list(uid, { limit: 1000 });
    if (files && files.length > 0) {
      await service.storage
        .from("task-photos")
        .remove(files.map((f) => `${uid}/${f.name}`));
    }
  } catch (err) {
    console.error("photo cleanup failed:", err);
  }

  // Remove the auth user (also cascades any remaining rows).
  const { error } = await service.auth.admin.deleteUser(uid);
  if (error) {
    console.error("account delete failed:", error.message);
    return json({ error: "delete_failed" }, 500);
  }

  // Clear the session cookie on the way out.
  await supabase.auth.signOut().catch(() => {});

  return json({ ok: true }, 200);
}
