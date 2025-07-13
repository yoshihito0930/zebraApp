'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import BookingsList from './components/BookingsList';
import BookingFilters from './components/BookingFilters';
import AdminBookingCreateModal from './components/AdminBookingCreateModal';
import BookingEditModal from './components/BookingEditModal';

export interface BookingListItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  bookingType: 'temporary' | 'confirmed';
  startTime: string;
  endTime: string;
  purpose: string;
  totalAmountIncludingTax: number;
  createdAt: string;
  updatedAt: string;
  keepPosition?: number;
  deadlineAt?: string; // 仮予約の期限
}

export interface BookingFilters {
  status: string;
  bookingType: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  search: string;
}

export interface BookingsResponse {
  success: boolean;
  bookings: BookingListItem[];
  totalCount: number;
  hasNextPage: boolean;
  message?: string;
}

export default function AdminBookingsPage() {
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<BookingFilters>({
    status: searchParams?.get('filter') || 'all',
    bookingType: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    search: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalCount: 0,
    hasNextPage: false
  });
  const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    booking: BookingListItem | null;
  }>({
    isOpen: false,
    booking: null
  });

  useEffect(() => {
    fetchBookings();
  }, [filters, pagination.page]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      
      // TODO: 実際のAPIエンドポイントに接続
      // const queryParams = new URLSearchParams({
      //   status: filters.status,
      //   bookingType: filters.bookingType,
      //   sortBy: filters.sortBy,
      //   sortOrder: filters.sortOrder,
      //   search: filters.search,
      //   page: pagination.page.toString(),
      //   limit: pagination.limit.toString()
      // });
      // const response = await fetch(`/api/admin/bookings?${queryParams}`);
      
      // 仮のデータ（開発用）
      const mockData: BookingsResponse = {
        success: true,
        bookings: [
          {
            id: '1',
            userId: 'user1',
            userName: '田中太郎',
            userEmail: 'tanaka@example.com',
            status: 'pending',
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
            status: 'pending',
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
            status: 'pending',
            bookingType: 'temporary',
            startTime: '2025-02-18T09:00:00Z',
            endTime: '2025-02-18T12:00:00Z',
            purpose: '商品撮影',
            totalAmountIncludingTax: 16500,
            createdAt: '2025-01-11T14:00:00Z',
            updatedAt: '2025-01-11T14:00:00Z',
            keepPosition: 2,
            deadlineAt: '2025-02-11T18:00:00Z'
          },
          {
            id: '4',
            userId: 'user4',
            userName: '鈴木美咲',
            userEmail: 'suzuki@example.com',
            status: 'approved',
            bookingType: 'confirmed',
            startTime: '2025-02-25T15:00:00Z',
            endTime: '2025-02-25T18:00:00Z',
            purpose: '家族写真',
            totalAmountIncludingTax: 16500,
            createdAt: '2025-01-10T16:20:00Z',
            updatedAt: '2025-01-12T11:45:00Z'
          }
        ],
        totalCount: 15,
        hasNextPage: true
      };

      // フィルタリング処理
      let filteredBookings = mockData.bookings;
      
      if (filters.status !== 'all') {
        if (filters.status === 'pending') {
          filteredBookings = filteredBookings.filter(b => b.status === 'pending');
        } else if (filters.status === 'expiring') {
          // 期限切れ間近（48時間以内）
          const now = new Date();
          filteredBookings = filteredBookings.filter(b => {
            if (b.deadlineAt) {
              const deadline = new Date(b.deadlineAt);
              const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
              return hoursUntilDeadline <= 48 && hoursUntilDeadline > 0;
            }
            return false;
          });
        } else {
          filteredBookings = filteredBookings.filter(b => b.status === filters.status);
        }
      }

      if (filters.bookingType !== 'all') {
        filteredBookings = filteredBookings.filter(b => b.bookingType === filters.bookingType);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredBookings = filteredBookings.filter(b => 
          b.userName.toLowerCase().includes(searchLower) ||
          b.userEmail.toLowerCase().includes(searchLower) ||
          b.purpose.toLowerCase().includes(searchLower)
        );
      }

      setBookings(filteredBookings);
      setPagination(prev => ({
        ...prev,
        totalCount: filteredBookings.length,
        hasNextPage: filteredBookings.length > prev.limit * prev.page
      }));

    } catch (err) {
      console.error('Bookings fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = (newFilters: Partial<BookingFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 })); // フィルター変更時はページをリセット
  };

  const handleBulkApproval = async (bookingIds: string[], action: 'approve' | 'reject', reason?: string) => {
    try {
      // TODO: 実際のAPIエンドポイントに接続
      // const response = await fetch('/api/admin/bookings/bulk-action', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ bookingIds, action, reason })
      // });

      console.log(`${action} bookings:`, bookingIds, reason);
      
      // 成功時は一覧を再取得
      await fetchBookings();
      setSelectedBookings([]);
      
    } catch (err) {
      console.error('Bulk action error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">予約管理</h2>
        <p className="mt-1 text-sm text-gray-500">
          予約の承認、拒否、詳細確認を行います
        </p>
      </div>

      {/* フィルター */}
      <BookingFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        totalCount={pagination.totalCount}
        selectedCount={selectedBookings.length}
        onBulkApproval={handleBulkApproval}
      />

      {/* 予約一覧 */}
      <BookingsList
        bookings={bookings}
        loading={loading}
        selectedBookings={selectedBookings}
        onSelectionChange={setSelectedBookings}
        onBookingUpdate={fetchBookings}
      />

      {/* ページネーション */}
      {pagination.totalCount > pagination.limit && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              前へ
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={!pagination.hasNextPage}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              次へ
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                <span className="font-medium">{pagination.totalCount}</span> 件中{' '}
                <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> - 
                <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.totalCount)}</span> 件を表示
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">前へ</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
                <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300">
                  {pagination.page}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={!pagination.hasNextPage}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">次へ</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
