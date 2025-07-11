"use client";

import React from 'react';
import { PublicBookingInfo, BOOKING_TYPES } from '../../types/booking';
import Button from '../ui/button';

interface PublicBookingDetailsScreenProps {
  booking: PublicBookingInfo;
  onClose: () => void;
  isLoading?: boolean;
}

const PublicBookingDetailsScreen: React.FC<PublicBookingDetailsScreenProps> = ({
  booking,
  onClose,
  isLoading = false
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

  // Calculate duration in hours
  const calculateDuration = (): number => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    return Number(((end.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(1));
  };

  const duration = calculateDuration();
  const bookingTypeInfo = BOOKING_TYPES[booking.bookingType];

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">予約詳細</h2>
        <p className="text-gray-600">この時間帯は予約済みです</p>
      </div>

      {/* 予約日時情報 */}
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-800 mb-4">予約日時</h3>
        <div className="space-y-2">
          <div className="text-2xl font-bold text-blue-900">
            {formatTimeRange(booking.startTime, booking.endTime)}
          </div>
          <div className="text-blue-700">
            利用時間: {duration}時間
          </div>
        </div>
      </div>

      {/* 予約タイプ情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">予約タイプ</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              booking.bookingType === 'temporary' 
                ? 'bg-emerald-100 text-emerald-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {bookingTypeInfo.name}
            </span>
          </div>
          <p className="text-gray-600">{bookingTypeInfo.description}</p>
        </div>
      </div>

      {/* 予約状態 */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div>
            <h3 className="font-semibold text-gray-800">予約済み</h3>
            <p className="text-sm text-gray-600">
              この時間帯は既に予約が入っています
            </p>
          </div>
        </div>
      </div>

      {/* 注意事項 */}
      <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
        <h3 className="text-lg font-semibold text-yellow-800 mb-3">
          <span className="flex items-center gap-2">
            <span className="text-yellow-600">⚠️</span>
            プライバシー保護について
          </span>
        </h3>
        <p className="text-yellow-700 text-sm">
          個人情報保護のため、予約者の詳細情報は表示されません。
          予約の種類と時間のみ確認できます。
        </p>
      </div>

      {/* 閉じるボタン */}
      <div className="flex justify-center pt-4">
        <Button
          type="button"
          variant="primary"
          onClick={onClose}
          disabled={isLoading}
          className="px-8"
        >
          閉じる
        </Button>
      </div>
    </div>
  );
};

export default PublicBookingDetailsScreen;
