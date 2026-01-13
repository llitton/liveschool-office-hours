import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'info.whyliveschool.com',
        pathname: '/hubfs/**',
      },
    ],
  },
};

export default nextConfig;
