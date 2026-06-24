'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface FilterOption { value: string; label: string }

/**
 * A small custom dropdown that replaces the native <select> for filters/sorts.
 * Styled menu (hover rows + checkmark on the active option), click-outside /
 * Escape to close. Behaves like a select — same value/onChange contract.
 */
export default function FilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
  align = 'right',
  full = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: FilterOption[];
  ariaLabel: string;
  align?: 'left' | 'right';
  /** Stretch to fill its container (mobile rows). */
  full?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={ref} className="lw-select" style={{ position: 'relative', display: full ? 'block' : 'inline-block', width: full ? '100%' : undefined }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', height: 36, padding: '0 11px 0 13px', borderRadius: 10, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-body)', color: 'var(--ink)',
          background: 'var(--surface)', border: `1px solid ${open ? 'var(--ink-faint-solid)' : 'var(--line-strong)'}`,
          boxShadow: open ? '0 0 0 3px var(--accent-tint)' : 'var(--shadow-sm)',
          transition: 'border-color .14s ease, box-shadow .14s ease',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{current?.label}</span>
        <ChevronDown size={15} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0, transition: 'transform .15s ease', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', zIndex: 70,
            ...(align === 'right' ? { right: 0 } : { left: 0 }),
            minWidth: 'max(100%, 184px)',
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 12, boxShadow: 'var(--shadow-lg)', padding: 5,
            maxHeight: 300, overflowY: 'auto',
          }}
        >
          {options.map((o) => {
            const on = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 0,
                  cursor: 'pointer', fontSize: 13.5, fontWeight: on ? 600 : 500,
                  color: 'var(--ink)', background: on ? 'var(--surface-2)' : 'transparent',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { if (!on) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={(e) => { if (!on) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {o.label}
                {on && <Check size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
