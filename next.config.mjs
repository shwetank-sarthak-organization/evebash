/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Enable SharedArrayBuffer for FFmpeg.wasm on upload-related pages only
        source: '/(main)/dashboard/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
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
  webpack: (config) => {
    // Required for @ffmpeg/ffmpeg WASM threading
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};

export default nextConfig;
