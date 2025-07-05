/** @type {import('next').NextConfig} */
const nextConfig = {
  // 本番環境での設定
  output: 'standalone',
  
  // 開発サーバー設定
  experimental: {
    // Future compatibility
  },
  
  // 画像最適化設定
  images: {
    unoptimized: false,
  },
  
  // 環境変数設定
  env: {
    CUSTOM_KEY: 'my-value',
  },
  
  // リダイレクト設定
  async redirects() {
    return []
  },
  
  // ヘッダー設定
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
