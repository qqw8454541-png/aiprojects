import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const proxyDest = process.env.SUPABASE_LOCAL_PROXY;
    if (!proxyDest) return [];
    return [
      {
        source: '/supabase-proxy/:path*',
        destination: `${proxyDest}/:path*`,
      },
    ];
  },
};

export default nextConfig;