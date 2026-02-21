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
      // Desactivamos el chequeo de origen solo en desarrollo. 
      // En producción, Next.js usa su propio sistema de seguridad estricto.
      // Dejar esto en 'false' en producción puede causar problemas de caché.
      checkOrigin: process.env.NODE_ENV === 'development' ? false : undefined,
    },
  },
};

module.exports = nextConfig;
