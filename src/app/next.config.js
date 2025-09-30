/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
      allowedOrigins: ['garend.com', '192.168.1.14', 'localhost:9003'],
      allowedForwardedHosts: ['garend.com', '192.168.1.14']
    },
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
