/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep development and production artifacts separate so a concurrent build cannot corrupt dev assets.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  images: {
    unoptimized: true,
  },
  // Docker Compose / standalone 部署输出
  output: process.env.DOCKER_STANDALONE === '1' ? 'standalone' : undefined,
};

export default nextConfig;
