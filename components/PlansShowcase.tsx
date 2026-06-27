'use client';
import { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import PlansPanel from '@/components/PlansPanel';
import RosterPreview from '@/components/previews/RosterPreview';
import WhyList from '@/components/previews/WhyList';

// Brand Plus (Discovery) gate: state why it is worth it (ticking reasons), then
// show a live sample roster that mirrors the real product. CTA opens the modal.
const TEXTURE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)',
  backgroundSize: '26px 26px',
  WebkitMaskImage: 'radial-gradient(120% 120% at 100% 0,#000,transparent 70%)',
  maskImage: 'radial-gradient(120% 120% at 100% 0,#000,transparent 70%)',
};
const MONO = 'var(--font-mono, ui-monospace, monospace)';
const NUM = 'var(--font-money, system-ui, sans-serif)';
const REASONS = [
  'View a live roster of creators matched to your brand',
  'Filter by niche, platform, location and rate',
  'See who is available and who responds quickly',
  'Invite your closest matches directly',
];

export default function PlansShowcase({
  beta,
  heading,
  sub,
  label = 'Unlock Discovery',
}: {
  beta: boolean;
  heading: string;
  sub: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="gate-wrap"
      style={{
        maxWidth: 760,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}
    >
      {/* hero */}
      <div
        className="gate-hero"
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 20,
          padding: '34px 32px 30px',
          background:
            'linear-gradient(150deg,#05060E 0%,#10143A 58%,#05060E 100%)',
          boxShadow:
            '0 1px 3px rgba(14,16,22,.04),0 30px 60px -34px rgba(20,30,80,.45)',
        }}
      >
        <div style={TEXTURE} />
        <div
          style={{
            position: 'absolute',
            top: -70,
            right: -50,
            width: 250,
            height: 250,
            borderRadius: '50%',
            background:
              'radial-gradient(circle,rgba(123,115,240,.42),transparent 70%)',
            filter: 'blur(22px)',
          }}
        />
        <div style={{ position: 'relative', maxWidth: 580 }}>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10.5,
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: '#9D96F7',
            }}
          >
            Collabr Plus
          </span>
          <h1
            style={{
              fontFamily: NUM,
              margin: '12px 0 9px',
              fontSize: 'clamp(24px,3.4vw,31px)',
              fontWeight: 700,
              letterSpacing: '-.03em',
              lineHeight: 1.1,
              color: '#fff',
            }}
          >
            {heading}
          </h1>
          <p
            style={{
              margin: '0 0 22px',
              fontSize: 14.5,
              lineHeight: 1.55,
              color: '#9CA2D6',
            }}
          >
            {sub}
          </p>
          <button
            type="button"
            className="btn-sheen"
            onClick={() => setOpen(true)}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(.985)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = '';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = '';
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: 'none',
              cursor: 'pointer',
              background: '#fff',
              color: '#0A0C22',
              fontSize: 14.5,
              fontWeight: 600,
              padding: '13px 22px',
              borderRadius: 12,
              transition: 'transform .18s ease',
            }}
          >
            <Sparkles size={15} /> {label}
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              marginTop: 13,
              fontSize: 12.5,
              color: '#9CA2D6',
            }}
          >
            <Check size={13} color="#6FCFB2" /> Everything in Brand Pro is
            included. Cancel anytime.
          </div>
        </div>
      </div>

      {/* why it is worth it */}
      <WhyList reasons={REASONS} />

      {/* live sample roster (mirrors the real product) */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: '#8A909C',
            }}
          >
            Matched to your brand
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: '#B4B9C4',
              border: '1px solid rgba(20,30,80,.12)',
              padding: '3px 8px',
              borderRadius: 999,
            }}
          >
            Sample
          </span>
        </div>
        <RosterPreview />
      </div>

      {/* secondary CTA */}
      <div style={{ textAlign: 'center' }}>
        <button
          type="button"
          className="btn-sheen"
          onClick={() => setOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            border: 'none',
            cursor: 'pointer',
            background: '#0A0C22',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            padding: '12px 22px',
            borderRadius: 12,
          }}
        >
          <Sparkles size={14} /> {label}
        </button>
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(8,10,30,.55)',
            backdropFilter: 'blur(3px)',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              minHeight: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 16px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <PlansPanel beta={beta} onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
