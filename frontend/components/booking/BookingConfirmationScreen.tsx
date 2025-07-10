"use client";

import React from 'react';
import { 
  BookingFormData, 
  BOOKING_TYPES, 
  PURPOSE_OPTIONS, 
  USER_COUNT_OPTIONS, 
  HORIZON_PROTECTION_OPTIONS,
  AVAILABLE_BOOKING_OPTIONS,
  STUDIO_PRICING
} from '../../types/booking';
import Button from '../ui/button';

interface BookingConfirmationScreenProps {
  formData: BookingFormData;
  onBack: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

const BookingConfirmationScreen: React.FC<BookingConfirmationScreenProps> = ({
  formData,
  onBack,
  onConfirm,
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
    const start = new Date(formData.startTime);
    const end = new Date(formData.endTime);
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

    if (formData.selectedOptions) {
      formData.selectedOptions.forEach(selectedOption => {
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

  // Get display values
  const duration = calculateDuration();
  const fees = calculateTotalFees();
  const bookingTypeInfo = BOOKING_TYPES[formData.bookingType];
  const purposeLabel = PURPOSE_OPTIONS.find(opt => opt.value === formData.purpose)?.label || formData.purpose;
  const userCountLabel = USER_COUNT_OPTIONS.find(opt => opt.value === formData.userCount.toString())?.label || `${formData.userCount}人`;
  const horizonProtectionLabel = HORIZON_PROTECTION_OPTIONS.find(opt => opt.value === formData.horizonProtection)?.label || formData.horizonProtection;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">予約内容の確認</h2>
        <p className="text-gray-600">以下の内容で予約を申請します。内容をご確認ください。</p>
      </div>

      {/* 予約日時情報 */}
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-800 mb-4">予約日時</h3>
        <div className="space-y-2">
          <div className="text-2xl font-bold text-blue-900">
            {formatTimeRange(formData.startTime, formData.endTime)}
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
              formData.bookingType === 'temporary' 
                ? 'bg-emerald-100 text-emerald-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {bookingTypeInfo.name}
            </span>
          </div>
          <p className="text-gray-600">{bookingTypeInfo.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <h4 className="font-medium text-green-700 mb-2">メリット</h4>
              <ul className="space-y-1">
                {bookingTypeInfo.benefits.map((benefit, index) => (
                  <li key={index} className="text-sm text-green-600 flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-amber-700 mb-2">注意事項</h4>
              <ul className="space-y-1">
                {bookingTypeInfo.limitations.map((limitation, index) => (
                  <li key={index} className="text-sm text-amber-600 flex items-center gap-2">
                    <span className="text-amber-500">•</span>
                    {limitation}
                  </li>
                ))}
              </ul>
            </div>
          </div>
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
          {formData.companyName && (
            <div>
              <label className="block text-sm font-medium text-gray-600">会社名</label>
              <p className="text-gray-900">{formData.companyName}</p>
            </div>
          )}
          {formData.photographerName && (
            <div>
              <label className="block text-sm font-medium text-gray-600">カメラマン氏名</label>
              <p className="text-gray-900">{formData.photographerName}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-600">ホリゾント養生</label>
            <p className="text-gray-900">{horizonProtectionLabel}</p>
          </div>
        </div>
        {formData.specialRequests && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-600">特別なご要望</label>
            <p className="text-gray-900 bg-gray-50 rounded p-3 mt-1">{formData.specialRequests}</p>
          </div>
        )}
      </div>

      {/* 連絡先情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">連絡先情報</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600">お名前</label>
            <p className="text-gray-900">{formData.contactName}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">電話番号</label>
            <p className="text-gray-900">{formData.contactPhone}</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-600">メールアドレス</label>
            <p className="text-gray-900">{formData.contactEmail}</p>
          </div>
        </div>
      </div>

      {/* 選択オプション */}
      {formData.selectedOptions && formData.selectedOptions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">選択オプション</h3>
          <div className="space-y-3">
            {formData.selectedOptions.map((selectedOption, index) => {
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

      {/* キャンセルポリシー */}
      <div className="bg-amber-50 rounded-lg border border-amber-200 p-6">
        <h3 className="text-lg font-semibold text-amber-800 mb-3">キャンセルポリシー</h3>
        {formData.bookingType === 'temporary' ? (
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

      {/* 利用規約確認 */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-sm">✓</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">利用規約への同意</h3>
            <p className="text-gray-600">
              お客様は利用規約に同意されています。予約申請を行うことで、
              利用規約および上記キャンセルポリシーに同意したものとみなされます。
            </p>
          </div>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex gap-4 pt-6">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          disabled={isLoading}
          className="flex-1"
        >
          戻る
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={onConfirm}
          isLoading={isLoading}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? '申請中...' : '予約を申請する'}
        </Button>
      </div>
    </div>
  );
};

export default BookingConfirmationScreen;
