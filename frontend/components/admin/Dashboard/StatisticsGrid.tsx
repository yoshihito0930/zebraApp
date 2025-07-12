'use client';

import { useEffect, useState } from 'react';
import StatCard from './StatCard';

interface StatisticsData {
  bookingStats: {
    todayCount: number;
    weekCount: number;
    monthCount: number;
    approvalRate: number;
  };
  revenueStats: {
    todayRevenue: number;
    monthRevenue: number;
    averagePerBooking: number;
  };
  userActivity: {
    activeToday: number;
    newThisWeek: number;
    totalActiveUsers: number;
  };
}

export default function StatisticsGrid() {
  const [data, setData] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatisticsData();
  }, []);

  const fetchStatisticsData = async () => {
    try {
      setLoading(true);
      // TODO: 実際のAPIエンドポイントに接続
      // const response = await fetch('/api/admin/dashboard/statistics');
      
      // 仮のデータ（開発用）
      const mockData: StatisticsData = {
        bookingStats: {
          todayCount: 5,
          weekCount: 23,
          monthCount: 78,
          approvalRate: 87.5
        },
        revenueStats: {
          todayRevenue: 82500,
          monthRevenue: 1284000,
          averagePerBooking: 16462
        },
        userActivity: {
          activeToday: 12,
          newThisWeek: 6,
          totalActiveUsers: 67
        }
      };

      setData(mockData);
    } catch (err) {
      console.error('Statistics data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
            <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-gray-300 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-6">今日の統計</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="今日の予約"
          value={data.bookingStats.todayCount}
          icon="calendar"
          color="blue"
          subtitle="件"
        />
        
        <StatCard
          title="今日の売上"
          value={`¥${data.revenueStats.todayRevenue.toLocaleString()}`}
          icon="dollar"
          color="green"
          subtitle="税込"
        />
        
        <StatCard
          title="今日のアクティブユーザー"
          value={data.userActivity.activeToday}
          icon="users"
          color="purple"
          subtitle="人"
        />
        
        <StatCard
          title="今週の予約"
          value={data.bookingStats.weekCount}
          icon="calendar"
          color="indigo"
          subtitle="件"
        />
        
        <StatCard
          title="承認率"
          value={`${data.bookingStats.approvalRate}%`}
          icon="chart"
          color="green"
          subtitle="今月"
        />
        
        <StatCard
          title="平均予約単価"
          value={`¥${data.revenueStats.averagePerBooking.toLocaleString()}`}
          icon="dollar"
          color="yellow"
          subtitle="今月"
        />
      </div>
    </div>
  );
}
