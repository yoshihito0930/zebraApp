"use client";

import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface CalendarToolbarProps {
  currentView: string;
  currentDate: Date;
  onViewChange: (view: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const CalendarToolbar: React.FC<CalendarToolbarProps> = ({
  currentView,
  currentDate,
  onViewChange,
  onPrev,
  onNext,
  onToday
}) => {
  const formatTitle = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    switch (currentView) {
      case 'dayGridMonth':
        return `${year}年${month}月`;
      case 'timeGridWeek':
        return `${year}年${month}月 (週間表示)`;
      case 'timeGridDay':
        return currentDate.toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long'
        });
      default:
        return `${year}年${month}月`;
    }
  };

  const viewButtons = [
    { key: 'dayGridMonth', label: '月', fullLabel: '月間' },
    { key: 'timeGridWeek', label: '週', fullLabel: '週間' },
    { key: 'timeGridDay', label: '日', fullLabel: '日間' }
  ];

  return (
    <div className="calendar-toolbar bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* 左側: ナビゲーションと今日ボタン */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="前へ"
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          
          <button
            onClick={onNext}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="次へ"
          >
            <ChevronRightIcon className="w-5 h-5 text-gray-600" />
          </button>
          
          <button
            onClick={onToday}
            className="px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors ml-2"
          >
            今日
          </button>
        </div>

        {/* 中央: タイトル */}
        <div className="flex-1 text-center">
          <h2 className="text-lg font-semibold text-gray-800">
            {formatTitle()}
          </h2>
        </div>

        {/* 右側: ビュー切替 */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {viewButtons.map((button) => (
            <button
              key={button.key}
              onClick={() => onViewChange(button.key)}
              className={`
                px-3 py-2 text-sm rounded-md transition-colors
                ${currentView === button.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                }
              `}
              aria-label={`${button.fullLabel}表示に切り替え`}
            >
              <span className="sm:hidden">{button.label}</span>
              <span className="hidden sm:inline">{button.fullLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* モバイル用の追加情報 */}
      <div className="mt-3 sm:hidden">
        <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-emerald-500 rounded"></div>
            <span>仮予約</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>本予約</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-500 rounded"></div>
            <span>申請中</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarToolbar;
