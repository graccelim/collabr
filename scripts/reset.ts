/**
 * One command to restart a staging environment from scratch:
 *
 *   npm run reset
 *
 *   1. Clears Storage (all objects, keeps buckets)         — via reset:storage
 *   2. Clears all auth users                               — Supabase Admin API
 *   3. Clears the database (keeps schema + niches taxonomy) — truncate over pg
 *   4. Reseeds the niches reference data                    — idempotent insert
 *   5. Verifies the database is empty                       — row counts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and a Postgres connection string in
 * SUPABASE_DB_URL (or DATABASE_URL). Get it from Supabase: Project Settings →
 * Database → Connection string (URI). Irreversible — intended for staging.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { execSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import ws from 'ws'
;(globalThis as any).WebSocket = (globalThis as any).WebSocket || ws

// Reference data + migration backups to preserve.
const KEEP = ['niches', 'niche_aliases']

function makeServiceClient(): SupabaseClient {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) { console.error('✗ SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local and retry.'); process.exit(1) }
  if (!rawUrl) { console.error('✗ NEXT_PUBLIC_SUPABASE_URL is missing. Add it to .env.local and retry.'); process.exit(1) }
  const url = new URL(rawUrl).origin
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function requireDbUrl(): string {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('✗ SUPABASE_DB_URL is missing.')
    console.error('  Add your Postgres connection string to .env.local:')
    console.error('    SUPABASE_DB_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres')
    console.error('  (Supabase Dashboard → Project Settings → Database → Connection string → URI)')
    process.exit(1)
  }
  return dbUrl
}

async function clearAuthUsers(supabase: SupabaseClient): Promise<number> {
  let removed = 0
  for (;;) {
    // Always read page 1: deletions shift the list, so re-list until empty.
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    const users = data?.users ?? []
    if (users.length === 0) break
    for (const u of users) {
      const { error: dErr } = await supabase.auth.admin.deleteUser(u.id)
      if (dErr) console.warn(`  ! could not delete user ${u.id}: ${dErr.message}`)
      else removed++
    }
    console.log(`  • deleted ${removed} user(s)…`)
  }
  return removed
}

async function clearAndReseedDb(dbUrl: string): Promise<void> {
  const pg = new Client({ connectionString: dbUrl })
  await pg.connect()
  try {
    const keepList = KEEP.map((t) => `'${t}'`).join(',')
    await pg.query(`
      do $$
      declare r record;
      begin
        for r in
          select tablename from pg_tables
          where schemaname = 'public'
            and tablename not in (${keepList})
            and tablename !~ '^_phase'
        loop
          execute format('truncate table public.%I restart identity cascade', r.tablename);
        end loop;
      end $$;

      insert into public.niches (slug, label, sort_order) values
        ('food','Food',1), ('lifestyle','Lifestyle',2), ('travel','Travel',3),
        ('fashion','Fashion',4), ('beauty','Beauty',5), ('fitness','Fitness',6),
        ('tech','Tech',7), ('parenting','Parenting',8), ('business','Business',9),
        ('gaming','Gaming',10), ('education','Education',11), ('other','Other',99)
      on conflict (slug) do nothing;
    `)
    console.log('  • database truncated, niches reseeded')

    // Verify: count every non-kept public table; report anything left behind.
    const { rows: tables } = await pg.query<{ tablename: string }>(`
      select tablename from pg_tables
      where schemaname = 'public' and tablename not in (${keepList}) and tablename !~ '^_phase'
      order by tablename
    `)
    const leftover: string[] = []
    for (const { tablename } of tables) {
      const { rows } = await pg.query<{ n: number }>(`select count(*)::int as n from public."${tablename}"`)
      if (rows[0].n > 0) leftover.push(`${tablename}=${rows[0].n}`)
    }
    if (leftover.length) console.warn(`  ! still has rows: ${leftover.join(', ')}`)
    else console.log(`  • verified empty (${tables.length} tables, 0 rows)`)
  } finally {
    await pg.end()
  }
}

async function main() {
  const dbUrl = requireDbUrl() // fail fast before touching anything
  const supabase = makeServiceClient()

  console.log('=== Collabr full reset (staging) ===\n')

  console.log('[1/3] Storage')
  execSync('npx tsx scripts/reset-storage.ts', { stdio: 'inherit' })

  console.log('\n[2/3] Auth users')
  const users = await clearAuthUsers(supabase)
  console.log(`  ✓ removed ${users} user(s)`)

  console.log('\n[3/3] Database (clear + reseed + verify)')
  await clearAndReseedDb(dbUrl)

  console.log('\n✓ Full reset complete. Clean slate ready.')
}

main().catch((e) => { console.error('\n✗ reset failed:', e?.message || e); process.exit(1) })
