import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { CRISIS_SIGNPOST, CHILD_SAFETY_SIGNPOST } from "@/lib/safety";
import { FakeQuery, fakeDb } from "./helpers/fakeDb";

/**
 * Z1 route tests — /api/social/posts with a MOCKED social context.
 * Proves the Y6 feed scopes are enforced by the QUERY the server builds (not
 * client filtering), and the POST gates: username-before-posting, Parents-Mode
 * gating, child-safety signposting, no photos in the parents space, and the
 * adult-confirmation downgrade for public posts.
 */

type Ctx = {
  db: ReturnType<typeof fakeDb>;
  userId: string;
  plan: "free" | "pro";
  parentsMode: boolean;
  profile: {
    handle: string;
    handle_key: string;
    handle_set: boolean;
    adult_confirmed: boolean;
  };
};

const h = vi.hoisted(() => ({
  ctx: null as unknown as Record<string, unknown>,
  friendIds: vi.fn(async (): Promise<string[]> => []),
  blockedSet: vi.fn(async (): Promise<Set<string>> => new Set<string>()),
  hydratePosts: vi.fn(async (_db: unknown, rows: unknown[]) => rows),
  uploadSocialPhoto: vi.fn(async () => "photos/x.jpg"),
}));

vi.mock("@/lib/socialServer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/socialServer")>();
  return {
    ...actual,
    getSocialContext: async () => h.ctx,
    friendIds: h.friendIds,
    blockedSet: h.blockedSet,
    hydratePosts: h.hydratePosts,
    uploadSocialPhoto: h.uploadSocialPhoto,
    checkSocialBurst: async () => true,
  };
});

import { GET, POST } from "@/app/api/social/posts/route";

