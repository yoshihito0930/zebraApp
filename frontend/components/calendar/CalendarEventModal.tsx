"use client";

import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { CalendarEvent } from './calendar-utils';
import { getStatusText, getBookingTypeText, formatDateTime, formatTimeRange } from './calendar-utils';

interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
}

const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  isOpen,
  onClose,
  event
}) => {
  if (!isOpen || !event) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getBookingTypeBadgeClass = (bookingType: string) => {
    switch (bookingType) {
      case 'temporary':
        return 'bg-emerald-100 text-emerald-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            予約詳細
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="閉じる"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 space-y-4">
          {/* ステータスと予約タイプ */}
          <div className="flex gap-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(event.extendedProps.status)}`}>
              {getStatusText(event.extendedProps.status)}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getBookingTypeBadgeClass(event.extendedProps.bookingType)}`}>
              {getBookingTypeText(event.extendedProps.bookingType)}
            </span>
          </div>

          {/* 基本情報 */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                予約者名
              </label>
              <p className="text-gray-800">{event.extendedProps.userName}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                撮影目的
              </label>
              <p className="text-gray-800">{event.extendedProps.purpose}</p>
            </div>

            {event.extendedProps.photographerName && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  カメラマン
                </label>
                <p className="text-gray-800">{event.extendedProps.photographerName}</p>
              </div>
            )}
          </div>

          {/* 日時情報 */}
          <div className="border-t border-gray-200 pt-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  開始日時
                </label>
                <p className="text-gray-800">{formatDateTime(event.start)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  終了日時
                </label>
                <p className="text-gray-800">{formatDateTime(event.end)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  利用時間
                </label>
                <p className="text-gray-800">{formatTimeRange(event.start, event.end)}</p>
              </div>
            </div>
          </div>

          {/* 申請情報 */}
          <div className="border-t border-gray-200 pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                申請日時
              </label>
              <p className="text-sm text-gray-600">
                {formatDateTime(event.extendedProps.createdAt)}
              </p>
            </div>
          </div>

          {/* 予約ID */}
          <div className="border-t border-gray-200 pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                予約ID
              </label>
              <p className="text-xs text-gray-500 font-mono break-all">
                {event.id}
              </p>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              閉じる
            </button>
            
            {/* 将来的に編集や操作ボタンを追加する場合 */}
            {event.extendedProps.status === 'pending' && (
              <button
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors"
                onClick={() => {
                  // TODO: 予約詳細ページや編集ページへのリンク
                  console.log('Edit booking:', event.id);
                }}
              >
                詳細を見る
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarEventModal;
