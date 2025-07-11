"use client";

import React from 'react';
import { 
  BookingHistoryItem as BookingHistoryItemType, 
  BOOKING_TYPES, 
  PURPOSE_OPTIONS 
} from '../../types/booking';
import Button from '../ui/button';

interface BookingHistoryItemProps {
  booking: BookingHistoryItemType;
  onViewDetails: (bookingId: string) => void;
}

const BookingHistoryItem: React.FC<BookingHistoryItemProps> = ({
  booking,
  onViewDetails
}) => {
  // Helper function to format date for display
  const formatDateTimeForDisplay = (dateString: string): string => {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}月${day}日 ${hours}:${minutes}`;
  };

  // Helper function to format time range
  const formatTimeRange = (startTime: string, endTime: string): string => {
    const start = formatDateTimeForDisplay(startTime);
    const end = formatDateTimeForDisplay(endTime);
    return `${start} 〜 ${end}`;
  };

  // Get status display info
  const getStatusInfo = () => {
    switch (booking.status) {
      case 'pending':
        return {
          label: '申請中',
          color: 'bg-amber-100 text-amber-800',
          description: '管理者による承認をお待ちください'
        };
      case 'approved':
        return {
          label: '承認済み',
          color: 'bg-green-100 text-green-800',
          description: '予約が承認されました'
        };
      case 'rejected':
        return {
          label: '拒否済み',
          color: 'bg-red-100 text-red-800',
          description: '予約が拒否されました'
        };
      case 'cancelled':
        return {
          label: 'キャンセル済み',
          color: 'bg-gray-100 text-gray-800',
          description: '予約がキャンセルされました'
        };
      default:
        return {
          label: '不明',
          color: 'bg-gray-100 text-gray-800',
          description: ''
        };
    }
  };

  // Get display values
  const bookingTypeInfo = BOOKING_TYPES[booking.bookingType];
  const statusInfo = getStatusInfo();
  const purposeLabel = PURPOSE_OPTIONS.find(opt => opt.value === booking.purpose)?.label || booking.purpose;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* 左側: 予約情報 */}
        <div className="flex-1 space-y-3">
          {/* ステータスと予約タイプ */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              booking.bookingType === 'temporary' 
                ? 'bg-emerald-100 text-emerald-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {bookingTypeInfo.name}
            </span>
            {booking.keepPosition && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                第{booking.keepPosition}キープ
              </span>
            )}
          </div>

          {/* 予約日時 */}
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {formatTimeRange(booking.startTime, booking.endTime)}
            </div>
            <div className="text-sm text-gray-600">
              {purposeLabel}
            </div>
          </div>

          {/* 料金情報 */}
          <div className="text-right sm:text-left">
            <div className="text-lg font-bold text-green-800">
              ¥{booking.totalAmountIncludingTax.toLocaleString()} (税込)
            </div>
            <div className="text-sm text-gray-600">
              ¥{booking.totalAmountExcludingTax.toLocaleString()} (税抜)
            </div>
          </div>
        </div>

        {/* 右側: アクションボタン */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="text-xs text-gray-500 text-right sm:text-left mb-2 sm:mb-0">
            申請日: {formatDateTimeForDisplay(booking.createdAt)}
          </div>
          <Button
            variant="secondary"
            onClick={() => onViewDetails(booking.id)}
            className="min-w-[100px]"
          >
            詳細表示
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BookingHistoryItem;
