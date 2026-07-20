module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefbf4',
          100: '#d7f5e2',
          500: '#16a34a',
          600: '#15803d',
          700: '#166534'
        }
      },
      boxShadow: {
        soft: '0 10px 30px rgba(2, 6, 23, 0.08)',
      }
    },
  },
  plugins: [],
};
