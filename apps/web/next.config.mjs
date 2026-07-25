/** @type {import('next').NextConfig} */
const nextConfig = {
  // Kompresi respons HTTP (gzip/brotli) -> payload lebih kecil, load lebih cepat.
  compress: true,
  // Hilangkan header X-Powered-By (sedikit mengurangi overhead + lebih aman).
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {

    // Tree-shake import barrel (recharts besar) agar bundle client lebih kecil.
    optimizePackageImports: ['recharts'],
  },
  // Cache header statis untuk aset Next yang ber-hash (sangat lama).
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
