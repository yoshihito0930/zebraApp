"use client";

import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import BookingForm from './BookingForm';
import { BookingFormData, BookingSubmissionResponse } from '../../types/booking';

interface BookingFormModalProps {
  isOpen: boolean;
  selectedStartTime: Date | null;
  selectedEndTime: Date | null;
  onClose: () => void;
  onSubmit: (data: BookingFormData) => Promise<BookingSubmissionResponse>;
  isLoading?: boolean;
}

const BookingFormModal: React.FC<BookingFormModalProps> = ({
  isOpen,
  selectedStartTime,
  selectedEndTime,
  onClose,
  onSubmit,
  isLoading = false
}) => {
  if (!isOpen || !selectedStartTime || !selectedEndTime) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isLoading) {
      onClose();
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isLoading]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              スタジオゼブラ予約申請
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              以下の情報を入力して予約を申請してください
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="閉じる"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <BookingForm
            selectedStartTime={selectedStartTime}
            selectedEndTime={selectedEndTime}
            onSubmit={onSubmit}
            onCancel={onClose}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default BookingFormModal;
