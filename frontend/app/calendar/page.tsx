"use client";

import React, { useState } from 'react';
import { Calendar } from '../../components/calendar';
import { BookingFormModal } from '../../components/booking';
import { BookingFormData, BookingSubmissionResponse } from '../../types/booking';

export default function CalendarPage() {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedStartTime, setSelectedStartTime] = useState<Date | null>(null);
  const [selectedEndTime, setSelectedEndTime] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDateSelect = (start: Date, end: Date) => {
    console.log('Date selected:', { start, end });
    
    let adjustedStart = start;
    let adjustedEnd = end;
    
    // Check if this is a full-day selection (typical for monthly view)
    const isFullDaySelection = 
      start.getHours() === 0 && start.getMinutes() === 0 && 
      end.getHours() === 0 && end.getMinutes() === 0 &&
      (end.getTime() - start.getTime()) >= (24 * 60 * 60 * 1000 - 1);
    
    if (isFullDaySelection) {
      // For monthly view selections, set default business hours
      adjustedStart = new Date(start);
      adjustedStart.setHours(9, 0, 0, 0); // Default start: 9:00 AM
      
      adjustedEnd = new Date(start);
      adjustedEnd.setHours(11, 0, 0, 0); // Default end: 11:00 AM (2 hours)
    } else {
      // For time-based selections (week/day view), ensure minimum duration
      const minDuration = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
      const selectedDuration = end.getTime() - start.getTime();
      
      if (selectedDuration < minDuration) {
        adjustedEnd = new Date(start.getTime() + minDuration);
      }
    }
    
    setSelectedStartTime(adjustedStart);
    setSelectedEndTime(adjustedEnd);
    setIsBookingModalOpen(true);
  };

  const handleEventClick = (eventInfo: any) => {
    console.log('Event clicked:', eventInfo);
  };

  const handleBookingSubmit = async (formData: BookingFormData): Promise<BookingSubmissionResponse> => {
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (response.ok) {
        // Success - close modal and refresh calendar
        setIsBookingModalOpen(false);
        
        // Show success message
        alert(`予約申請が完了しました。${data.keepPosition ? `第${data.keepPosition}キープとして` : ''}受付いたします。`);
        
        // Refresh the calendar to show the new booking
        window.location.reload();
        
        return {
          success: true,
          bookingId: data.bookingId,
          keepPosition: data.keepPosition,
          message: data.message
        };
      } else {
        return {
          success: false,
          message: data.message || '予約申請に失敗しました',
          errors: data.errors
        };
      }
    } catch (error) {
      console.error('Booking submission error:', error);
      return {
        success: false,
        message: 'ネットワークエラーが発生しました'
      };
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeBookingModal = () => {
    if (!isSubmitting) {
      setIsBookingModalOpen(false);
      setSelectedStartTime(null);
      setSelectedEndTime(null);
    }
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
              <li>• 空いている日時をドラッグして選択</li>
              <li>• 予約フォームが自動で開きます</li>
              <li>• 仮予約または本予約を選択可能</li>
              <li>• 最低2時間からご利用いただけます</li>
              <li>• 営業時間：平日9:00-22:00</li>
            </ul>
          </div>
        </div>

        {/* Booking Form Modal */}
        <BookingFormModal
          isOpen={isBookingModalOpen}
          selectedStartTime={selectedStartTime}
          selectedEndTime={selectedEndTime}
          onClose={closeBookingModal}
          onSubmit={handleBookingSubmit}
          isLoading={isSubmitting}
        />
      </div>
    </div>
  );
}
