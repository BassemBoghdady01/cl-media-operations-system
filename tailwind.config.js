/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ez: {
          bg: '#04081A',
          'bg-2': '#060D1F',
          'bg-3': '#0A1628',
          blue: '#3B82F6',
          purple: '#8B5CF6',
          cyan: '#06B6D4',
          pink: '#EC4899',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient':
          'radial-gradient(ellipse at 30% 40%, rgba(59,130,246,0.15) 0%, transparent 60%), radial-gradient(ellipse at 75% 60%, rgba(139,92,246,0.1) 0%, transparent 60%), #04081A',
        'card-gradient':
          'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.04) 100%)',
        'blue-purple': 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
        'blue-cyan': 'linear-gradient(135deg, #3B82F6, #06B6D4)',
        'purple-pink': 'linear-gradient(135deg, #8B5CF6, #EC4899)',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        'float-fast': 'float 4s ease-in-out infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'gradient-x': 'gradientX 8s ease infinite',
        shimmer: 'shimmer 2s linear infinite',
        'spin-slow': 'spin 8s linear infinite',
        'fade-in-up': 'fadeInUp 0.5s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-14px) rotate(1.5deg)' },
          '66%': { transform: 'translateY(-7px) rotate(-1deg)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(59,130,246,0.25), 0 0 60px rgba(59,130,246,0.08)' },
          '50%': { boxShadow: '0 0 40px rgba(59,130,246,0.5), 0 0 100px rgba(59,130,246,0.15)' },
        },
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'glow-blue': '0 0 30px rgba(59,130,246,0.35)',
        'glow-purple': '0 0 30px rgba(139,92,246,0.35)',
        'glow-cyan': '0 0 30px rgba(6,182,212,0.35)',
        card: '0 4px 32px rgba(0,0,0,0.45)',
        'card-hover': '0 8px 48px rgba(59,130,246,0.2)',
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
    },
  },
  plugins: [],
}
