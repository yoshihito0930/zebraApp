import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: '撮影スタジオ予約管理システム',
  description: '撮影スタジオの予約管理を効率化するアプリケーション',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="bg-background min-h-screen">
        {children}
      </body>
    </html>
  )
}
