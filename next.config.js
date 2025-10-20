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
  // Forcing a cache invalidation by adding a comment
  typescript: {
    // This setting is removed to re-enable type checking during build.
    // ignoreBuildErrors: true, 
  },
};

module.exports = nextConfig;
