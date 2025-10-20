/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Forcing a cache invalidation by toggling a setting
  typescript: {
    // This setting is disabled to ensure type checking is enforced during build.
    ignoreBuildErrors: false, 
  },
};

module.exports = nextConfig;
