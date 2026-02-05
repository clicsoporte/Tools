

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
    serverActions: {
      bodySizeLimit: '50mb',
      // Esto permite que las Server Actions funcionen detrás del proxy de IDX
      allowedOrigins: [
          'localhost:3000', 
          '*.cloudworkstations.dev', 
          '*.googleusercontent.com',
          '*.idx.dev'
      ],
      // Si tu versión de Next lo soporta, esto desactiva el chequeo estricto (ÚSALO SOLO EN DEV)
      checkOrigin: false 
    },
  },
};

module.exports = nextConfig;


