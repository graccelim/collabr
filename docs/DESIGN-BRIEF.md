# JoinCollabr — Landing Page Design Brief

A complete brief for designing a JoinCollabr landing page. Everything below
(colors, fonts, shape, voice) is the real product design system — match it.

---

## 1. What the product is

**JoinCollabr is the safest, most reliable way for brands and creators to work
together.** It is a collaboration platform built around **trust, payment
protection, and structured workflows** — not a discovery/influencer marketplace.

In one line:
> Collaborations you can trust. Payment is held safely until the content is
> delivered and approved.

How it works (the protected flow, same on both sides):
1. **Brand funds the collab** — the agreed amount is set aside in escrow before any work begins.
2. **Creator does the work** — content is created and submitted for review.
3. **Brand reviews & approves** — drafts, feedback, and revisions happen in one workflow; nothing goes live until approved.
4. **Money is released** — once approved, the creator is paid automatically. If work is never delivered, the brand is refunded.

Two audiences:
- **Brands** — find the right creators (matched to niche + budget), see real reputation, keep funds protected, get dispute support.
- **Creators** — find matched campaigns, build a reputation that gets them re-hired, get paid securely, get dispute support.

---

## 2. Positioning & messaging

**Lead with:** trust · payment protection · reliability · transparency ·
structured workflows · removing collaboration chaos.

**The four USPs (core pillars):**

| Pillar | Promise | The risk it removes |
|---|---|---|
| **Protected payments** | Funds stay secure until the work is reviewed and approved. | No more chasing payments or wondering if work will be delivered. |
| **Structured approvals** | Drafts, feedback, revisions, and sign-off in one workflow. | No more endless DM revision threads or content going live before approval. |
| **Earned reputation** | Trust built from completed collaborations and genuine reviews. | No more guessing who's reliable from follower counts. |
| **Fair resolution** | A structured dispute process resolves issues fairly. | No more being left on your own when a deal goes sideways. |

**Supporting proof points (use as stats / guarantees):**
- 100% of funds protected — held until content is approved
- 48h review window — auto-approves if no response
- 3-day dispute resolution — platform mediates fairly
- Reviews & ratings only from completed collaborations

**Voice & tone:** human, specific, pain-point driven, confident, premium.
Reference founder-story tone of Stripe / Linear / Notion / Arc.

**Avoid these generic phrases entirely:** "connect brands and creators,"
"empower collaborations," "unlock opportunities," "streamline partnerships,"
"grow together," "built to fix what's broken," "revolutionizing influencer
marketing." Do **not** position it as another influencer marketplace.

**One sentence the visitor should remember:** *"Trust was missing."* (from the
founder story) — and that JoinCollabr is the safe, reliable way to collaborate.

---

## 3. Color tokens

> **Critical rule:** the palette is **cool neutrals + deep navy**. Green is
> **semantic only** — it represents secured money / escrow / paid, and nowhere
> else. Do not use green as a generic accent or decoration.

### Surfaces & neutrals
| Token | Hex | Use |
|---|---|---|
| `--app-bg` | `#F1F5FC` | App canvas (very light blue) so white cards lift |
| `--paper` | `#F6F7F9` | Page background |
| `--paper-2` | `#EEF0F4` | Subtle raised neutral |
| `--surface` | `#FFFFFF` | Cards / surfaces |
| `--surface-2` | `#F4F5F8` | Alternating section background |
| `--ink` | `#0E1016` | Primary text |
| `--ink-soft` | `#545A66` | Body / secondary text |
| `--ink-faint-solid` | `#8A909C` | Captions, eyebrow labels |
| `--line` | `rgba(14,16,22,0.08)` | Hairline borders |
| `--line-strong` | `rgba(14,16,22,0.18)` | Stronger borders / dividers |

### Brand / accent (deep navy — primary brand color)
| Token | Hex | Use |
|---|---|---|
| `--brand` / `--accent` | `#0A0C22` / `#000435` | Dark navy panels, primary buttons, accents |
| `--brand-deep` / `--accent-deep` | `#08091A` / `#000228` | Deepest navy |
| `--brand-tint` / `--accent-tint` | `#E6E7F0` | Tinted icon chips, soft fills |
| `--accent-on-dark` | `#9CA2D6` | Legible accent/eyebrow text on navy surfaces |

### Money / secured (SEMANTIC GREEN ONLY)
| Token | Hex | Use |
|---|---|---|
| `--money` / `--safe` | `#157A55` | Escrow / paid / secured actions & labels |
| `--money-deep` | `#0F5A3E` | Deep green text on tint |
| `--money-tint` | `#E2F1EA` | Light green panels (e.g. "secured" callouts) |

### Match / fit (bright violet — for "% match" pills only)
| Token | Hex |
|---|---|
| `--match` | `#5B53E0` |
| `--match-soft` | `#ECEBFC` |
| `--match-ink` | `#3F38B5` |

