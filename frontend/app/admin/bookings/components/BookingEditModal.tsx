'use client';

import { useState, useEffect } from 'react';
import { BookingListItem } from '../page';

interface BookingOption {
  id: string;
  name: string;
  price: number;
}

interface BookingEditModalProps {
  isOpen: boolean;
  booking: BookingListItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BookingEditModal({
  isOpen,
  booking,
  onClose,
  onSuccess
}: BookingEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [availableOptions, setAvailableOptions] = useState<BookingOption[]>([]);
  
  const [formData, setFormData] = useState({
    startTime: '',
    endTime: '',
    bookingType: 'confirmed' as 'temporary' | 'confirmed',
    purpose: '',
    notes: '',
    status: 'pending' as 'pending' | 'approved' | 'rejected' | 'cancelled',
    optionIds: [] as string[]
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    if (isOpen && booking) {
      // 既存予約データで初期化
      const startDate = new Date(booking.startTime);
      const endDate = new Date(booking.endTime);
      
      setFormData({
        startTime: formatDateTimeLocal(startDate),
        endTime: formatDateTimeLocal(endDate),
        bookingType: booking.bookingType,
        purpose: booking.purpose,
        notes: '', // 既存データにnotesがある場合は設定
        status: booking.status,
        optionIds: [] // TODO: 既存オプションがある場合は設定
      });
      
      setErrors({});
      fetchOptions();
    }
  }, [isOpen, booking]);

  const formatDateTimeLocal = (date: Date): string => {
    // datetime-local形式に変換 (YYYY-MM-DDTHH:mm)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const fetchOptions = async () => {
    try {
      // TODO: 実際のAPIエンドポイントに接続
      const mockOptions: BookingOption[] = [
        { id: '1', name: '追加照明', price: 3000 },
        { id: '2', name: '衣装レンタル', price: 5000 },
        { id: '3', name: 'メイクサービス', price: 8000 },
        { id: '4', name: 'データ追加納品', price: 2000 }
      ];
      setAvailableOptions(mockOptions);
    } catch (err) {
      console.error('オプション取得エラー:', err);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.startTime) {
      newErrors.startTime = '開始時間は必須です';
    }
    if (!formData.endTime) {
      newErrors.endTime = '終了時間は必須です';
    }
    
    if (formData.startTime && formData.endTime) {
      const start = new Date(formData.startTime);
      const end = new Date(formData.endTime);
      if (end <= start) {
        newErrors.endTime = '終了時間は開始時間より後である必要があります';
      }
    }

    if (!formData.purpose.trim()) {
      newErrors.purpose = '撮影目的は必須です';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkAvailability = async (startTime: string, endTime: string): Promise<boolean> => {
    try {
      // TODO: 実際のAPIエンドポイントに接続
      // const response = await fetch(
      //   `/api/admin/bookings/availability?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&excludeBookingId=${booking?.id}`
      // );
      // const data = await response.json();
      // return data.available;
      
      // 仮の実装: 常に利用可能とする
      return true;
    } catch (err) {
      console.error('空き状況確認エラー:', err);
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm() || !booking) return;

    try {
      setLoading(true);

      // 時間変更がある場合は空き状況をチェック
      const originalStart = formatDateTimeLocal(new Date(booking.startTime));
      const originalEnd = formatDateTimeLocal(new Date(booking.endTime));
      
      if (formData.startTime !== originalStart || formData.endTime !== originalEnd) {
        const startTimeISO = new Date(formData.startTime).toISOString();
        const endTimeISO = new Date(formData.endTime).toISOString();
        
        const available = await checkAvailability(startTimeISO, endTimeISO);
        if (!available) {
          setErrors({ 
            submit: '選択された時間帯には既に他の予約があります' 
          });
          return;
        }
      }

      const updateData = {
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        bookingType: formData.bookingType,
        purpose: formData.purpose,
        notes: formData.notes,
        status: formData.status,
        optionIds: formData.optionIds
      };

      // TODO: 実際のAPIエンドポイントに接続
      // const response = await fetch(`/api/admin/bookings/${booking.id}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(updateData)
      // });

      console.log('予約更新:', updateData);
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error('予約更新エラー:', err);
      setErrors({ submit: '予約の更新に失敗しました' });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalPrice = () => {
    return formData.optionIds.reduce((total, optionId) => {
      const option = availableOptions.find(opt => opt.id === optionId);
      return total + (option?.price || 0);
    }, 0);
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: '承認待ち',
      approved: '承認済み',
      rejected: '拒否済み',
      cancelled: 'キャンセル済み'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getBookingTypeLabel = (type: string) => {
    const labels = {
      temporary: '仮予約',
      confirmed: '本予約'
    };
    return labels[type as keyof typeof labels] || type;
  };

  if (!isOpen || !booking) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                予約編集
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {booking.userName} ({booking.userEmail})
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 基本情報 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">基本情報</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  開始時間 *
                </label>
                <input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.startTime && (
                  <p className="text-red-600 text-sm mt-1">{errors.startTime}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  終了時間 *
                </label>
                <input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.endTime && (
                  <p className="text-red-600 text-sm mt-1">{errors.endTime}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  予約タイプ
                </label>
                <select
                  value={formData.bookingType}
                  onChange={(e) => setFormData(prev => ({ ...prev, bookingType: e.target.value as 'temporary' | 'confirmed' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="confirmed">本予約</option>
                  <option value="temporary">仮予約</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  現在: {getBookingTypeLabel(booking.bookingType)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ステータス
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="pending">承認待ち</option>
                  <option value="approved">承認済み</option>
                  <option value="rejected">拒否済み</option>
                  <option value="cancelled">キャンセル済み</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  現在: {getStatusLabel(booking.status)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  撮影目的 *
                </label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                  placeholder="例: ポートレート撮影"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.purpose && (
                  <p className="text-red-600 text-sm mt-1">{errors.purpose}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  備考・メモ
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* オプションと料金 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">オプション・料金</h3>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">オプション選択</h4>
                <div className="space-y-2">
                  {availableOptions.map((option) => (
                    <label key={option.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.optionIds.includes(option.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              optionIds: [...prev.optionIds, option.id]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              optionIds: prev.optionIds.filter(id => id !== option.id)
                            }));
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {option.name} (+{option.price.toLocaleString()}円)
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-md">
                <h4 className="font-medium text-gray-900 mb-2">料金情報</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>オプション合計:</span>
                    <span>{calculateTotalPrice().toLocaleString()}円</span>
                  </div>
                  <div className="flex justify-between">
                    <span>現在の総額:</span>
                    <span>{booking.totalAmountIncludingTax.toLocaleString()}円</span>
                  </div>
                </div>
              </div>

              {/* 予約情報サマリー */}
              <div className="p-4 bg-blue-50 rounded-md">
                <h4 className="font-medium text-blue-900 mb-2">予約情報</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>作成日時: {new Date(booking.createdAt).toLocaleString('ja-JP')}</p>
                  <p>更新日時: {new Date(booking.updatedAt).toLocaleString('ja-JP')}</p>
                  {booking.keepPosition && (
                    <p>Keep順位: {booking.keepPosition}</p>
                  )}
                  {booking.deadlineAt && (
                    <p>期限: {new Date(booking.deadlineAt).toLocaleString('ja-JP')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {errors.submit && (
            <div className="mt-6 p-4 bg-red-50 rounded-md">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '更新中...' : '更新'}
          </button>
        </div>
      </div>
    </div>
  );
}
