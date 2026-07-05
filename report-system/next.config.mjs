/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // pdf-parse は内部で動的requireを使うためバンドルせず node_modules から読み込む
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
