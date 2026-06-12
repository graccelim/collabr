// Minimal configurable Supabase client stub for route-handler tests.
//
// Results are queued PER TABLE and consumed in call order: each awaited query
// chain on a table shifts the next queued result. Both createClient() and
// createAdminClient() should be wired to the same stub so call order is
// deterministic regardless of which client the route uses.

export interface StubResult {
  data?: unknown
  error?: { code?: string; message?: string } | null
  count?: number | null
}

export interface StubConfig {
  user?: { id: string; email?: string; email_confirmed_at?: string | null } | null
  /** table → queue of results, consumed one per awaited chain */
  tables?: Record<string, StubResult[]>
  /** rpc name → result */
  rpcs?: Record<string, StubResult>
}

export interface StubCalls {
  rpc: { name: string; args: unknown }[]
  writes: { table: string; op: 'insert' | 'update' | 'delete'; payload?: unknown }[]
}

const CHAIN_METHODS = [
  'select', 'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'ilike', 'is',
  'not', 'or', 'order', 'limit', 'range', 'contains', 'filter',
  'single', 'maybeSingle',
] as const

export function makeSupabaseStub(config: StubConfig) {
  const calls: StubCalls = { rpc: [], writes: [] }
  const queues: Record<string, StubResult[]> = {}
  for (const [table, results] of Object.entries(config.tables || {})) {
    queues[table] = [...results]
  }

  function nextResult(table: string): StubResult {
    const queue = queues[table]
    if (queue && queue.length > 0) return queue.shift()!
    return { data: null, error: null, count: 0 }
  }

  function from(table: string) {
    const chain: Record<string, unknown> = {
      insert(payload: unknown) {
        calls.writes.push({ table, op: 'insert', payload })
        return chain
      },
      update(payload: unknown) {
        calls.writes.push({ table, op: 'update', payload })
        return chain
      },
      delete() {
        calls.writes.push({ table, op: 'delete' })
        return chain
      },
      then(resolve: (r: StubResult) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve(nextResult(table)).then(resolve, reject)
      },
    }
    for (const method of CHAIN_METHODS) {
      chain[method] = () => chain
    }
    return chain
  }

  const client = {
    auth: {
      getUser: async () => ({ data: { user: config.user ?? null }, error: null }),
    },
    from,
    rpc(name: string, args: unknown) {
      calls.rpc.push({ name, args })
      const result = config.rpcs?.[name] ?? { data: null, error: null }
      const promise = Promise.resolve(result) as Promise<StubResult> & {
        single: () => Promise<StubResult>
      }
      promise.single = () => Promise.resolve(result)
      return promise
    },
  }

  return { client, calls }
}

/** A verified, signed-in auth user. */
export function verifiedUser(id = 'user-1') {
  return { id, email: `${id}@test.dev`, email_confirmed_at: '2026-01-01T00:00:00Z' }
}

/** A signed-in auth user who has NOT confirmed their email. */
export function unverifiedUser(id = 'user-1') {
  return { id, email: `${id}@test.dev`, email_confirmed_at: null }
}

export function jsonRequest(method: string, body?: unknown) {
  return new Request('http://test.local/api/x', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as never
}
