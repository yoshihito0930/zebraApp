'use client';

import { useState } from 'react';
import { BookingListItem } from '../page';

interface BookingApprovalModalProps {
  isOpen: boolean;
  bookingId: string;
  bookingInfo?: BookingListItem;
  action: 'approve' | 'reject';
  onClose: () => void;
  onSubmit: (bookingId: string, action: 'approve' | 'reject', reason?: string) => void;
}

export default function BookingApprovalModal({
  isOpen,
  bookingId,
  bookingInfo,
  action,
  onClose,
  onSubmit
}: BookingApprovalModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (action === 'reject' && !reason.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(bookingId, action, reason);
      setReason('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

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

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              {action === 'approve' ? '予約を承認' : '予約を拒否'}
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 予約情報 */}
          {bookingInfo && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3">予約詳細</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">ユーザー:</span>
                  <span className="ml-2 text-gray-900">{bookingInfo.userName}</span>
                </div>
                <div>
                  <span className="text-gray-500">メール:</span>
                  <span className="ml-2 text-gray-900">{bookingInfo.userEmail}</span>
                </div>
                <div>
                  <span className="text-gray-500">予約タイプ:</span>
                  <span className="ml-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      bookingInfo.bookingType === 'temporary' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {bookingInfo.bookingType === 'temporary' ? '仮予約' : '本予約'}
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">金額:</span>
                  <span className="ml-2 text-gray-900 font-medium">
                    {formatPrice(bookingInfo.totalAmountIncludingTax)}
                  </span>
                </div>
                <div className="md:col-span-2">
                  <span className="text-gray-500">予約日時:</span>
                  <span className="ml-2 text-gray-900">
                    {formatDateTime(bookingInfo.startTime)} - {formatDateTime(bookingInfo.endTime).split(' ')[1]}
                  </span>
                </div>
                <div className="md:col-span-2">
                  <span className="text-gray-500">目的:</span>
                  <span className="ml-2 text-gray-900">{bookingInfo.purpose}</span>
                </div>
                {bookingInfo.keepPosition && (
                  <div>
                    <span className="text-gray-500">Keep位置:</span>
                    <span className="ml-2 text-gray-900">{bookingInfo.keepPosition}</span>
                  </div>
                )}
                {bookingInfo.deadlineAt && (
                  <div>
                    <span className="text-gray-500">期限:</span>
                    <span className="ml-2 text-gray-900">
                      {formatDateTime(bookingInfo.deadlineAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* アクション確認 */}
          <form onSubmit={handleSubmit}>
            {action === 'approve' ? (
              <div className="mb-6">
                <div className="flex items-center p-4 bg-green-50 rounded-lg">
                  <svg className="h-6 w-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      この予約を承認しますか？
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      承認後、ユーザーに通知メールが送信されます。
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <div className="flex items-start p-4 bg-red-50 rounded-lg mb-4">
                  <svg className="h-6 w-6 text-red-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.347 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      この予約を拒否しますか？
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      拒否理由は必須です。ユーザーに拒否理由と共に通知されます。
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                    拒否理由 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="reason"
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="拒否理由を詳しく入力してください..."
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                    required
                  />
                </div>
              </div>
            )}

            {/* ボタン */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={submitting || (action === 'reject' && !reason.trim())}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                  action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    処理中...
                  </div>
                ) : (
                  action === 'approve' ? '承認する' : '拒否する'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
