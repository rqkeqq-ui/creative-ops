import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: [],
  experimental: {
    optimizePackageImports: [],
  },
}

export default nextConfig