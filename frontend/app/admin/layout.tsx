'use client';

import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        // 未認証の場合はログインページにリダイレクト
        router.push('/login');
        return;
      }

      if (!user.isAdmin) {
        // 管理者権限がない場合はカレンダーページにリダイレクト
        router.push('/calendar');
        return;
      }
    }
  }, [user, isLoading, router]);

  // ローディング中
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 未認証または管理者権限なし
  if (!user || !user.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 管理者ヘッダー */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                スタジオ管理画面
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                管理者: {user.fullName}
              </span>
              <button
                onClick={() => router.push('/calendar')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                カレンダーに戻る
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ナビゲーションタブ */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <AdminNavLink href="/admin" label="ダッシュボード" />
            <AdminNavLink href="/admin/bookings" label="予約管理" />
            <AdminNavLink href="/admin/users" label="ユーザー管理" />
            <AdminNavLink href="/admin/statistics" label="統計・分析" />
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

interface AdminNavLinkProps {
  href: string;
  label: string;
}

function AdminNavLink({ href, label }: AdminNavLinkProps) {
  const router = useRouter();
  const isActive = typeof window !== 'undefined' && window.location.pathname === href;

  return (
    <button
      onClick={() => router.push(href)}
      className={`py-4 px-1 border-b-2 font-medium text-sm ${
        isActive
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );
}
