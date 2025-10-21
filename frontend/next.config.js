/** @type {import('next').NextConfig} */
const nextConfig = {
  // 開発ツールを非表示にする
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: "bottom-right",
  },
  // その他の設定
  experimental: {
    // 開発時の不要な機能を無効化
    optimizePackageImports: ["@supabase/supabase-js"],
  },
  // ビルド時のTypeScriptとESLintチェックを無効化
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 外部画像ドメインを許可
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

module.exports = nextConfig;
