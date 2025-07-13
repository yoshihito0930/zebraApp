'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PendingBookingsList from './components/PendingBookingsList';
import PendingBookingsFilters from './components/PendingBookingsFilters';

export interface PendingBookingItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  bookingType: 'temporary' | 'confirmed';
  startTime: string;
  endTime: string;
  purpose: string;
  totalAmountIncludingTax: number;
  createdAt: string;
  updatedAt: string;
  keepPosition?: number;
  deadlineAt?: string; // 仮予約の期限
  isNearDeadline?: boolean;
  hoursUntilDeadline?: number;
}

export interface PendingFilters {
  bookingType: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  search: string;
  priorityFilter: 'all' | 'expiring' | 'keep_priority';
}

export interface PendingBookingsResponse {
  success: boolean;
  bookings: PendingBookingItem[];
  totalCount: number;
  expiringCount: number;
  temporaryCount: number;
  confirmedCount: number;
  message?: string;
}

export default function PendingBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<PendingBookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PendingFilters>({
    bookingType: 'all',
    sortBy: 'deadline_priority',
    sortOrder: 'asc',
    search: '',
    priorityFilter: 'all'
  });
  const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
  const [stats, setStats] = useState({
    totalCount: 0,
    expiringCount: 0,
    temporaryCount: 0,
    confirmedCount: 0
  });

  useEffect(() => {
    fetchPendingBookings();
  }, [filters]);

  const fetchPendingBookings = async () => {
    try {
      setLoading(true);
      
      // TODO: 実際のAPIエンドポイントに接続
      // const queryParams = new URLSearchParams({
      //   bookingType: filters.bookingType,
      //   sortBy: filters.sortBy,
      //   sortOrder: filters.sortOrder,
      //   search: filters.search,
      //   priorityFilter: filters.priorityFilter
      // });
      // const response = await fetch(`/api/admin/bookings/pending?${queryParams}`);
      
      // 仮のデータ（開発用）
      const now = new Date();
      const mockBookings: PendingBookingItem[] = [
        {
          id: '1',
          userId: 'user1',
          userName: '田中太郎',
          userEmail: 'tanaka@example.com',
          bookingType: 'temporary',
          startTime: '2025-02-15T10:00:00Z',
          endTime: '2025-02-15T14:00:00Z',
          purpose: 'ポートレート撮影',
          totalAmountIncludingTax: 22000,
          createdAt: '2025-01-12T10:30:00Z',
          updatedAt: '2025-01-12T10:30:00Z',
          keepPosition: 1,
          deadlineAt: '2025-02-08T18:00:00Z'
        },
        {
          id: '2',
          userId: 'user2',
          userName: '佐藤花子',
          userEmail: 'sato@example.com',
          bookingType: 'confirmed',
          startTime: '2025-02-20T13:00:00Z',
          endTime: '2025-02-20T17:00:00Z',
          purpose: 'ファッション撮影',
          totalAmountIncludingTax: 35000,
          createdAt: '2025-01-12T09:15:00Z',
          updatedAt: '2025-01-12T09:15:00Z'
        },
        {
          id: '3',
          userId: 'user3',
          userName: '山田次郎',
          userEmail: 'yamada@example.com',
          bookingType: 'temporary',
          startTime: '2025-02-18T09:00:00Z',
          endTime: '2025-02-18T12:00:00Z',
          purpose: '商品撮影',
          totalAmountIncludingTax: 16500,
          createdAt: '2025-01-11T14:00:00Z',
          updatedAt: '2025-01-11T14:00:00Z',
          keepPosition: 2,
          deadlineAt: '2025-01-14T18:00:00Z' // 期限切れ間近
        },
        {
          id: '4',
          userId: 'user4',
          userName: '鈴木美咲',
          userEmail: 'suzuki@example.com',
          bookingType: 'temporary',
          startTime: '2025-02-25T15:00:00Z',
          endTime: '2025-02-25T18:00:00Z',
          purpose: '家族写真',
          totalAmountIncludingTax: 16500,
          createdAt: '2025-01-10T16:20:00Z',
          updatedAt: '2025-01-10T16:20:00Z',
          keepPosition: 3,
          deadlineAt: '2025-01-17T18:00:00Z'
        },
        {
          id: '5',
          userId: 'user5',
          userName: '高橋健一',
          userEmail: 'takahashi@example.com',
          bookingType: 'confirmed',
          startTime: '2025-02-28T10:00:00Z',
          endTime: '2025-02-28T15:00:00Z',
          purpose: 'ビジネスプロフィール撮影',
          totalAmountIncludingTax: 28000,
          createdAt: '2025-01-09T11:30:00Z',
          updatedAt: '2025-01-09T11:30:00Z'
        }
      ];

      // 期限情報の計算
      const processedBookings = mockBookings.map(booking => {
        let isNearDeadline = false;
        let hoursUntilDeadline = 0;

        if (booking.deadlineAt) {
          const deadline = new Date(booking.deadlineAt);
          hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
          isNearDeadline = hoursUntilDeadline <= 48 && hoursUntilDeadline > 0;
        }

        return {
          ...booking,
          isNearDeadline,
          hoursUntilDeadline: Math.max(0, hoursUntilDeadline)
        };
      });

      // フィルタリング処理
      let filteredBookings = processedBookings;

      if (filters.bookingType !== 'all') {
        filteredBookings = filteredBookings.filter(b => b.bookingType === filters.bookingType);
      }

      if (filters.priorityFilter === 'expiring') {
        filteredBookings = filteredBookings.filter(b => b.isNearDeadline);
      } else if (filters.priorityFilter === 'keep_priority') {
        filteredBookings = filteredBookings.filter(b => b.keepPosition);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredBookings = filteredBookings.filter(b => 
          b.userName.toLowerCase().includes(searchLower) ||
          b.userEmail.toLowerCase().includes(searchLower) ||
          b.purpose.toLowerCase().includes(searchLower)
        );
      }

      // ソート処理
      filteredBookings.sort((a, b) => {
        let comparison = 0;

        switch (filters.sortBy) {
          case 'deadline_priority':
            // 期限切れ間近 → Keep順 → 作成日時順
            if (a.isNearDeadline !== b.isNearDeadline) {
              comparison = b.isNearDeadline ? 1 : -1;
            } else if (a.keepPosition && b.keepPosition) {
              comparison = a.keepPosition - b.keepPosition;
            } else if (a.keepPosition !== b.keepPosition) {
              comparison = a.keepPosition ? -1 : 1;
            } else {
              comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }
            break;
          case 'createdAt':
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case 'startTime':
            comparison = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
            break;
          case 'keepPosition':
            if (a.keepPosition && b.keepPosition) {
              comparison = a.keepPosition - b.keepPosition;
            } else if (a.keepPosition !== b.keepPosition) {
              comparison = a.keepPosition ? -1 : 1;
            }
            break;
          case 'userName':
            comparison = a.userName.localeCompare(b.userName);
            break;
          default:
            comparison = 0;
        }

        return filters.sortOrder === 'desc' ? -comparison : comparison;
      });

      setBookings(filteredBookings);
      
      // 統計情報の計算
      const expiringCount = processedBookings.filter(b => b.isNearDeadline).length;
      const temporaryCount = processedBookings.filter(b => b.bookingType === 'temporary').length;
      const confirmedCount = processedBookings.filter(b => b.bookingType === 'confirmed').length;

      setStats({
        totalCount: processedBookings.length,
        expiringCount,
        temporaryCount,
        confirmedCount
      });

    } catch (err) {
      console.error('Pending bookings fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = (newFilters: Partial<PendingFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleBulkApproval = async (bookingIds: string[], action: 'approve' | 'reject', reason?: string) => {
    try {
      // TODO: 実際のAPIエンドポイントに接続
      console.log(`${action} bookings:`, bookingIds, reason);
      
      // 成功時は一覧を再取得
      await fetchPendingBookings();
      setSelectedBookings([]);
      
    } catch (err) {
      console.error('Bulk action error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => router.back()}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold text-gray-900">承認待ち予約一覧</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            承認が必要な予約を優先度順に管理します
          </p>
        </div>

        {/* 統計サマリー */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-red-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-red-600">{stats.expiringCount}</div>
            <div className="text-xs text-red-600">期限切れ間近</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-600">{stats.temporaryCount}</div>
            <div className="text-xs text-blue-600">仮予約</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-purple-600">{stats.confirmedCount}</div>
            <div className="text-xs text-purple-600">本予約</div>
          </div>
        </div>
      </div>

      {/* フィルター */}
      <PendingBookingsFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        totalCount={stats.totalCount}
        selectedCount={selectedBookings.length}
        onBulkApproval={handleBulkApproval}
      />

      {/* 承認待ち予約一覧 */}
      <PendingBookingsList
        bookings={bookings}
        loading={loading}
        selectedBookings={selectedBookings}
        onSelectionChange={setSelectedBookings}
        onBookingUpdate={fetchPendingBookings}
      />
    </div>
  );
}
