/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          blue: '#007AFF',
          green: '#34C759',
          red: '#FF3B30',
          orange: '#FF9500',
          yellow: '#FFCC00',
          purple: '#AF52DE',
          gray: '#F5F5F7',
          'gray-2': '#E5E5EA',
          'gray-3': '#D1D1D6',
          'gray-4': '#C7C7CC',
          'gray-5': '#AEAEB2',
          'gray-6': '#8E8E93',
          text: '#1D1D1F',
          'text-2': '#6E6E73',
          'text-3': '#AEAEB2',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'apple-sm': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        apple: '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
        'apple-md': '0 4px 16px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)',
        'apple-lg': '0 8px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.07)',
      },
      borderRadius: {
        apple: '10px',
        'apple-md': '12px',
        'apple-lg': '16px',
        'apple-xl': '20px',
      },
    },
  },
  plugins: [],
};
