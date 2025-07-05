"use client";

import React from 'react';
import { Calendar } from '../../components/calendar';

export default function CalendarPage() {
  const handleDateSelect = (start: Date, end: Date) => {
    console.log('Date selected:', { start, end });
    // TODO: 予約フォームへのナビゲーション
  };

  const handleEventClick = (eventInfo: any) => {
    console.log('Event clicked:', eventInfo);
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            スタジオ予約カレンダー
          </h1>
          <p className="text-gray-600">
            空き状況の確認と予約の管理ができます
          </p>
        </div>

        {/* 凡例 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">予約ステータス</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-500 rounded"></div>
              <span>承認済み仮予約</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span>承認済み本予約</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-500 rounded"></div>
              <span>申請中</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>拒否済み</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-400 rounded"></div>
              <span>キャンセル済み</span>
            </div>
          </div>
        </div>

        {/* カレンダー */}
        <Calendar
          height="auto"
          initialView="dayGridMonth"
          onDateSelect={handleDateSelect}
          onEventClick={handleEventClick}
          showToolbar={true}
          editable={true}
          className="mb-8"
        />

        {/* 使用方法 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              予約を確認する
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• カレンダー上の予約をクリックして詳細を確認</li>
              <li>• 月間・週間・日間ビューで切り替え可能</li>
              <li>• 色分けでステータスを一目で確認</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              新規予約を申請する
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• 空いている日時をクリック</li>
              <li>• 予約フォームから申請を送信</li>
              <li>• 仮予約または本予約を選択可能</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
