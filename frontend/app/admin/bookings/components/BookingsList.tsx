'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookingListItem } from '../page';
import BookingApprovalModal from './BookingApprovalModal';

interface BookingsListProps {
  bookings: BookingListItem[];
  loading: boolean;
  selectedBookings: string[];
  onSelectionChange: (selected: string[]) => void;
  onBookingUpdate: () => void;
}

export default function BookingsList({
  bookings,
  loading,
  selectedBookings,
  onSelectionChange,
  onBookingUpdate
}: BookingsListProps) {
  const router = useRouter();
  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    bookingId: string;
    bookingInfo?: BookingListItem;
    action: 'approve' | 'reject';
  }>({
    isOpen: false,
    bookingId: '',
    action: 'approve'
  });

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('ja-JP') + '円';
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };

    const labels = {
      pending: '承認待ち',
      approved: '承認済み',
      rejected: '拒否済み',
      cancelled: 'キャンセル済み'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.pending}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const getBookingTypeBadge = (type: string) => {
    const styles = {
      temporary: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-purple-100 text-purple-800'
    };

    const labels = {
      temporary: '仮予約',
      confirmed: '本予約'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type as keyof typeof styles] || styles.temporary}`}>
        {labels[type as keyof typeof labels] || type}
      </span>
    );
  };

  const isNearDeadline = (booking: BookingListItem) => {
    if (!booking.deadlineAt) return false;
    const now = new Date();
    const deadline = new Date(booking.deadlineAt);
    const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilDeadline <= 48 && hoursUntilDeadline > 0;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pendingBookingIds = bookings
        .filter(booking => booking.status === 'pending')
        .map(booking => booking.id);
      onSelectionChange(pendingBookingIds);
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectBooking = (bookingId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedBookings, bookingId]);
    } else {
      onSelectionChange(selectedBookings.filter(id => id !== bookingId));
    }
  };

  const handleApprovalAction = (booking: BookingListItem, action: 'approve' | 'reject') => {
    setApprovalModal({
      isOpen: true,
      bookingId: booking.id,
      bookingInfo: booking,
      action
    });
  };

  const handleApprovalSubmit = async (bookingId: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      // TODO: 実際のAPIエンドポイントに接続
      // const response = await fetch(`/api/admin/bookings/${bookingId}/${action}`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ reason })
      // });

      console.log(`${action} booking ${bookingId}:`, reason);
      
      // 成功時は一覧を更新
      onBookingUpdate();
      setApprovalModal({ isOpen: false, bookingId: '', action: 'approve' });
      
    } catch (err) {
      console.error('Approval action error:', err);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-300 rounded w-1/4 mb-4"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pendingBookings = bookings.filter(booking => booking.status === 'pending');
  const allPendingSelected = pendingBookings.length > 0 && 
    pendingBookings.every(booking => selectedBookings.includes(booking.id));

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">予約一覧</h3>
          
          {/* 全選択チェックボックス */}
          {pendingBookings.length > 0 && (
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={allPendingSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm text-gray-700">
                承認待ち予約を全選択
              </label>
            </div>
          )}
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="mt-2 text-sm text-gray-500">予約が見つかりませんでした</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-4 px-6 py-3"></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ユーザー
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  予約情報
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  金額
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  作成日時
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bookings.map((booking) => (
                <tr 
                  key={booking.id} 
                  className={`hover:bg-gray-50 ${isNearDeadline(booking) ? 'bg-yellow-50' : ''}`}
                >
                  {/* 選択チェックボックス */}
                  <td className="px-6 py-4">
                    {booking.status === 'pending' && (
                      <input
                        type="checkbox"
                        checked={selectedBookings.includes(booking.id)}
                        onChange={(e) => handleSelectBooking(booking.id, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    )}
                  </td>

                  {/* ユーザー情報 */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {booking.userName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {booking.userEmail}
                      </div>
                    </div>
                  </td>

                  {/* 予約情報 */}
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        {getBookingTypeBadge(booking.bookingType)}
                        {booking.keepPosition && (
                          <span className="text-xs text-gray-500">
                            Keep {booking.keepPosition}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-900">
                        {formatDateTime(booking.startTime)} - {formatDateTime(booking.endTime).split(' ')[1]}
                      </div>
                      <div className="text-sm text-gray-500">
                        {booking.purpose}
                      </div>
                      {isNearDeadline(booking) && (
                        <div className="text-xs text-red-600 font-medium">
                          ⚠️ 期限切れ間近
                        </div>
                      )}
                    </div>
                  </td>

                  {/* ステータス */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(booking.status)}
                  </td>

                  {/* 金額 */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatPrice(booking.totalAmountIncludingTax)}
                  </td>

                  {/* 作成日時 */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateTime(booking.createdAt)}
                  </td>

                  {/* 操作ボタン */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => router.push(`/admin/bookings/${booking.id}`)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      詳細
                    </button>
                    
                    {booking.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprovalAction(booking, 'approve')}
                          className="text-green-600 hover:text-green-900"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => handleApprovalAction(booking, 'reject')}
                          className="text-red-600 hover:text-red-900"
                        >
                          拒否
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 承認・拒否モーダル */}
      <BookingApprovalModal
        isOpen={approvalModal.isOpen}
        bookingId={approvalModal.bookingId}
        bookingInfo={approvalModal.bookingInfo}
        action={approvalModal.action}
        onClose={() => setApprovalModal({ isOpen: false, bookingId: '', action: 'approve' })}
        onSubmit={handleApprovalSubmit}
      />
    </div>
  );
}
