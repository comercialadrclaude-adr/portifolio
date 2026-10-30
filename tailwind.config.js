/** @type {import('tailwindcss').Config} */
const token = (name) => `var(--${name})`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    // Cores somente via tokens (src/styles/tokens.css)
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      bg: token('bg'),
      surface: token('surface'),
      'surface-2': token('surface-2'),
      border: token('border'),
      text: token('text'),
      muted: token('text-muted'),
      brand: token('brand'),
      'on-brand': token('on-brand'),
      existing: token('net-existing'),
      extension: token('net-extension'),
      improvement: token('net-improvement'),
      project: token('project'),
      zeis: token('zeis'),
      sidebar: token('sidebar-bg'),
      'sidebar-text': token('sidebar-text'),
      'sidebar-muted': token('sidebar-muted'),
      'sidebar-hover': token('sidebar-hover'),
      'sidebar-active': token('sidebar-active'),
      'sidebar-border': token('sidebar-border'),
      ok: token('ok'),
      warn: token('warn'),
      bad: token('bad'),
    },
    fontFamily: {
      sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
    },
    fontSize: {
      xs: ['12px', '16px'],
      sm: ['14px', '20px'],
      base: ['16px', '24px'],
      lg: ['20px', '28px'],
      xl: ['24px', '32px'],
      kpi: ['32px', '40px'],
    },
    borderRadius: {
      none: '0',
      sm: '2px',
      DEFAULT: '4px',
      md: '8px',
      lg: '10px',
      xl: '12px',
      full: '9999px',
    },
    extend: {
      maxWidth: { page: '1440px' },
      boxShadow: { card: 'var(--shadow-card)', 'card-hover': 'var(--shadow-card-hover)' },
      transitionDuration: { DEFAULT: '150ms' },
    },
  },
  plugins: [],
};