### Signal states
| Token | Hex | Meaning |
|---|---|---|
| `--pending` / `--warn` | `#B26A1E` (tint `#F7EAD7`) | Pending / warning |
| `--danger` | `#B23A33` (tint `#F5E2DF`) | Error / destructive |

---

## 4. Typography

Loaded via Google Fonts: **Geist**, **Geist Mono**, **Bricolage Grotesque**,
**Instrument Serif**.

| Token | Family | Role |
|---|---|---|
| `--font-display` / `--font-body` | **Geist** | Body text and most UI |
| `--font-grotesk` | **Bricolage Grotesque** | Hero & section headlines (`.display-face`) |
| `--font-mono` | **Geist Mono** | Eyebrow labels (uppercase, letterspaced) |
| `--font-serif` | **Instrument Serif** | Optional editorial / italic accents |
| `--font-money` | **Geist** (tabular figures) | Money amounts |

**Type scale used on the landing page:**
- Hero H1: `clamp(34px, 5.2vw, 58px)`, line-height ~1.04, letter-spacing `-0.035em`, Bricolage Grotesque
- Section H2: `clamp(27px, 3.2vw, 38px)`, line-height ~1.12, letter-spacing `-0.025em`
- Section subhead: `clamp(15px, 1.5vw, 17px)`, color `--ink-soft`, line-height 1.6, max-width ~540px
- Eyebrow label: 11px, Geist Mono, uppercase, letter-spacing `.14em`, color `--ink-faint-solid` (or `--accent-on-dark` on dark)
- Card title: ~17–18px, weight 700
- Body / card text: ~14.5px, color `--ink-soft`, line-height 1.5
- Base body: 14.5px

**Headings** are weight 600–800, tight letter-spacing (`-0.02em` to `-0.035em`).

---

## 5. Shape, elevation & spacing

| Token | Value |
|---|---|
| `--radius` | 14px (cards) |
| `--radius-sm` | 10px (buttons, chips) |
| `--radius-lg` | 20px |
| `--radius-pill` | 999px (badges/pills) |
| `--shadow-sm` | `0 1px 2px rgba(17,19,25,.04)` |
| `--shadow` | `0 1px 3px rgba(17,19,25,.05), 0 6px 16px -10px rgba(17,19,25,.10)` |
| `--shadow-lg` | `0 2px 6px rgba(26,24,28,.04), 0 16px 30px -18px rgba(26,24,28,.14)` |

- **Section vertical rhythm:** `clamp(60px, 8vw, 100px)` top/bottom — keep it consistent across every section.
- **Content width:** ~1040px max for grids; ~540–680px for centered text blocks.
- **Card padding:** ~24–28px. **Grid gaps:** ~16–20px.
- Alternate section backgrounds between `--paper`/white and `--surface-2`; use a `--brand` (navy) section as a visual anchor (e.g. the trust bar).

---

## 6. Component conventions

- **Primary button:** navy (`--accent`) fill, white text, radius-sm, subtle shadow, `translateY(-1px)` on hover.
- **Money/secured button:** green (`--money`) fill — only for payout/secured actions.
- **Secondary button:** white fill, `--line-strong` border.
- **Cards:** white surface, 1px `--line` border, `--radius`, soft shadow; optional `hover-lift`.
- **Eyebrow:** small uppercase mono label above section headings.
- **Badges/pills:** rounded-pill, tinted background + matching deep text (e.g. green tint pill for "funds protected").
- **Icons:** thin line icons, 1.5–2px stroke, `currentColor`, ~18px (Linear/Stripe style). No emoji.
- **Motion:** subtle scroll-reveal fade + rise; respect reduced-motion. Keep it restrained and premium, not flashy.

---

## 7. Suggested section flow

1. Sticky nav (wordmark `collabr.` + Log in + Join free)
2. Hero — headline, subhead, dual CTA ("I'm a brand" / "I'm a creator"), subtle navy glow background
3. Dual-sided split (For brands / For creators) — optional signature interaction
4. Why Collabr — 4 USP pillars (Without → With framing works well)
5. How it works — the protected 4-step flow, both sides
6. Payment protection — escrow flow spelled out (this earns trust)
7. Trust bar (navy section) — 3 pillars: Protected payments · Transparent reviews · Dispute support
8. Founder story — progressive, climaxing on "Trust was missing." → "So we built JoinCollabr."
9. Final CTA (navy gradient) — "Ready to collaborate with confidence?" + dual CTA
10. Footer

---

## 8. Do / Don't

**Do:** lead with trust & payment protection · keep green strictly for money/secured ·
use deep navy as the brand anchor · human + specific copy · generous but consistent spacing.

**Don't:** call it a marketplace · use green as decoration · use generic SaaS phrases ·
rely on follower-count language · over-animate.
