/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keeping this block if other experimental features are needed in the future,
    // but moving serverActions out as per the new configuration standard for this issue.
  },
  serverActions: {
    bodySizeLimit: '15mb',
    // By not specifying `allowedOrigins`, we disable the origin check,
    // which is the recommended approach for solving proxy-related fetch errors.
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

module.exports = nextConfig;
