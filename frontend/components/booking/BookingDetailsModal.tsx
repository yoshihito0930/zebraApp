"use client";

import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import PublicBookingDetailsScreen from './PublicBookingDetailsScreen';
import PrivateBookingDetailsScreen from './PrivateBookingDetailsScreen';
import { 
  BookingDetailsResponse, 
  PublicBookingInfo, 
  PrivateBookingDetails 
} from '../../types/booking';

interface BookingDetailsModalProps {
  isOpen: boolean;
  bookingId: string | null;
  onClose: () => void;
  onCancel?: (bookingId: string) => void;
  onModify?: (bookingId: string) => void;
}

const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  isOpen,
  bookingId,
  onClose,
  onCancel,
  onModify
}) => {
  const [bookingDetails, setBookingDetails] = useState<BookingDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleModalClose = React.useCallback(() => {
    if (!isLoading) {
      setBookingDetails(null);
      setError(null);
      onClose();
    }
  }, [isLoading, onClose]);

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

  const handleCancel = React.useCallback(() => {
    if (bookingId && onCancel) {
      onCancel(bookingId);
    }
  }, [bookingId, onCancel]);

  const handleModify = React.useCallback(() => {
    if (bookingId && onModify) {
      onModify(bookingId);
    }
  }, [bookingId, onModify]);

  // Fetch booking details when modal opens
  useEffect(() => {
    if (isOpen && bookingId) {
      const fetchBookingDetails = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
          const response = await fetch(`/api/bookings/${bookingId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (response.ok) {
            const data: BookingDetailsResponse = await response.json();
            setBookingDetails(data);
          } else {
            const errorData = await response.json();
            setError(errorData.message || '予約詳細の取得に失敗しました');
          }
        } catch (error) {
          console.error('Booking details fetch error:', error);
          setError('ネットワークエラーが発生しました');
        } finally {
          setIsLoading(false);
        }
      };

      fetchBookingDetails();
    }
  }, [isOpen, bookingId]);

  // Handle modal state reset when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setBookingDetails(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
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
  if (!isOpen || !bookingId) {
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
              予約詳細
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {bookingDetails?.isOwnBooking 
                ? 'あなたの予約の詳細情報です' 
                : 'この時間帯の予約情報です'}
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
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">読み込み中...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <div className="text-red-600 font-medium mb-2">エラーが発生しました</div>
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={handleModalClose}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                閉じる
              </button>
            </div>
          )}

          {bookingDetails && !isLoading && !error && (
            <>
              {bookingDetails.isOwnBooking ? (
                <PrivateBookingDetailsScreen
                  booking={bookingDetails.booking as PrivateBookingDetails}
                  onClose={handleModalClose}
                  onCancel={handleCancel}
                  onModify={handleModify}
                  isLoading={isLoading}
                />
              ) : (
                <PublicBookingDetailsScreen
                  booking={bookingDetails.booking as PublicBookingInfo}
                  onClose={handleModalClose}
                  isLoading={isLoading}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingDetailsModal;
