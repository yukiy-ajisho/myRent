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
};

module.exports = nextConfig;
