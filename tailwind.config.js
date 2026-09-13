/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0d0e15',
        panel: '#1a1c29',
        neon: '#00ffcc',
        danger: '#ff0055',
        gold: '#ffe600',
      },
      fontFamily: {
        display: ['Rajdhani', 'Segoe UI', 'Tahoma', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(0, 255, 204, 0.35)',
        'glow-lg': '0 0 40px rgba(0, 255, 204, 0.55)',
      },
    },
  },
  plugins: [],
}
