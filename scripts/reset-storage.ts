/**
 * One-time maintenance script: empty every Supabase Storage bucket via the
 * Storage API (never SQL — direct deletion of storage tables is blocked).
 *
 *   npm run reset:storage
 *
 * - Uses the service role key (SUPABASE_SERVICE_ROLE_KEY).
 * - Enumerates every bucket, recursively deletes every object at any folder depth.
 * - Keeps the bucket definitions themselves.
 * - Idempotent (running again on an empty project is a no-op).
 * - Exits with an error if the service role key is missing.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config() // .env fallback
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'
// supabase-js constructs a Realtime client that needs WebSocket; Node < 22 has none.
;(globalThis as any).WebSocket = (globalThis as any).WebSocket || ws

function makeServiceClient(): SupabaseClient {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) { console.error('✗ SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local and retry.'); process.exit(1) }
  if (!rawUrl) { console.error('✗ NEXT_PUBLIC_SUPABASE_URL is missing. Add it to .env.local and retry.'); process.exit(1) }
  // Normalize to the bare project origin (tolerates a trailing slash or /rest/v1).
  const url = new URL(rawUrl).origin
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// List every file path under a bucket, recursing into folders. In the Storage
// API, folders are returned as entries with `id === null`; files have an id.
async function listAllFiles(supabase: SupabaseClient, bucket: string, prefix = ''): Promise<string[]> {
  const files: string[] = []
  const PAGE = 100
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`)
    if (!data || data.length === 0) break
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id === null) {
        files.push(...(await listAllFiles(supabase, bucket, path))) // folder → recurse
      } else {
        files.push(path)
      }
    }
    if (data.length < PAGE) break
    offset += PAGE
  }
  return files
}

async function emptyBucket(supabase: SupabaseClient, bucket: string): Promise<number> {
  const files = await listAllFiles(supabase, bucket)
  if (files.length === 0) { console.log(`  • ${bucket}: already empty`); return 0 }
  let removed = 0
  const BATCH = 100
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH)
    const { error } = await supabase.storage.from(bucket).remove(batch)
    if (error) throw new Error(`remove from ${bucket}: ${error.message}`)
    removed += batch.length
    console.log(`  • ${bucket}: deleted ${removed}/${files.length}`)
  }
  return removed
}

export async function emptyAllBuckets(supabase: SupabaseClient): Promise<number> {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) throw new Error(`listBuckets: ${error.message}`)
  if (!buckets || buckets.length === 0) { console.log('No buckets found. Nothing to do.'); return 0 }
  console.log(`Found ${buckets.length} bucket(s): ${buckets.map((b) => b.name).join(', ')}`)
  let total = 0
  for (const b of buckets) {
    console.log(`\nBucket: ${b.name}`)
    total += await emptyBucket(supabase, b.name)
  }
  return total
}

async function main() {
  console.log('Resetting Storage (deleting all objects, keeping buckets)…\n')
  const supabase = makeServiceClient()
  const total = await emptyAllBuckets(supabase)
  console.log(`\n✓ Storage reset complete. Deleted ${total} object(s). Buckets kept.`)
}

main().catch((e) => { console.error('\n✗ reset:storage failed:', e?.message || e); process.exit(1) })
