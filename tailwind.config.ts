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
        /* Cool neutral matched to the redesign ink ramp */
        gray: {
          50:  '#FAFAFA',
          100: '#F2F2F4',
          200: '#E7E7EA',
          300: '#D2D3D7',
          400: '#8B8C94',
          500: '#6E6F77',
          600: '#57585F',
          700: '#43444B',
          800: '#26272E',
          900: '#131318',
        },
        /* Palette remap — existing `purple-*` / `teal-*` / `pink-*` utility
           usage resolves to the redesign language: deep professional blue
           accent; green strictly semantic (escrow / money). */
        purple: {
          50:  '#EAEDF8',
          100: '#D8DEF1',
          200: '#B6C2E6',
          300: '#8CA0D8',
          400: '#5F7BC9',
          500: '#3556BC',
          600: '#1E40AF',
          700: '#18347F',
          800: '#15307A',
          900: '#102357',
        },
        teal: {
          50:  '#E2F3ED',
          100: '#C7E8DD',
          200: '#9AD6C2',
          300: '#65BFA1',
          400: '#36A582',
          500: '#16966F',
          600: '#0E8A66',
          700: '#0A7355',
          800: '#07614A',
          900: '#054736',
        },
        pink: {
          50:  '#EAEDF8',
          100: '#D8DEF1',
          200: '#B6C2E6',
          300: '#8CA0D8',
          400: '#5F7BC9',
          500: '#3556BC',
          600: '#1E40AF',
          700: '#18347F',
          800: '#15307A',
          900: '#102357',
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
