/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        space: {
          bg: '#050A14',
          sidebar: '#0A1628',
          border: '#1E3A5F',
          btn: '#1E3A5F',
          btnHover: '#2A5080',
        },
        text: {
          primary: '#E8F4FD',
          secondary: '#6B9EC7',
        },
        orbit: {
          iss: '#FF6B35',
          leo: '#4FC3F7',
          meo: '#81C784',
          geo: '#FFD54F',
          planet: '#E0E0E0',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        issGlow: '0 0 12px rgba(255, 107, 53, 0.4)',
      },
      animation: {
        'pulse-ring': 'pulseRing 1.8s ease-in-out infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
      },
      keyframes: {
        pulseRing: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,107,53,0.5)' },
          '50%': { boxShadow: '0 0 0 6px rgba(255,107,53,0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
