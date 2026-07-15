/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/biz-hub/:path*',
        destination: '/eb-business/:path*',
        permanent: true,
      },
      {
        source: '/marketplace/:path*',
        destination: '/eb-network/:path*',
        permanent: true,
      },
    ];
  },
  serverExternalPackages: ["sharp", "@tensorflow/tfjs-node"],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'media.evebash.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
