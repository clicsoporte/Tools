/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
    },
    // Añadido para permitir solicitudes desde el entorno de desarrollo en la nube.
    allowedDevOrigins: [
        "https://*.cloudworkstations.dev",
        "https://*.firebase.studio",
    ],
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
