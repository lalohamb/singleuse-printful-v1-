import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#6C47FF',
        accent: '#00D4AA',
        bg: '#0A0A0F',
        surface: '#13131A',
        border: '#2A2A3A',
        'text-secondary': '#A0A0B0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #6C47FF 0%, #00D4AA 100%)',
        'hero-glow': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(108,71,255,0.3), transparent)',
      },
      animation: {
        'glow-pulse': 'glowPulse 2.5s ease-in-out infinite',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(108,71,255,0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(108,71,255,0.8), 0 0 60px rgba(0,212,170,0.3)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
