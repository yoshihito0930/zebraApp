'use client';

import DashboardOverview from '@/components/admin/Dashboard/DashboardOverview';
import PendingTasks from '@/components/admin/Dashboard/PendingTasks';
import StatisticsGrid from '@/components/admin/Dashboard/StatisticsGrid';

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      {/* ページヘッダー */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">ダッシュボード</h2>
        <p className="mt-1 text-sm text-gray-500">
          システム全体の概要と管理タスクを確認できます
        </p>
      </div>

      {/* 概要統計 */}
      <DashboardOverview />

      {/* 統計グリッド */}
      <StatisticsGrid />

      {/* 管理タスク */}
      <PendingTasks />
    </div>
  );
}
