import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'mata-orange': '#ff6b2b',
        'mata-orange-light': '#ff8f5e',
        'mata-orange-dark': '#e04d10',
        'mata-bg': '#fafaf8',
        'mata-card': '#ffffff',
        'mata-surface': '#f5f4f0',
        'mata-border': '#e8e6e1',
        'mata-text': '#1a1a1a',
        'mata-text-secondary': '#6b6966',
        'mata-text-muted': '#9e9b96',
        'mata-green': '#22c55e',
        'mata-red': '#ef4444',
        'mata-yellow': '#f59e0b',
        'mata-blue': '#3b82f6',
        'mata-purple': '#8b5cf6',
        'mata-dark': '#1a1a1a',
        'mata-dark-card': '#2a2a28',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
