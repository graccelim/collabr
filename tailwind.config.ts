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
        display: ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
        sans:    ['Hanken Grotesk', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        /* Map to CSS variables so tailwind utilities pick up the design tokens */
        paper:    'var(--paper)',
        surface:  'var(--surface)',
        ink:      'var(--ink)',
        accent:   'var(--accent)',
        border:   'var(--line)',
        /* Graphite neutral (zinc) — cool, replaces the warm gray */
        gray: {
          50:  '#FAFAFA',
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#27272A',
          900: '#18181B',
        },
        /* Palette remap — existing `purple-*` / `teal-*` / `pink-*` utility
           usage across screens resolves to the new design language without
           touching every page: indigo primary, emerald money, rose accent. */
        purple: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        teal: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        pink: {
          50:  '#FFF1F2',
          100: '#FFE4E6',
          200: '#FECDD3',
          300: '#FDA4AF',
          400: '#FB7185',
          500: '#F43F5E',
          600: '#E11D48',
          700: '#BE123C',
          800: '#9F1239',
          900: '#881337',
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
