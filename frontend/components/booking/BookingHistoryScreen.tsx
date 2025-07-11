"use client";

import React, { useState, useEffect } from 'react';
import { 
  BookingHistoryItem as BookingHistoryItemType, 
  BookingHistoryResponse,
  BookingHistoryFilters 
} from '../../types/booking';
import BookingHistoryItem from './BookingHistoryItem';
import BookingDetailsModal from './BookingDetailsModal';
import Button from '../ui/button';
import { useAuth } from '../../contexts/auth-context';

interface BookingHistoryScreenProps {
  className?: string;
}

const BookingHistoryScreen: React.FC<BookingHistoryScreenProps> = ({ className }) => {
  const { user, isAuthenticated } = useAuth();
  const [bookings, setBookings] = useState<BookingHistoryItemType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [filters, setFilters] = useState<BookingHistoryFilters>({
    limit: 10,
    offset: 0
  });
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch booking history
  const fetchBookingHistory = async (resetList = false) => {
    if (!isAuthenticated) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.bookingType) queryParams.append('bookingType', filters.bookingType);
      queryParams.append('limit', filters.limit?.toString() || '10');
      queryParams.append('offset', (resetList ? 0 : filters.offset || 0).toString());
      
      const response = await fetch(`/api/bookings/history?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('予約履歴の取得に失敗しました');
      }
      
      const data: BookingHistoryResponse = await response.json();
      
      if (data.success) {
        if (resetList) {
          setBookings(data.bookings);
        } else {
          setBookings(prev => [...prev, ...data.bookings]);
        }
        setHasNextPage(data.hasNextPage);
        setTotalCount(data.totalCount);
      } else {
        throw new Error(data.message || '予約履歴の取得に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '予約履歴の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // Load more bookings
  const loadMoreBookings = () => {
    if (!isLoading && hasNextPage) {
      setFilters(prev => ({
        ...prev,
        offset: (prev.offset || 0) + (prev.limit || 10)
      }));
    }
  };

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<BookingHistoryFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      offset: 0 // Reset offset when filters change
    }));
  };

  // Handle booking details view
  const handleViewDetails = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setIsDetailsModalOpen(true);
  };

  // Handle modal close
  const handleCloseModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedBookingId(null);
  };

  // Initial load
  useEffect(() => {
    if (isAuthenticated) {
      fetchBookingHistory(true);
    }
  }, [isAuthenticated]);

  // Fetch when filters change
  useEffect(() => {
    if (isAuthenticated) {
      fetchBookingHistory(true);
    }
  }, [filters.status, filters.bookingType]);

  // Fetch when offset changes (for pagination)
  useEffect(() => {
    if (isAuthenticated && filters.offset && filters.offset > 0) {
      fetchBookingHistory(false);
    }
  }, [filters.offset]);

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${className}`}>
        <div className="text-center">
          <p className="text-gray-600 mb-4">ログインが必要です</p>
          <Button onClick={() => window.location.href = '/login'}>
            ログイン
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">予約履歴</h1>
          <p className="text-gray-600">
            {user?.fullName || user?.email}さんの予約履歴を表示しています
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">フィルター</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ステータス
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange({ status: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">すべて</option>
                <option value="pending">申請中</option>
                <option value="approved">承認済み</option>
                <option value="rejected">拒否済み</option>
                <option value="cancelled">キャンセル済み</option>
              </select>
            </div>

            {/* Booking Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                予約タイプ
              </label>
              <select
                value={filters.bookingType || ''}
                onChange={(e) => handleFilterChange({ bookingType: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">すべて</option>
                <option value="temporary">仮予約</option>
                <option value="confirmed">本予約</option>
              </select>
            </div>

            {/* Reset Button */}
            <div className="flex items-end">
              <Button
                variant="secondary"
                onClick={() => handleFilterChange({ status: undefined, bookingType: undefined })}
                className="w-full"
              >
                フィルターをリセット
              </Button>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        {!isLoading && (
          <div className="mb-6">
            <p className="text-gray-600">
              {totalCount > 0 ? `${totalCount}件の予約履歴が見つかりました` : '予約履歴がありません'}
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-center">
              <div className="text-red-600 mr-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-red-800 font-medium">エラーが発生しました</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => fetchBookingHistory(true)}
              className="mt-4"
            >
              再試行
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && bookings.length === 0 && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-3">
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-64 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                  </div>
                  <div className="h-10 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Booking List */}
        {!isLoading && bookings.length > 0 && (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <BookingHistoryItem
                key={booking.id}
                booking={booking}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        )}

        {/* Load More Button */}
        {!isLoading && hasNextPage && (
          <div className="text-center mt-8">
            <Button
              variant="secondary"
              onClick={loadMoreBookings}
              disabled={isLoading}
            >
              {isLoading ? '読み込み中...' : 'さらに読み込む'}
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && bookings.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">予約履歴がありません</h3>
            <p className="text-gray-600 mb-6">
              まだ予約を作成していません。最初の予約を作成してみましょう。
            </p>
            <Button
              onClick={() => window.location.href = '/calendar'}
            >
              予約を作成する
            </Button>
          </div>
        )}
      </div>

      {/* Booking Details Modal */}
      {selectedBookingId && (
        <BookingDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={handleCloseModal}
          bookingId={selectedBookingId}
        />
      )}
    </div>
  );
};

export default BookingHistoryScreen;
