'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import BookingApprovalModal from '../components/BookingApprovalModal';

interface BookingDetail {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  bookingType: 'temporary' | 'confirmed';
  startTime: string;
  endTime: string;
  purpose: string;
  userCount: number;
  participants: number;
  equipment: string[];
  companyName?: string;
  photographerName?: string;
  horizonProtection: 'yes' | 'no';
  specialRequests?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  selectedOptions?: Array<{
    optionId: string;
    optionName: string;
    quantity: number;
    variantId?: string;
    variantName?: string;
    pricePerUnit: number;
    totalPrice: number;
  }>;
  totalAmountExcludingTax: number;
  totalAmountIncludingTax: number;
  createdAt: string;
  updatedAt: string;
  keepPosition?: number;
  deadlineAt?: string;
  actionHistory: Array<{
    id: string;
    action: string;
    performedBy: string;
    performedAt: string;
    reason?: string;
  }>;
}

export default function BookingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.id as string;
  
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'reject';
  }>({
    isOpen: false,
    action: 'approve'
  });

  useEffect(() => {
    if (bookingId) {
      fetchBookingDetail();
    }
  }, [bookingId]);

  const fetchBookingDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // TODO: 実際のAPIエンドポイントに接続
      // const response = await fetch(`/api/admin/bookings/${bookingId}`);
      
      // 仮のデータ（開発用）
      const mockData: BookingDetail = {
        id: bookingId,
        userId: 'user1',
        userName: '田中太郎',
        userEmail: 'tanaka@example.com',
        userPhone: '090-1234-5678',
        status: 'pending',
        bookingType: 'temporary',
        startTime: '2025-02-15T10:00:00Z',
        endTime: '2025-02-15T14:00:00Z',
        purpose: 'ポートレート撮影',
        userCount: 3,
        participants: 2,
        equipment: ['三脚', 'レフ板'],
        companyName: '株式会社サンプル',
        photographerName: '山田カメラマン',
        horizonProtection: 'yes',
        specialRequests: '自然光を重視した撮影を希望します。また、撮影後の機材片付けも丁寧にお願いします。',
        contactName: '田中太郎',
        contactEmail: 'tanaka@example.com',
        contactPhone: '090-1234-5678',
        selectedOptions: [
          {
            optionId: 'led-light',
            optionName: 'LEDライト',
            quantity: 2,
            pricePerUnit: 1100,
            totalPrice: 2200
          },
          {
            optionId: 'background-paper',
            optionName: '背景紙(2.72m)',
            quantity: 3,
            variantId: 'white',
            variantName: '白',
            pricePerUnit: 2530,
            totalPrice: 7590
          }
        ],
        totalAmountExcludingTax: 20000,
        totalAmountIncludingTax: 22000,
        createdAt: '2025-01-12T10:30:00Z',
        updatedAt: '2025-01-12T10:30:00Z',
        keepPosition: 1,
        deadlineAt: '2025-02-08T18:00:00Z',
        actionHistory: [
          {
            id: '1',
            action: '予約申請',
            performedBy: '田中太郎',
            performedAt: '2025-01-12T10:30:00Z'
          }
        ]
      };

      setBooking(mockData);
    } catch (err) {
      console.error('Booking detail fetch error:', err);
      setError('予約詳細の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalAction = (action: 'approve' | 'reject') => {
    setApprovalModal({
      isOpen: true,
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
      
      // 成功時は詳細を再取得
      await fetchBookingDetail();
      setApprovalModal({ isOpen: false, action: 'approve' });
      
    } catch (err) {
      console.error('Approval action error:', err);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
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
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles] || styles.pending}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const isNearDeadline = () => {
    if (!booking?.deadlineAt) return false;
    const now = new Date();
    const deadline = new Date(booking.deadlineAt);
    const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilDeadline <= 48 && hoursUntilDeadline > 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.347 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="mt-2 text-sm text-gray-500">{error || '予約が見つかりませんでした'}</p>
        <button
          onClick={() => router.push('/admin/bookings')}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          予約一覧に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/admin/bookings')}
            className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            予約一覧に戻る
          </button>
          <h2 className="text-2xl font-bold text-gray-900">予約詳細</h2>
          <p className="mt-1 text-sm text-gray-500">ID: {booking.id}</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {getStatusBadge(booking.status)}
          {isNearDeadline() && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
              ⚠️ 期限切れ間近
            </span>
          )}
        </div>
      </div>

      {/* アクションボタン */}
      {booking.status === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-yellow-800">承認待ちの予約です</h3>
              <p className="text-sm text-yellow-700 mt-1">
                この予約の承認または拒否を行ってください。
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => handleApprovalAction('approve')}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
              >
                承認する
              </button>
              <button
                onClick={() => handleApprovalAction('reject')}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
              >
                拒否する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 基本情報 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">基本情報</h3>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">予約者情報</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">氏名:</span>
                  <span className="ml-2 text-gray-900">{booking.userName}</span>
                </div>
                <div>
                  <span className="text-gray-500">メール:</span>
                  <span className="ml-2 text-gray-900">{booking.userEmail}</span>
                </div>
                <div>
                  <span className="text-gray-500">電話:</span>
                  <span className="ml-2 text-gray-900">{booking.userPhone}</span>
                </div>
                {booking.companyName && (
                  <div>
                    <span className="text-gray-500">会社名:</span>
                    <span className="ml-2 text-gray-900">{booking.companyName}</span>
                  </div>
                )}
                {booking.photographerName && (
                  <div>
                    <span className="text-gray-500">カメラマン:</span>
                    <span className="ml-2 text-gray-900">{booking.photographerName}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">予約詳細</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">予約タイプ:</span>
                  <span className="ml-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      booking.bookingType === 'temporary' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {booking.bookingType === 'temporary' ? '仮予約' : '本予約'}
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">予約日時:</span>
                  <span className="ml-2 text-gray-900">
                    {formatDateTime(booking.startTime)} - {formatDateTime(booking.endTime).split(' ')[1]}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">目的:</span>
                  <span className="ml-2 text-gray-900">{booking.purpose}</span>
                </div>
                <div>
                  <span className="text-gray-500">利用人数:</span>
                  <span className="ml-2 text-gray-900">{booking.userCount}人</span>
                </div>
                <div>
                  <span className="text-gray-500">参加者数:</span>
                  <span className="ml-2 text-gray-900">{booking.participants}人</span>
                </div>
                {booking.keepPosition && (
                  <div>
                    <span className="text-gray-500">Keep位置:</span>
                    <span className="ml-2 text-gray-900">{booking.keepPosition}</span>
                  </div>
                )}
                {booking.deadlineAt && (
                  <div>
                    <span className="text-gray-500">確定期限:</span>
                    <span className="ml-2 text-gray-900">{formatDateTime(booking.deadlineAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 詳細情報 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">詳細情報</h3>
        </div>
        <div className="px-6 py-4 space-y-6">
          {/* 機材・オプション */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">機材・その他</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">持参機材:</span>
                <span className="ml-2 text-gray-900">
                  {booking.equipment.length > 0 ? booking.equipment.join(', ') : 'なし'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">地平線保護:</span>
                <span className="ml-2 text-gray-900">
                  {booking.horizonProtection === 'yes' ? 'あり' : 'なし'}
                </span>
              </div>
            </div>
          </div>

          {/* 特別要望 */}
          {booking.specialRequests && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">特別要望</h4>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                {booking.specialRequests}
              </p>
            </div>
          )}

          {/* 連絡先情報 */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">連絡先情報</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">担当者名:</span>
                <span className="ml-2 text-gray-900">{booking.contactName}</span>
              </div>
              <div>
                <span className="text-gray-500">メール:</span>
                <span className="ml-2 text-gray-900">{booking.contactEmail}</span>
              </div>
              <div>
                <span className="text-gray-500">電話:</span>
                <span className="ml-2 text-gray-900">{booking.contactPhone}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 選択オプション */}
      {booking.selectedOptions && booking.selectedOptions.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">選択オプション</h3>
          </div>
          <div className="px-6 py-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      オプション名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      バリエーション
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      数量
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      単価
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      小計
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {booking.selectedOptions.map((option, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {option.optionName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {option.variantName || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {option.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPrice(option.pricePerUnit)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPrice(option.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 料金情報 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">料金情報</h3>
        </div>
        <div className="px-6 py-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">小計（税抜）:</span>
              <span className="text-gray-900">{formatPrice(booking.totalAmountExcludingTax)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <span className="text-gray-900">合計（税込）:</span>
              <span className="text-gray-900">{formatPrice(booking.totalAmountIncludingTax)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* アクション履歴 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">アクション履歴</h3>
        </div>
        <div className="px-6 py-4">
          <div className="flow-root">
            <ul className="-mb-8">
              {booking.actionHistory.map((action, index) => (
                <li key={action.id}>
                  <div className="relative pb-8">
                    {index !== booking.actionHistory.length - 1 && (
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" />
                    )}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                          <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 pt-1.5">
                        <div>
                          <p className="text-sm text-gray-500">
                            <span className="font-medium text-gray-900">{action.performedBy}</span>
                            が
                            <span className="font-medium text-gray-900">{action.action}</span>
                            を実行しました
                          </p>
                          {action.reason && (
                            <p className="mt-1 text-sm text-gray-600">
                              理由: {action.reason}
                            </p>
                          )}
                          <p className="mt-0.5 text-xs text-gray-500">
                            {formatDateTime(action.performedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 承認・拒否モーダル */}
      <BookingApprovalModal
        isOpen={approvalModal.isOpen}
        bookingId={booking.id}
        bookingInfo={{
          id: booking.id,
          userId: booking.userId,
          userName: booking.userName,
          userEmail: booking.userEmail,
          status: booking.status,
          bookingType: booking.bookingType,
          startTime: booking.startTime,
          endTime: booking.endTime,
          purpose: booking.purpose,
          totalAmountIncludingTax: booking.totalAmountIncludingTax,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
          keepPosition: booking.keepPosition,
          deadlineAt: booking.deadlineAt
        }}
        action={approvalModal.action}
        onClose={() => setApprovalModal({ isOpen: false, action: 'approve' })}
        onSubmit={handleApprovalSubmit}
      />
    </div>
  );
}
