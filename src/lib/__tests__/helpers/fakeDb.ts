/**
 * Minimal fake of the Supabase PostgREST query builder for route-handler
 * tests: chainable, thenable, and it RECORDS every call so tests can assert
 * exactly which filters were applied (the server-side-enforcement proofs).
 */

export interface FakeResult {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
  count?: number | null;
}

export class FakeQuery {
  calls: [string, unknown[]][] = [];
  private result: Required<FakeResult>;

  constructor(result: FakeResult = {}) {
    this.result = {
      data: result.data ?? null,
      error: result.error ?? null,
      count: result.count ?? null,
    };
  }

  has(method: string, ...args: unknown[]): boolean {
    return this.calls.some(
      ([m, a]) => m === method && JSON.stringify(a) === JSON.stringify(args),
    );
  }
  called(method: string): boolean {
    return this.calls.some(([m]) => m === method);
  }
  argOf(method: string): unknown[] | undefined {
    return this.calls.find(([m]) => m === method)?.[1];
  }

  private rec(m: string, a: unknown[]): this {
    this.calls.push([m, a]);
    return this;
  }

  select(...a: unknown[]) {
    return this.rec("select", a);
  }
  insert(...a: unknown[]) {
    return this.rec("insert", a);
  }
  update(...a: unknown[]) {
    return this.rec("update", a);
  }
  upsert(...a: unknown[]) {
    return this.rec("upsert", a);
  }
  delete(...a: unknown[]) {
    return this.rec("delete", a);
  }
  eq(...a: unknown[]) {
    return this.rec("eq", a);
  }
  neq(...a: unknown[]) {
    return this.rec("neq", a);
  }
  in(...a: unknown[]) {
    return this.rec("in", a);
  }
  not(...a: unknown[]) {
    return this.rec("not", a);
  }
  or(...a: unknown[]) {
    return this.rec("or", a);
  }
  like(...a: unknown[]) {
    return this.rec("like", a);
  }
  ilike(...a: unknown[]) {
    return this.rec("ilike", a);
  }
  contains(...a: unknown[]) {
    return this.rec("contains", a);
  }
  order(...a: unknown[]) {
    return this.rec("order", a);
  }
  limit(...a: unknown[]) {
    return this.rec("limit", a);
  }

  maybeSingle(): Promise<Required<FakeResult>> {
    this.rec("maybeSingle", []);
    return Promise.resolve(this.result);
  }
  single(): Promise<Required<FakeResult>> {
    this.rec("single", []);
    return Promise.resolve(this.result);
  }
  // PostgREST builders are thenable — `await query` resolves the result.
  then<T>(
    resolve: (v: Required<FakeResult>) => T,
    reject?: (e: unknown) => T,
  ): Promise<T> {
    return Promise.resolve(this.result).then(resolve, reject);
  }
}

/**
 * fakeDb: `from(table)` hands out queued FakeQuery objects per table, in
 * order. Tests construct with { posts: [q1, q2] } etc. and assert on the
 * recorded calls afterwards.
 */
export function fakeDb(queues: Record<string, FakeQuery | FakeQuery[]>) {
  const state: Record<string, FakeQuery[]> = {};
  for (const [table, q] of Object.entries(queues)) {
    state[table] = Array.isArray(q) ? [...q] : [q];
  }
  const fromCalls: string[] = [];
  return {
    fromCalls,
    from(table: string): FakeQuery {
      fromCalls.push(table);
      const queue = state[table];
      if (!queue || queue.length === 0) return new FakeQuery();
      return queue.length === 1 ? queue[0]! : queue.shift()!;
    },
  };
}
