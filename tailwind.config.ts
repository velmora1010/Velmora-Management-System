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
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        card: '0 2px 8px 0 rgba(23, 43, 77, 0.04), 0 1px 3px 0 rgba(23, 43, 77, 0.02)',
        modal: '0 20px 25px -5px rgba(23, 43, 77, 0.1), 0 10px 10px -5px rgba(23, 43, 77, 0.04)',
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
