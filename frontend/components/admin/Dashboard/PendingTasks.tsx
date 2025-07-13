'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PendingTask {
  id: string;
  type: 'booking_approval' | 'booking_expiring' | 'user_issue' | 'system_alert';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  actionUrl?: string;
}

interface PendingTasksData {
  pendingApprovals: {
    count: number;
    items: PendingTask[];
  };
  expiringSoon: {
    count: number;
    items: PendingTask[];
  };
  systemAlerts: {
    count: number;
    items: PendingTask[];
  };
  summary: {
    totalTasks: number;
    highPriority: number;
  };
}

export default function PendingTasks() {
  const [data, setData] = useState<PendingTasksData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchPendingTasks();
  }, []);

  const fetchPendingTasks = async () => {
    try {
      setLoading(true);
      // TODO: 実際のAPIエンドポイントに接続
      // const response = await fetch('/api/admin/dashboard/pending-tasks');
      
      // 仮のデータ（開発用）
      const mockData: PendingTasksData = {
        pendingApprovals: {
          count: 12,
          items: [
            {
              id: '1',
              type: 'booking_approval',
              title: '仮予約の承認待ち',
              description: '田中太郎様の2025年2月15日の予約',
              priority: 'high',
              createdAt: '2025-01-12T10:30:00Z',
              actionUrl: '/admin/bookings/1'
            },
            {
              id: '2', 
              type: 'booking_approval',
              title: '本予約の承認待ち',
              description: '佐藤花子様の2025年2月20日の予約',
              priority: 'medium',
              createdAt: '2025-01-12T09:15:00Z',
              actionUrl: '/admin/bookings/2'
            }
          ]
        },
        expiringSoon: {
          count: 3,
          items: [
            {
              id: '3',
              type: 'booking_expiring',
              title: '仮予約期限切れ間近',
              description: '山田次郎様の予約（残り18時間）',
              priority: 'medium',
              createdAt: '2025-01-11T14:00:00Z',
              actionUrl: '/admin/bookings/3'
            }
          ]
        },
        systemAlerts: {
          count: 1,
          items: [
            {
              id: '4',
              type: 'system_alert',
              title: 'システムメンテナンス予定',
              description: '2025年2月1日午前2時〜4時',
              priority: 'low',
              createdAt: '2025-01-10T12:00:00Z'
            }
          ]
        },
        summary: {
          totalTasks: 16,
          highPriority: 4
        }
      };

      setData(mockData);
    } catch (err) {
      console.error('Pending tasks fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
      default:
        return '不明';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleTaskClick = (task: PendingTask) => {
    if (task.actionUrl) {
      router.push(task.actionUrl);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="h-6 bg-gray-300 rounded w-1/4 mb-4 animate-pulse"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const allTasks = [
    ...data.pendingApprovals.items,
    ...data.expiringSoon.items,
    ...data.systemAlerts.items
  ].sort((a, b) => {
    // 優先度順でソート
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  }).slice(0, 10); // 最大10件表示

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">管理タスク</h3>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>総タスク: {data.summary.totalTasks}件</span>
            <span className="text-red-600">高優先度: {data.summary.highPriority}件</span>
          </div>
        </div>

        {allTasks.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">未処理のタスクはありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {allTasks.map((task) => (
              <div
                key={task.id}
                className={`p-4 border rounded-lg transition-colors ${
                  task.actionUrl ? 'hover:bg-gray-50 cursor-pointer' : ''
                }`}
                onClick={() => handleTaskClick(task)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        {task.title}
                      </h4>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        {getPriorityLabel(task.priority)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {task.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(task.createdAt)}
                    </p>
                  </div>
                  {task.actionUrl && (
                    <div className="ml-4">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 全てのタスクを見るリンク */}
        <div className="mt-6 pt-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => router.push('/admin/bookings/pending')}
              className="flex items-center justify-between p-3 text-left border rounded-lg hover:bg-gray-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">承認待ち予約</p>
                <p className="text-lg font-semibold text-red-600">{data.pendingApprovals.count}件</p>
              </div>
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={() => router.push('/admin/bookings?filter=expiring')}
              className="flex items-center justify-between p-3 text-left border rounded-lg hover:bg-gray-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">期限切れ間近</p>
                <p className="text-lg font-semibold text-yellow-600">{data.expiringSoon.count}件</p>
              </div>
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={() => router.push('/admin/users')}
              className="flex items-center justify-between p-3 text-left border rounded-lg hover:bg-gray-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">ユーザー管理</p>
                <p className="text-lg font-semibold text-blue-600">管理</p>
              </div>
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
