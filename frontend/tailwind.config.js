/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // デザイン仕様書のカラーパレット
        primary: '#82C2A9', // メインカラー（ミントグリーン）
        accent: '#FF463C', // アクセントカラー（レッド）
        'system-gray': '#8E8E93', // システムグレー
        background: '#F2F2F7', // バックグラウンドカラー
        separator: '#C6C6C8', // セパレータカラー
      },
      fontFamily: {
        sans: ['"SF Pro JP"', '"Hiragino Kaku Gothic ProN"', '"Hiragino Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
