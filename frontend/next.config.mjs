/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images-api.printify.com' },
      { protocol: 'https', hostname: '**.printify.com' },
    ],
  },
};

export default nextConfig;
