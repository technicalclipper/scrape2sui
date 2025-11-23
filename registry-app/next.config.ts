import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Increase body size limit for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Configure for Walrus SDK WASM module
  // As per @mysten/walrus docs: https://sdk.mystenlabs.com/walrus
  serverExternalPackages: ['@mysten/walrus', '@mysten/walrus-wasm'],
};

export default nextConfig;
