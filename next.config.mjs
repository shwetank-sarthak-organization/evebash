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
  async headers() {
    return [
      {
        // Only the production host is indexed; staging, preview and other hosts serve the same pages.
        source: '/:path*',
        missing: [{ type: 'host', value: 'www.evebash.com' }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
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
    // app/global-not-found.tsx: one branded 404 for addresses outside every route group
    globalNotFound: true,
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