function getReq(qs: string): NextRequest {
  return new NextRequest(`http://test.local/api/social/posts${qs}`);
}
function postReq(body: unknown): NextRequest {
  return new NextRequest("http://test.local/api/social/posts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makeCtx(
  over: Partial<Ctx> = {},
  postsQueue?: FakeQuery | FakeQuery[],
) {
  const db = fakeDb({ posts: postsQueue ?? new FakeQuery({ data: [] }) });
  h.ctx = {
    db,
    userId: "user-a",
    plan: "pro",
    parentsMode: false,
    profile: {
      handle: "sunny_otter",
      handle_key: "sunny_otter",
      handle_set: true,
      adult_confirmed: true,
    },
    ...over,
  } as Record<string, unknown>;
  return db;
}

beforeEach(() => {
  h.friendIds.mockReset().mockResolvedValue([]);
  h.blockedSet.mockReset().mockResolvedValue(new Set());
  h.hydratePosts.mockClear();
  h.uploadSocialPhoto.mockClear();
});

describe("GET /api/social/posts — scopes are enforced in the query", () => {
  it("just_me → filters to the caller's own rows only", async () => {
    const q = new FakeQuery({ data: [] });
    makeCtx({}, q);
    await GET(getReq("?scope=just_me"));
    expect(q.has("eq", "user_id", "user-a")).toBe(true);
    expect(q.has("eq", "visibility", "public")).toBe(false);
  });

  it("friends → only friends' rows at friends/public visibility", async () => {
    const q = new FakeQuery({ data: [] });
    makeCtx({}, q);
    h.friendIds.mockResolvedValue(["friend-1", "friend-2"]);
    await GET(getReq("?scope=friends"));
    expect(q.has("in", "user_id", ["friend-1", "friend-2"])).toBe(true);
    expect(q.has("in", "visibility", ["friends", "public"])).toBe(true);
    expect(q.has("eq", "user_id", "user-a")).toBe(false);
  });

  it("friends with zero friends → empty, calmly, without leaking a wider query", async () => {
    makeCtx();
    const body = await (await GET(getReq("?scope=friends"))).json();
    expect(body.posts).toEqual([]);
    expect(body.caughtUp).toBe(true);
  });

  it("public → visibility=public only, and blocked authors are removed", async () => {
    const rows = [
      { id: "p1", user_id: "friendly" },
      { id: "p2", user_id: "blocked-guy" },
    ];
    const q = new FakeQuery({ data: rows });
    makeCtx({}, q);
    h.blockedSet.mockResolvedValue(new Set(["blocked-guy"]));
    const body = await (await GET(getReq("?scope=public"))).json();
    expect(q.has("eq", "visibility", "public")).toBe(true);
    expect(body.posts).toHaveLength(1);
    expect((body.posts[0] as { id: string }).id).toBe("p1");
  });

  it("parents space without Parents Mode → empty (never an error leak)", async () => {
    makeCtx({ parentsMode: false });
    const body = await (
      await GET(getReq("?scope=public&space=parents"))
    ).json();
    expect(body.posts).toEqual([]);
  });

  it("every scope always filters flagged content and the requested space", async () => {
    const q = new FakeQuery({ data: [] });
    makeCtx({ parentsMode: true }, q);
    await GET(getReq("?scope=public&space=parents"));
    expect(q.has("eq", "space", "parents")).toBe(true);
    expect(q.has("eq", "flagged", false)).toBe(true);
  });
});

describe("POST /api/social/posts — gates", () => {
  it("free plan → 402 (server-side Pro gate)", async () => {
    makeCtx({ plan: "free" });
    expect((await POST(postReq({ winText: "did a thing" }))).status).toBe(402);
  });

  it("no chosen username → 409 handle_required", async () => {
    makeCtx({
      profile: {
        handle: "auto_gen",
        handle_key: "auto_gen",
        handle_set: false,
        adult_confirmed: true,
      },
    });
    const res = await POST(postReq({ winText: "did a thing" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("handle_required");
  });

  it("crisis text → Samaritans signpost, nothing stored", async () => {
    const db = makeCtx();
    const res = await POST(postReq({ winText: "I want to end my life" }));
    const body = await res.json();
    expect(body.crisis).toBe(true);
    expect(body.message).toBe(CRISIS_SIGNPOST);
    expect(db.fromCalls).toHaveLength(0);
  });

  it("parents space without Parents Mode → 403", async () => {
    makeCtx({ parentsMode: false });
    const res = await POST(
      postReq({ winText: "chart worked", space: "parents" }),
    );
    expect(res.status).toBe(403);
  });

  it("parents space + safeguarding text → child-safety signpost first", async () => {
    makeCtx({ parentsMode: true });
    const res = await POST(
      postReq({ winText: "I keep hitting my child", space: "parents" }),
    );
    const body = await res.json();
    expect(body.crisis).toBe(true);
    expect(body.message).toBe(CHILD_SAFETY_SIGNPOST);
  });

  it("parents space: photos are stripped server-side (child-safety hard rule)", async () => {
    const insertQ = new FakeQuery({ data: { id: "post-1" } });
    makeCtx({ parentsMode: true }, insertQ);
    const res = await POST(
      postReq({
        winText: "visual chart calmed our mornings",
        space: "parents",
        photoBase64: "x".repeat(32),
      }),
    );
    expect(res.status).toBe(200);
    expect(h.uploadSocialPhoto).not.toHaveBeenCalled();
    const row = insertQ.argOf("insert")?.[0] as Record<string, unknown>;
    expect(row.photo_path).toBeNull();
    expect(row.space).toBe("parents");
  });

  it("public visibility downgrades to friends until adulthood is confirmed", async () => {
    const insertQ = new FakeQuery({ data: { id: "post-2" } });
    makeCtx(
      {
        profile: {
          handle: "sunny_otter",
          handle_key: "sunny_otter",
          handle_set: true,
          adult_confirmed: false,
        },
      },
      insertQ,
    );
    const res = await POST(
      postReq({ winText: "shared a win", visibility: "public" }),
    );
    const body = await res.json();
    expect(body.visibility).toBe("friends");
    const row = insertQ.argOf("insert")?.[0] as Record<string, unknown>;
    expect(row.visibility).toBe("friends");
    expect(row.anon).toBe(false);
  });
});
