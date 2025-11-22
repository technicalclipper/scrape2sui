import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Increase body size limit for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
