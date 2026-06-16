# collabr.

Creator-brand marketplace for Singapore. Connects content creators directly with brands - no agency needed.

## Stack
- Next.js 14 (App Router)
- Supabase (Postgres, Auth, Storage)
- Stripe (escrow payments, Apple Pay, Google Pay)
- Resend (email)
- Tailwind CSS
- Vercel (deployment)

## Setup

1. Clone: `git clone https://github.com/graccelim/collabr`
2. Install: `npm install`
3. Copy env: `cp .env.example .env.local` and fill in values
4. Run migrations: paste `supabase/migrations/001_initial_schema.sql` into Supabase SQL Editor
5. Dev: `npm run dev`

## Environment variables
See `.env.example` for all required variables.

## Database
Run `supabase/migrations/001_initial_schema.sql` in your Supabase project SQL Editor.

## Deployment
Connect repo to Vercel. Add all environment variables. Deploy.

## Build phases
- Phase 0: Infrastructure ✅ (this commit)
- Phase 1: Auth + profiles ✅
- Phase 2: Campaigns + discovery ✅
- Phase 3: Applications ✅
- Phase 4: Collab workflow ✅
- Phase 5: Stripe payments (pending - add STRIPE keys)
- Phase 6: Disputes + reviews (partial)
- Phase 7: Boosts + subscriptions (pending)
- Phase 8: Analytics + polish (pending)

## Contact
hello@collabr.sg | collabr.sg
