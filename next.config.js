/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
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
    // Esto permite solicitudes de origen cruzado al servidor de desarrollo de Next.js,
    // necesario para entornos como Firebase Studio.
    allowedDevOrigins: ['*.cloudworkstations.dev', '*.googleusercontent.com', '*.idx.dev'],
    serverActions: {
      bodySizeLimit: '50mb',
      // Esto es específico para Server Actions
      allowedOrigins: [
          'localhost:3000', 
          '*.cloudworkstations.dev', 
          '*.googleusercontent.com',
          '*.idx.dev'
      ],
      // Desactivamos el chequeo de origen solo en desarrollo.
      checkOrigin: process.env.NODE_ENV === 'development' ? false : undefined,
    },
  },
};

module.exports = nextConfig;
