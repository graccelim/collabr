-- ============================================================================
-- 046: Content classification. Stores creator-authored post metadata (used as
-- classification INPUT) and the resulting taxonomy labels. Classification is
-- cached by class_hash (a hash of the metadata only — never performance), so it
-- runs once per post and re-runs only when the metadata changes. `class_source`
-- = 'metadata' | 'ai' | 'manual' (manual overrides are preserved). Additive.
-- ============================================================================

alter table public.content_posts
  add column if not exists title             text,
  add column if not exists caption           text,
  add column if not exists hashtags          text[],
  add column if not exists subcategory       text,
  add column if not exists format            text,
  add column if not exists class_confidence  real,
  add column if not exists class_source      text,        -- metadata | ai | manual
  add column if not exists class_hash        text;        -- hash of classification input

create index if not exists idx_content_posts_class_hash on public.content_posts(class_hash);
