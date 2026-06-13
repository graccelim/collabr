import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Geist', 'system-ui', 'sans-serif'],
        sans:    ['Geist', 'system-ui', '-apple-system', 'sans-serif'],
        mono:    ['Geist Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      colors: {
        /* Map to CSS variables so tailwind utilities pick up the design tokens */
        paper:    'var(--paper)',
        surface:  'var(--surface)',
        ink:      'var(--ink)',
        accent:   'var(--accent)',
        border:   'var(--line)',
        /* Cool neutral matched to the navy redesign ink ramp */
        gray: {
          50:  '#F6F7F9',
          100: '#EEF0F4',
          200: '#E1E4EA',
          300: '#CBD0D9',
          400: '#8A909C',
          500: '#6B7280',
          600: '#545A66',
          700: '#3D424C',
          800: '#23262F',
          900: '#0E1016',
        },
        /* Palette remap — existing `purple-*` / `teal-*` / `pink-*` utility
           usage resolves to the redesign language: deep navy accent; green
           strictly semantic (escrow / money). */
        purple: {
          50:  '#E6E7F0',
          100: '#C9CCDF',
          200: '#9DA1C2',
          300: '#6E73A0',
          400: '#454A82',
          500: '#22275E',
          600: '#000435',
          700: '#000228',
          800: '#00021F',
          900: '#000114',
        },
        teal: {
          50:  '#E2F1EA',
          100: '#C5E3D4',
          200: '#97CDB1',
          300: '#62B189',
          400: '#349A6A',
          500: '#1C8A5E',
          600: '#157A55',
          700: '#0F5A3E',
          800: '#0C4A33',
          900: '#073424',
        },
        pink: {
          50:  '#E6E7F0',
          100: '#C9CCDF',
          200: '#9DA1C2',
          300: '#6E73A0',
          400: '#454A82',
          500: '#22275E',
          600: '#000435',
          700: '#000228',
          800: '#00021F',
          900: '#000114',
        },
      },
      borderRadius: {
        DEFAULT: 'var(--radius-sm)',
        card:    'var(--radius)',
        pill:    'var(--radius-pill)',
        xl:      'var(--radius-lg)',
      },
      boxShadow: {
        sm:  'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        lg:  'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
}

export default config
