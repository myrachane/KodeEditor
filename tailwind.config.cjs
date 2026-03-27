/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0D1117',
        panel: '#161B22',
        accent: '#1f6feb',
        text: '#c9d1d9',
        muted: '#8b949e'
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      borderRadius: {
        xl2: '8px'
      },
      boxShadow: {
        glass: '0 8px 30px rgba(0,0,0,0.35)'
      }
    }
  },
  plugins: []
};
