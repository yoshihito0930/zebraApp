"use client";

import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import BookingForm from './BookingForm';
import BookingConfirmationScreen from './BookingConfirmationScreen';
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
  const [currentStep, setCurrentStep] = useState<'form' | 'confirmation'>('form');
  const [formData, setFormData] = useState<BookingFormData | null>(null);

  const handleModalClose = React.useCallback(() => {
    if (!isLoading) {
      setCurrentStep('form');
      setFormData(null);
      onClose();
    }
  }, [isLoading, onClose]);

  const handleFormSubmit = React.useCallback(async (data: BookingFormData): Promise<BookingSubmissionResponse> => {
    // Store form data and move to confirmation step
    setFormData(data);
    setCurrentStep('confirmation');
    
    // Return a temporary success response to prevent the form from showing errors
    return {
      success: true,
      message: 'フォームデータが保存されました'
    };
  }, []);

  const handleConfirmationBack = React.useCallback(() => {
    setCurrentStep('form');
  }, []);

  const handleConfirmationConfirm = React.useCallback(async () => {
    if (formData) {
      // Actually submit the form data
      const response = await onSubmit(formData);
      
      if (response.success) {
        // Reset state and close modal
        setCurrentStep('form');
        setFormData(null);
        onClose();
      }
      
      return response;
    }
  }, [formData, onSubmit, onClose]);

  const handleBackdropClick = React.useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      handleModalClose();
    }
  }, [isLoading, handleModalClose]);

  const handleKeyDown = React.useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isLoading) {
      handleModalClose();
    }
  }, [isLoading, handleModalClose]);

  // Handle modal state reset when modal is closed
  React.useEffect(() => {
    if (!isOpen) {
      setCurrentStep('form');
      setFormData(null);
    }
  }, [isOpen]);

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
  }, [isOpen, handleKeyDown]);

  // Early return after all hooks have been called
  if (!isOpen || !selectedStartTime || !selectedEndTime) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              {currentStep === 'form' ? 'スタジオゼブラ予約申請' : '予約内容の確認'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {currentStep === 'form' 
                ? '以下の情報を入力して予約を申請してください' 
                : '以下の内容で予約を申請します。内容をご確認ください。'}
            </p>
          </div>
          <button
            onClick={handleModalClose}
            disabled={isLoading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="閉じる"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {currentStep === 'form' ? (
            <BookingForm
              selectedStartTime={selectedStartTime}
              selectedEndTime={selectedEndTime}
              onSubmit={handleFormSubmit}
              onCancel={handleModalClose}
              isLoading={isLoading}
            />
          ) : (
            formData && (
              <BookingConfirmationScreen
                formData={formData}
                onBack={handleConfirmationBack}
                onConfirm={handleConfirmationConfirm}
                isLoading={isLoading}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingFormModal;
