/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // FIX-01: WebP only — AVIF removed (3-10x more memory/CPU per encode)
    formats: ['image/webp'],
    // FIX-04: Explicit allowlist — replaces open wildcard hostname: '**'
    remotePatterns: [
      // Printful CDN
      { protocol: 'https', hostname: 'files.cdn.printful.com' },
      { protocol: 'https', hostname: 'ucarecdn.com' },
      // Supabase Storage
      { protocol: 'https', hostname: 'bdazupyepobieyjzuamf.supabase.co' },
      { protocol: 'https', hostname: 'xuojbqklykhbawgnnisf.supabase.co' },
      // Stock/template images
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
    // FIX-05: 24h TTL — was 1h, reduces re-encode bursts after restarts
    minimumCacheTTL: 86400,
    // FIX-06: Constrained sizes — removes 2048/3840px variants, reduces cache misses
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [64, 128, 256, 384],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.resend.com https://api.mailerlite.com https://api.printful.com",
              "media-src 'self' https://*.supabase.co",
              "frame-src https://js.stripe.com https://hooks.stripe.com https://www.youtube.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        // Extra cache-control for admin routes — never cache
        source: '/admin/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
