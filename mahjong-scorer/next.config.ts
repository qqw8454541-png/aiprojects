import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only use static export for production builds (Capacitor)
  output: process.env.NODE_ENV === 'development' ? undefined : 'export',
  images: {
    unoptimized: true
  },
  async rewrites() {
    return [
      {
        source: '/supabase-api/:path*',
        destination: 'http://127.0.0.1:54321/:path*',
      },
    ];
  },
};

export default nextConfig;
