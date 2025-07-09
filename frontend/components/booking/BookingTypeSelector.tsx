"use client";

import React from 'react';
import { BOOKING_TYPES } from '../../types/booking';

interface BookingTypeSelectorProps {
  selectedType: 'temporary' | 'confirmed';
  onTypeChange: (type: 'temporary' | 'confirmed') => void;
  error?: string;
}

const BookingTypeSelector: React.FC<BookingTypeSelectorProps> = ({
  selectedType,
  onTypeChange,
  error
}) => {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-3">
        予約タイプ <span className="text-red-500">*</span>
      </label>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 仮予約 */}
        <div
          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
            selectedType === 'temporary'
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-gray-200 hover:border-emerald-300'
          }`}
          onClick={() => onTypeChange('temporary')}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="bookingType"
              value="temporary"
              checked={selectedType === 'temporary'}
              onChange={() => onTypeChange('temporary')}
              className="mt-1 w-4 h-4 text-emerald-600 focus:ring-emerald-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-gray-800">
                  {BOOKING_TYPES.temporary.name}
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full">
                  推奨
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {BOOKING_TYPES.temporary.description}
              </p>
              
              <div className="space-y-2">
                <div>
                  <h4 className="text-xs font-medium text-green-700 mb-1">メリット</h4>
                  <ul className="text-xs text-green-600 space-y-1">
                    {BOOKING_TYPES.temporary.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-center gap-1">
                        <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-xs font-medium text-amber-700 mb-1">注意点</h4>
                  <ul className="text-xs text-amber-600 space-y-1">
                    {BOOKING_TYPES.temporary.limitations.map((limitation, index) => (
                      <li key={index} className="flex items-center gap-1">
                        <span className="w-1 h-1 bg-amber-500 rounded-full"></span>
                        {limitation}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 本予約 */}
        <div
          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
            selectedType === 'confirmed'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-blue-300'
          }`}
          onClick={() => onTypeChange('confirmed')}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="bookingType"
              value="confirmed"
              checked={selectedType === 'confirmed'}
              onChange={() => onTypeChange('confirmed')}
              className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-gray-800">
                  {BOOKING_TYPES.confirmed.name}
                </h3>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  即時確定
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {BOOKING_TYPES.confirmed.description}
              </p>
              
              <div className="space-y-2">
                <div>
                  <h4 className="text-xs font-medium text-blue-700 mb-1">メリット</h4>
                  <ul className="text-xs text-blue-600 space-y-1">
                    {BOOKING_TYPES.confirmed.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-center gap-1">
                        <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-xs font-medium text-red-700 mb-1">キャンセル料</h4>
                  <ul className="text-xs text-red-600 space-y-1">
                    {BOOKING_TYPES.confirmed.limitations.map((limitation, index) => (
                      <li key={index} className="flex items-center gap-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        {limitation}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default BookingTypeSelector;
