-- 036: structured shipping details for BARTER collaborations.
--
-- Replaces creators pasting addresses into chat. One row per collab; the creator
-- fills it in after acceptance, the brand views it. Never on public profiles,
-- never visible before a collab exists (RLS scopes it to the two parties).
-- shipped_at / tracking_number / courier are future-ready (no tracking UI yet).
create table if not exists public.collab_shipping (
  collab_id       uuid primary key references public.collabs(id) on delete cascade,
  recipient_name  text not null,
  phone           text not null,
  address_line1   text not null,
  address_line2   text,
  postal_code     text not null,
  country         text not null,
  delivery_notes  text,
  submitted_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- future-ready (not surfaced yet)
  shipped_at      timestamptz,
  tracking_number text,
  courier         text
);

alter table public.collab_shipping enable row level security;

-- Both parties of the collab may READ. Writes go through the service-role route
-- (party-checked there), so no client write policy is granted.
drop policy if exists "shipping_party_read" on public.collab_shipping;
create policy "shipping_party_read" on public.collab_shipping for select
  using (
    collab_id in (
      select c.id from public.collabs c
      left join public.creator_profiles cp on cp.id = c.creator_id
      left join public.brand_profiles bp on bp.id = c.brand_id
      where cp.user_id = auth.uid() or bp.user_id = auth.uid()
    )
  );
