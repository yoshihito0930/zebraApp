'use client';

import { useState } from 'react';
import { BookingFilters } from '../page';

interface BookingFiltersProps {
  filters: BookingFilters;
  onFiltersChange: (filters: Partial<BookingFilters>) => void;
  totalCount: number;
  selectedCount: number;
  onBulkApproval: (bookingIds: string[], action: 'approve' | 'reject', reason?: string) => void;
}

export default function BookingFiltersComponent({
  filters,
  onFiltersChange,
  totalCount,
  selectedCount,
  onBulkApproval
}: BookingFiltersProps) {
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');

  const statusOptions = [
    { value: 'all', label: '全て', count: null },
    { value: 'pending', label: '承認待ち', count: null },
    { value: 'expiring', label: '期限切れ間近', count: null },
    { value: 'approved', label: '承認済み', count: null },
    { value: 'rejected', label: '拒否済み', count: null },
    { value: 'cancelled', label: 'キャンセル済み', count: null }
  ];

  const bookingTypeOptions = [
    { value: 'all', label: '全タイプ' },
    { value: 'temporary', label: '仮予約' },
    { value: 'confirmed', label: '本予約' }
  ];

  const sortOptions = [
    { value: 'createdAt', label: '作成日時' },
    { value: 'startTime', label: '予約日時' },
    { value: 'userName', label: 'ユーザー名' },
    { value: 'status', label: 'ステータス' }
  ];

  const handleBulkApprove = () => {
    if (selectedCount > 0) {
      onBulkApproval([], 'approve'); // 実際の選択されたIDを渡す
      setShowBulkActions(false);
    }
  };

  const handleBulkReject = () => {
    if (selectedCount > 0 && bulkRejectReason.trim()) {
      onBulkApproval([], 'reject', bulkRejectReason); // 実際の選択されたIDを渡す
      setBulkRejectReason('');
      setShowBulkActions(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        {/* フィルター行 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* ステータスフィルター */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ステータス
            </label>
            <select
              value={filters.status}
              onChange={(e) => onFiltersChange({ status: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 予約タイプフィルター */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              予約タイプ
            </label>
            <select
              value={filters.bookingType}
              onChange={(e) => onFiltersChange({ bookingType: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {bookingTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* ソート */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              並び順
            </label>
            <div className="flex space-x-2">
              <select
                value={filters.sortBy}
                onChange={(e) => onFiltersChange({ sortBy: e.target.value })}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onFiltersChange({ 
                  sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' 
                })}
                className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                title={filters.sortOrder === 'asc' ? '昇順' : '降順'}
              >
                {filters.sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          {/* 検索 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              検索
            </label>
            <input
              type="text"
              placeholder="ユーザー名、メール、目的で検索"
              value={filters.search}
              onChange={(e) => onFiltersChange({ search: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 検索結果とアクション */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-600">
            {totalCount} 件の予約が見つかりました
            {selectedCount > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                {selectedCount} 件選択中
              </span>
            )}
          </div>

          {/* 一括操作ボタン */}
          {selectedCount > 0 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                一括操作
              </button>
            </div>
          )}
        </div>

        {/* 一括操作パネル */}
        {showBulkActions && selectedCount > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              {selectedCount} 件の予約に対する一括操作
            </h4>
            
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              {/* 一括承認 */}
              <button
                onClick={handleBulkApprove}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
              >
                一括承認
              </button>

              {/* 一括拒否 */}
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="拒否理由を入力"
                  value={bulkRejectReason}
                  onChange={(e) => setBulkRejectReason(e.target.value)}
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm"
                />
                <button
                  onClick={handleBulkReject}
                  disabled={!bulkRejectReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  一括拒否
                </button>
              </div>

              {/* キャンセル */}
              <button
                onClick={() => {
                  setShowBulkActions(false);
                  setBulkRejectReason('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
