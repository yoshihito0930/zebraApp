"use client";

import React, { useState, useEffect } from 'react';
import { formatDateTime, formatTimeRange } from '../calendar/calendar-utils';
import BookingTypeSelector from './BookingTypeSelector';
import Button from '../ui/button';
import Input from '../ui/input';
import Select from '../ui/select';
import Textarea from '../ui/textarea';
import { 
  BookingFormData, 
  BookingFormErrors, 
  AvailabilityCheck,
  BookingSubmissionResponse,
  BOOKING_CONSTANTS,
  PURPOSE_OPTIONS,
  USER_COUNT_OPTIONS,
  HORIZON_PROTECTION_OPTIONS
} from '../../types/booking';

interface BookingFormProps {
  selectedStartTime: Date;
  selectedEndTime: Date;
  onSubmit: (data: BookingFormData) => Promise<BookingSubmissionResponse>;
  onCancel: () => void;
  isLoading?: boolean;
}

const BookingForm: React.FC<BookingFormProps> = ({
  selectedStartTime,
  selectedEndTime,
  onSubmit,
  onCancel,
  isLoading = false
}) => {
  // Helper functions for timezone handling
  const formatDateTimeForInput = (date: Date): string => {
    // Convert UTC date to local datetime-local format
    // datetime-local expects local time, so we need to adjust for timezone offset
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return localDate.toISOString().slice(0, 16);
  };

  const parseInputDateTime = (inputValue: string): Date => {
    // Parse datetime-local input and treat it as local time
    const localDate = new Date(inputValue);
    
    // Round minutes to nearest 10-minute increment
    const minutes = localDate.getMinutes();
    const roundedMinutes = Math.round(minutes / 10) * 10;
    localDate.setMinutes(roundedMinutes);
    localDate.setSeconds(0);
    localDate.setMilliseconds(0);
    
    return localDate;
  };

  // Helper function to format date as MM-DD
  const formatDateForDisplay = (date: Date): string => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}`;
  };

  // Helper function to format time range with MM-DD dates
  const formatTimeRangeWithMMDD = (startTime: Date, endTime: Date): string => {
    const startDate = formatDateForDisplay(startTime);
    const endDate = formatDateForDisplay(endTime);
    const startTimeStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;
    const endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
    
    if (startDate === endDate) {
      return `${startDate} ${startTimeStr}〜${endTimeStr}`;
    } else {
      return `${startDate} ${startTimeStr}〜${endDate} ${endTimeStr}`;
    }
  };
  const [formData, setFormData] = useState<BookingFormData>({
    startTime: selectedStartTime.toISOString(),
    endTime: selectedEndTime.toISOString(),
    bookingType: 'temporary',
    purpose: '',
    userCount: 1,
    companyName: '',
    photographerName: '',
    horizonProtection: 'no',
    specialRequests: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    agreeToTerms: false
  });

  const [errors, setErrors] = useState<BookingFormErrors>({});
  const [availabilityCheck, setAvailabilityCheck] = useState<AvailabilityCheck | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Calculate duration based on form data
  const durationHours = Number(
    ((new Date(formData.endTime).getTime() - new Date(formData.startTime).getTime()) / (1000 * 60 * 60)).toFixed(1)
  );

  // Check availability when component mounts or when form times change
  useEffect(() => {
    checkAvailability();
  }, [formData.startTime, formData.endTime]);

  const checkAvailability = async () => {
    setCheckingAvailability(true);
    try {
      const response = await fetch('/api/calendar/available-slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          startTime: formData.startTime,
          endTime: formData.endTime
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAvailabilityCheck(data);
      }
    } catch (error) {
      console.error('Availability check failed:', error);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: BookingFormErrors = {};

    // Required fields validation
    if (!formData.bookingType) {
      newErrors.bookingType = '予約タイプを選択してください';
    }

    if (!formData.purpose) {
      newErrors.purpose = '撮影目的を選択してください';
    }

    if (!formData.contactName.trim()) {
      newErrors.contactName = 'お名前を入力してください';
    }

    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = 'メールアドレスを入力してください';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = '有効なメールアドレスを入力してください';
    }

    if (!formData.contactPhone.trim()) {
      newErrors.contactPhone = '電話番号を入力してください';
    } else if (!/^[\d-+()]+$/.test(formData.contactPhone.replace(/\s/g, ''))) {
      newErrors.contactPhone = '有効な電話番号を入力してください';
    }

    if (!formData.horizonProtection) {
      newErrors.horizonProtection = 'ホリゾント養生の有無を選択してください';
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = '利用規約に同意してください';
    }

    // Business rule validation
    if (durationHours < BOOKING_CONSTANTS.MIN_DURATION_HOURS) {
      newErrors.general = `予約は最低${BOOKING_CONSTANTS.MIN_DURATION_HOURS}時間からご利用いただけます`;
    }

    // Business hours validation
    const formStartTime = new Date(formData.startTime);
    const formEndTime = new Date(formData.endTime);
    const startHour = formStartTime.getHours();
    const endHour = formEndTime.getHours();
    const dayOfWeek = formStartTime.getDay();

    if (!BOOKING_CONSTANTS.BUSINESS_HOURS.DAYS.includes(dayOfWeek)) {
      newErrors.general = '平日（月〜金）のみご利用いただけます';
    } else if (startHour < BOOKING_CONSTANTS.BUSINESS_HOURS.START || endHour > BOOKING_CONSTANTS.BUSINESS_HOURS.END) {
      newErrors.general = `営業時間（${BOOKING_CONSTANTS.BUSINESS_HOURS.START}:00〜${BOOKING_CONSTANTS.BUSINESS_HOURS.END}:00）内でご予約ください`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const response = await onSubmit(formData);
      
      if (!response.success && response.errors) {
        setErrors(response.errors);
      }
    } catch (error) {
      setErrors({ general: '予約申請中にエラーが発生しました' });
    }
  };

  const updateFormData = (field: keyof BookingFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (field in errors) {
      setErrors(prev => ({ ...prev, [field as keyof BookingFormErrors]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Date/Time Summary and Selection */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-2">予約日時</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                開始日時
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="date"
                  value={new Date(formData.startTime).toISOString().split('T')[0]}
                  onChange={(e) => {
                    const currentDate = new Date(formData.startTime);
                    const newDate = new Date(e.target.value + 'T' + currentDate.toTimeString().split(' ')[0]);
                    updateFormData('startTime', newDate.toISOString());
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  min={new Date().toISOString().split('T')[0]}
                />
                <select
                  value={new Date(formData.startTime).getHours()}
                  onChange={(e) => {
                    const currentDate = new Date(formData.startTime);
                    currentDate.setHours(parseInt(e.target.value));
                    updateFormData('startTime', currentDate.toISOString());
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {Array.from({length: 24}, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}時</option>
                  ))}
                </select>
                <select
                  value={new Date(formData.startTime).getMinutes()}
                  onChange={(e) => {
                    const currentDate = new Date(formData.startTime);
                    currentDate.setMinutes(parseInt(e.target.value));
                    currentDate.setSeconds(0);
                    currentDate.setMilliseconds(0);
                    updateFormData('startTime', currentDate.toISOString());
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {[0, 30].map(minute => (
                    <option key={minute} value={minute}>{String(minute).padStart(2, '0')}分</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                終了日時
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="date"
                  value={new Date(formData.endTime).toISOString().split('T')[0]}
                  onChange={(e) => {
                    const currentDate = new Date(formData.endTime);
                    const newDate = new Date(e.target.value + 'T' + currentDate.toTimeString().split(' ')[0]);
                    updateFormData('endTime', newDate.toISOString());
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  min={new Date(formData.startTime).toISOString().split('T')[0]}
                />
                <select
                  value={new Date(formData.endTime).getHours()}
                  onChange={(e) => {
                    const currentDate = new Date(formData.endTime);
                    currentDate.setHours(parseInt(e.target.value));
                    updateFormData('endTime', currentDate.toISOString());
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {Array.from({length: 24}, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}時</option>
                  ))}
                </select>
                <select
                  value={new Date(formData.endTime).getMinutes()}
                  onChange={(e) => {
                    const currentDate = new Date(formData.endTime);
                    currentDate.setMinutes(parseInt(e.target.value));
                    currentDate.setSeconds(0);
                    currentDate.setMilliseconds(0);
                    updateFormData('endTime', currentDate.toISOString());
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {[0, 30].map(minute => (
                    <option key={minute} value={minute}>{String(minute).padStart(2, '0')}分</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            <p>利用時間: {formatTimeRangeWithMMDD(new Date(formData.startTime), new Date(formData.endTime))} ({durationHours}時間)</p>
          </div>
        </div>
        
        {/* Availability Status */}
        {checkingAvailability && (
          <div className="mt-3 text-sm text-blue-600">
            空き状況を確認中...
          </div>
        )}
        
        {availabilityCheck && (
          <div className="mt-3">
            {availabilityCheck.available ? (
              <div className="text-sm text-green-600">
                ✓ 予約可能
                {availabilityCheck.keepPosition && availabilityCheck.keepPosition > 1 && (
                  <span className="ml-2 text-amber-600">
                    (第{availabilityCheck.keepPosition}キープ)
                  </span>
                )}
              </div>
            ) : (
              <div className="text-sm text-red-600">
                × 予約不可 (満員)
              </div>
            )}
          </div>
        )}
      </div>

      {/* General Error */}
      {errors.general && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{errors.general}</p>
        </div>
      )}

      {/* Booking Type Selection */}
      <BookingTypeSelector
        selectedType={formData.bookingType}
        onTypeChange={(type) => updateFormData('bookingType', type)}
        error={errors.bookingType}
      />

      {/* Purpose and Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          id="purpose"
          label="撮影目的"
          options={PURPOSE_OPTIONS}
          value={formData.purpose}
          onChange={(e) => updateFormData('purpose', e.target.value)}
          placeholder="選択してください"
          error={errors.purpose}
          required
        />

        <Select
          id="userCount"
          label="利用人数"
          options={USER_COUNT_OPTIONS}
          value={formData.userCount.toString()}
          onChange={(e) => updateFormData('userCount', parseInt(e.target.value))}
          required
        />
      </div>

      {/* Company and Photographer Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="companyName"
          label="会社名（任意）"
          type="text"
          value={formData.companyName || ''}
          onChange={(e) => updateFormData('companyName', e.target.value)}
          error={errors.companyName}
        />

        <Input
          id="photographerName"
          label="カメラマン氏名（任意）"
          type="text"
          value={formData.photographerName || ''}
          onChange={(e) => updateFormData('photographerName', e.target.value)}
          error={errors.photographerName}
        />
      </div>

      {/* Horizon Protection */}
      <Select
        id="horizonProtection"
        label="ホリゾント養生の有無"
        options={HORIZON_PROTECTION_OPTIONS}
        value={formData.horizonProtection}
        onChange={(e) => updateFormData('horizonProtection', e.target.value)}
        placeholder="選択してください"
        error={errors.horizonProtection}
        required
      />

      {/* Contact Information */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-800">連絡先情報</h3>
        
        <Input
          id="contactName"
          label="お名前"
          type="text"
          value={formData.contactName}
          onChange={(e) => updateFormData('contactName', e.target.value)}
          error={errors.contactName}
          required
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            id="contactEmail"
            label="メールアドレス"
            type="email"
            value={formData.contactEmail}
            onChange={(e) => updateFormData('contactEmail', e.target.value)}
            error={errors.contactEmail}
            required
          />

          <Input
            id="contactPhone"
            label="電話番号"
            type="tel"
            value={formData.contactPhone}
            onChange={(e) => updateFormData('contactPhone', e.target.value)}
            error={errors.contactPhone}
            required
          />
        </div>
      </div>

      {/* Special Requests */}
      <Textarea
        id="specialRequests"
        label="特別なご要望（任意）"
        value={formData.specialRequests || ''}
        onChange={(e) => updateFormData('specialRequests', e.target.value)}
        placeholder="機材や設備に関するご要望があればご記入ください"
        rows={3}
      />

      {/* Terms Agreement */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="agreeToTerms"
          checked={formData.agreeToTerms}
          onChange={(e) => updateFormData('agreeToTerms', e.target.checked)}
          className="mt-1 w-4 h-4 text-primary focus:ring-primary"
        />
        <div className="flex-1">
          <label htmlFor="agreeToTerms" className="text-sm text-gray-700 cursor-pointer">
            <span className="text-red-500">*</span> 利用規約に同意します
          </label>
          {errors.agreeToTerms && (
            <p className="mt-1 text-sm text-red-600">{errors.agreeToTerms}</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1"
        >
          キャンセル
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          disabled={isLoading || !availabilityCheck?.available}
          className="flex-1"
        >
          {isLoading ? '申請中...' : '予約を申請する'}
        </Button>
      </div>
    </form>
  );
};

export default BookingForm;
