import type { Config } from 'tailwindcss';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-color)',
        sidebar: 'var(--sidebar-bg)',
        main: 'var(--text-main)',
        muted: 'var(--text-muted)',
        primary: 'var(--primary-color)',
        card: {
          DEFAULT: 'var(--card-bg)',
          hover: 'var(--card-hover)',
        },
        btn: {
          DEFAULT: 'var(--btn-bg)',
          text: 'var(--btn-text)',
          hover: 'var(--btn-hover)',
        },
        border: 'var(--border-color)',
      },
      boxShadow: {
        velmora: 'var(--shadow)',
        'velmora-hover': 'var(--hover-shadow)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      transitionProperty: {
        velmora: 'var(--transition)',
      },
    },
  },
  plugins: [],
} satisfies Config;
