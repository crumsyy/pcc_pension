/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  experimental: {
    instantNavigationDevToolsToggle: true,
  },
  env: {
    NEXT_PUBLIC_SHOW_TEST_ACCOUNTS: process.env.NEXT_PUBLIC_SHOW_TEST_ACCOUNTS || 'true',
  },
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;
