"use client";

import React from 'react';
import { 
  PrivateBookingDetails, 
  BOOKING_TYPES, 
  PURPOSE_OPTIONS, 
  USER_COUNT_OPTIONS, 
  HORIZON_PROTECTION_OPTIONS,
  AVAILABLE_BOOKING_OPTIONS,
  STUDIO_PRICING
} from '../../types/booking';
import Button from '../ui/button';

interface PrivateBookingDetailsScreenProps {
  booking: PrivateBookingDetails;
  onClose: () => void;
  onCancel?: () => void;
  onModify?: () => void;
  isLoading?: boolean;
}

const PrivateBookingDetailsScreen: React.FC<PrivateBookingDetailsScreenProps> = ({
  booking,
  onClose,
  onCancel,
  onModify,
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

  // Calculate studio fees
  const calculateStudioFees = () => {
    const duration = calculateDuration();
    const excludingTax = STUDIO_PRICING.HOURLY_RATE_EXCLUDING_TAX * duration;
    const includingTax = STUDIO_PRICING.HOURLY_RATE_INCLUDING_TAX * duration;
    return { excludingTax, includingTax, duration };
  };

  // Calculate option fees
  const calculateOptionFees = () => {
    let excludingTax = 0;
    let includingTax = 0;

    if (booking.selectedOptions) {
      booking.selectedOptions.forEach(selectedOption => {
        const option = AVAILABLE_BOOKING_OPTIONS.find(opt => opt.id === selectedOption.optionId);
        if (option) {
          excludingTax += option.priceExcludingTax * selectedOption.quantity;
          includingTax += option.priceIncludingTax * selectedOption.quantity;
        }
      });
    }

    return { excludingTax, includingTax };
  };

  // Calculate total fees
  const calculateTotalFees = () => {
    const studio = calculateStudioFees();
    const options = calculateOptionFees();
    
    return {
      studioFees: studio,
      optionFees: options,
      totalExcludingTax: studio.excludingTax + options.excludingTax,
      totalIncludingTax: studio.includingTax + options.includingTax
    };
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
  const duration = calculateDuration();
  const fees = calculateTotalFees();
  const bookingTypeInfo = BOOKING_TYPES[booking.bookingType];
  const statusInfo = getStatusInfo();
  const purposeLabel = PURPOSE_OPTIONS.find(opt => opt.value === booking.purpose)?.label || booking.purpose;
  const userCountLabel = USER_COUNT_OPTIONS.find(opt => opt.value === booking.userCount.toString())?.label || `${booking.userCount}人`;
  const horizonProtectionLabel = HORIZON_PROTECTION_OPTIONS.find(opt => opt.value === booking.horizonProtection)?.label || booking.horizonProtection;

  // Check if actions are available
  const canCancel = booking.status === 'pending' || booking.status === 'approved';
  const canModify = booking.status === 'pending' && booking.bookingType === 'temporary';

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">予約詳細</h2>
        <p className="text-gray-600">あなたの予約の詳細情報です</p>
      </div>

      {/* 予約ステータス */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">予約ステータス</h3>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          {booking.keepPosition && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              第{booking.keepPosition}キープ
            </span>
          )}
        </div>
        {statusInfo.description && (
          <p className="text-gray-600 mt-2">{statusInfo.description}</p>
        )}
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

      {/* 基本情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">基本情報</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600">撮影目的</label>
            <p className="text-gray-900">{purposeLabel}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">利用人数</label>
            <p className="text-gray-900">{userCountLabel}</p>
          </div>
          {booking.companyName && (
            <div>
              <label className="block text-sm font-medium text-gray-600">会社名</label>
              <p className="text-gray-900">{booking.companyName}</p>
            </div>
          )}
          {booking.photographerName && (
            <div>
              <label className="block text-sm font-medium text-gray-600">カメラマン氏名</label>
              <p className="text-gray-900">{booking.photographerName}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-600">ホリゾント養生</label>
            <p className="text-gray-900">{horizonProtectionLabel}</p>
          </div>
        </div>
        {booking.specialRequests && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-600">特別なご要望</label>
            <p className="text-gray-900 bg-gray-50 rounded p-3 mt-1">{booking.specialRequests}</p>
          </div>
        )}
      </div>

      {/* 連絡先情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">連絡先情報</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600">お名前</label>
            <p className="text-gray-900">{booking.contactName}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">電話番号</label>
            <p className="text-gray-900">{booking.contactPhone}</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-600">メールアドレス</label>
            <p className="text-gray-900">{booking.contactEmail}</p>
          </div>
        </div>
      </div>

      {/* 選択オプション */}
      {booking.selectedOptions && booking.selectedOptions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">選択オプション</h3>
          <div className="space-y-3">
            {booking.selectedOptions.map((selectedOption, index) => {
              const option = AVAILABLE_BOOKING_OPTIONS.find(opt => opt.id === selectedOption.optionId);
              if (!option) return null;

              const variant = selectedOption.variantId && option.variants 
                ? option.variants.find(v => v.id === selectedOption.variantId)
                : null;

              return (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div>
                    <div className="font-medium text-gray-900">
                      {option.name}
                      {variant && <span className="text-gray-600 ml-2">({variant.name})</span>}
                    </div>
                    <div className="text-sm text-gray-600">
                      ¥{option.priceIncludingTax.toLocaleString()} × {selectedOption.quantity}{option.unit}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">
                      ¥{(option.priceIncludingTax * selectedOption.quantity).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 料金詳細 */}
      <div className="bg-green-50 rounded-lg border border-green-200 p-6">
        <h3 className="text-lg font-semibold text-green-800 mb-4">料金詳細</h3>
        <div className="space-y-3">
          {/* スタジオ利用料 */}
          <div className="flex justify-between items-center">
            <div>
              <span className="text-gray-900">スタジオ利用料</span>
              <span className="text-sm text-gray-600 ml-2">({duration}時間)</span>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                ¥{fees.studioFees.excludingTax.toLocaleString()} (税抜)
              </div>
              <div className="font-medium text-gray-900">
                ¥{fees.studioFees.includingTax.toLocaleString()} (税込)
              </div>
            </div>
          </div>

          {/* オプション料金 */}
          {fees.optionFees.includingTax > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-900">オプション料金</span>
              <div className="text-right">
                <div className="text-sm text-gray-600">
                  ¥{fees.optionFees.excludingTax.toLocaleString()} (税抜)
                </div>
                <div className="font-medium text-gray-900">
                  ¥{fees.optionFees.includingTax.toLocaleString()} (税込)
                </div>
              </div>
            </div>
          )}

          {/* 合計 */}
          <div className="border-t border-green-300 pt-3">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-green-800">合計金額</span>
              <div className="text-right">
                <div className="text-sm text-green-600">
                  ¥{fees.totalExcludingTax.toLocaleString()} (税抜)
                </div>
                <div className="text-xl font-bold text-green-800">
                  ¥{fees.totalIncludingTax.toLocaleString()} (税込)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 予約履歴 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">予約履歴</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">予約申請日時</span>
            <span className="text-gray-900">{formatDateTimeForDisplay(booking.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">最終更新日時</span>
            <span className="text-gray-900">{formatDateTimeForDisplay(booking.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* キャンセルポリシー */}
      <div className="bg-amber-50 rounded-lg border border-amber-200 p-6">
        <h3 className="text-lg font-semibold text-amber-800 mb-3">キャンセルポリシー</h3>
        {booking.bookingType === 'temporary' ? (
          <div className="text-amber-700">
            <p>仮予約の場合、利用7日前18:00までのキャンセルは無料です。</p>
            <p className="mt-1">期限を過ぎると自動的にキャンセルされます。</p>
          </div>
        ) : (
          <div className="text-amber-700">
            <p>本予約の場合、以下のキャンセル料が発生します：</p>
            <ul className="mt-2 space-y-1 ml-4">
              <li>• 利用6～4日前：料金の50%</li>
              <li>• 利用3～1日前：料金の80%</li>
              <li>• 利用当日：料金の100%</li>
            </ul>
          </div>
        )}
      </div>

      {/* アクションボタン */}
      <div className="flex gap-4 pt-6">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={isLoading}
          className="flex-1"
        >
          閉じる
        </Button>
        
        {canModify && onModify && (
          <Button
            type="button"
            variant="secondary"
            onClick={onModify}
            disabled={isLoading}
            className="flex-1"
          >
            変更申請
          </Button>
        )}
        
        {canCancel && onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
          >
            キャンセル申請
          </Button>
        )}
      </div>
    </div>
  );
};

export default PrivateBookingDetailsScreen;
