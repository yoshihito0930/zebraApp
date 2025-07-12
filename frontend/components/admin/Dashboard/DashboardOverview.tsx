'use client';

import { useEffect, useState } from 'react';
import StatCard from './StatCard';

interface DashboardData {
  overview: {
    totalBookings: number;
    totalUsers: number;
    pendingTasksCount: number;
    systemStatus: string;
  };
  bookingStats: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    byStatus: {
      pending: number;
      approved: number;
      rejected: number;
      cancelled: number;
    };
  };
  userStats: {
    total: number;
    activeRecent: number;
    newThisMonth: number;
  };
  quickActions: {
    pendingApprovals: number;
    expiringSoon: number;
    recentCancellations: number;
  };
}

export default function DashboardOverview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // TODO: 実際のAPIエンドポイントに接続
      // const response = await fetch('/api/admin/dashboard');
      // const result = await response.json();

      // 仮のデータ（開発用）
      const mockData: DashboardData = {
        overview: {
          totalBookings: 256,
          totalUsers: 89,
          pendingTasksCount: 12,
          systemStatus: 'healthy'
        },
        bookingStats: {
          total: 256,
          today: 5,
          thisWeek: 23,
          thisMonth: 78,
          byStatus: {
            pending: 12,
            approved: 198,
            rejected: 15,
            cancelled: 31
          }
        },
        userStats: {
          total: 89,
          activeRecent: 67,
          newThisMonth: 14
        },
        quickActions: {
          pendingApprovals: 12,
          expiringSoon: 3,
          recentCancellations: 7
        }
      };

      setData(mockData);
    } catch (err) {
      setError('データの取得に失敗しました');
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
            <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-gray-300 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">エラー</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="総予約数"
        value={data.overview.totalBookings}
        icon="calendar"
        color="blue"
        subtitle={`今月: ${data.bookingStats.thisMonth}件`}
      />
      
      <StatCard
        title="総ユーザー数"
        value={data.overview.totalUsers}
        icon="users"
        color="green"
        subtitle={`今月の新規: ${data.userStats.newThisMonth}人`}
      />
      
      <StatCard
        title="承認待ち"
        value={data.overview.pendingTasksCount}
        icon="clock"
        color="yellow"
        subtitle="要対応"
        urgent={data.overview.pendingTasksCount > 10}
      />
      
      <StatCard
        title="システム状況"
        value={data.overview.systemStatus === 'healthy' ? '正常' : '異常'}
        icon="activity"
        color={data.overview.systemStatus === 'healthy' ? 'green' : 'red'}
        subtitle="稼働中"
      />
    </div>
  );
}
