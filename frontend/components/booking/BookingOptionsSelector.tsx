"use client";

import React from 'react';
import { BookingOption, SelectedOption, AVAILABLE_BOOKING_OPTIONS } from '../../types/booking';
import Button from '../ui/button';
import Select from '../ui/select';

interface BookingOptionsSelectorProps {
  selectedOptions: SelectedOption[];
  onOptionsChange: (options: SelectedOption[]) => void;
}

const BookingOptionsSelector: React.FC<BookingOptionsSelectorProps> = ({
  selectedOptions,
  onOptionsChange
}) => {
  // Helper function to get selected option by ID
  const getSelectedOption = (optionId: string): SelectedOption | undefined => {
    return selectedOptions.find(option => option.optionId === optionId);
  };

  // Helper function to update option quantity
  const updateOptionQuantity = (optionId: string, quantity: number, variantId?: string) => {
    const newOptions = [...selectedOptions];
    const existingIndex = newOptions.findIndex(option => option.optionId === optionId);

    if (quantity === 0) {
      // Remove option if quantity is 0
      if (existingIndex !== -1) {
        newOptions.splice(existingIndex, 1);
      }
    } else {
      // Add or update option
      const newOption: SelectedOption = {
        optionId,
        quantity,
        variantId
      };

      if (existingIndex !== -1) {
        newOptions[existingIndex] = newOption;
      } else {
        newOptions.push(newOption);
      }
    }

    onOptionsChange(newOptions);
  };

  // Helper function to update variant selection
  const updateOptionVariant = (optionId: string, variantId: string) => {
    const selectedOption = getSelectedOption(optionId);
    if (selectedOption) {
      updateOptionQuantity(optionId, selectedOption.quantity, variantId);
    }
  };

  // Calculate total price
  const calculateTotalPrice = () => {
    let totalExcludingTax = 0;
    let totalIncludingTax = 0;

    selectedOptions.forEach(selectedOption => {
      const option = AVAILABLE_BOOKING_OPTIONS.find(opt => opt.id === selectedOption.optionId);
      if (option) {
        totalExcludingTax += option.priceExcludingTax * selectedOption.quantity;
        totalIncludingTax += option.priceIncludingTax * selectedOption.quantity;
      }
    });

    return { totalExcludingTax, totalIncludingTax };
  };

  const { totalExcludingTax, totalIncludingTax } = calculateTotalPrice();

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-4">オプション選択</h3>
        <div className="space-y-4">
          {AVAILABLE_BOOKING_OPTIONS.map((option: BookingOption) => {
            const selectedOption = getSelectedOption(option.id);
            const quantity = selectedOption?.quantity || 0;
            const selectedVariantId = selectedOption?.variantId;

            return (
              <div key={option.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{option.name}</h4>
                    <div className="text-sm text-gray-600 mt-1">
                      <span className="text-gray-500">¥{option.priceExcludingTax.toLocaleString()}</span>
                      <span className="ml-2 font-medium text-gray-900">
                        (税込¥{option.priceIncludingTax.toLocaleString()})
                      </span>
                      <span className="ml-1">/ {option.unit}</span>
                    </div>
                  </div>
                </div>

                {/* Variant selection for Kent Paper */}
                {option.variants && quantity > 0 && (
                  <div className="mb-3">
                    <Select
                      id={`variant-${option.id}`}
                      label="色を選択"
                      options={option.variants.map(variant => ({
                        value: variant.id,
                        label: variant.name
                      }))}
                      value={selectedVariantId || ''}
                      onChange={(e) => updateOptionVariant(option.id, e.target.value)}
                      placeholder="色を選択してください"
                      required={quantity > 0}
                    />
                  </div>
                )}

                {/* Quantity selector */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => updateOptionQuantity(option.id, Math.max(0, quantity - 1), selectedVariantId)}
                      disabled={quantity === 0}
                      className="w-8 h-8 p-0 flex items-center justify-center"
                    >
                      -
                    </Button>
                    
                    <span className="w-12 text-center font-medium">
                      {quantity}
                    </span>
                    
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => updateOptionQuantity(option.id, Math.min(option.maxQuantity || 99, quantity + 1), selectedVariantId)}
                      disabled={quantity >= (option.maxQuantity || 99)}
                      className="w-8 h-8 p-0 flex items-center justify-center"
                    >
                      +
                    </Button>
                  </div>

                  {quantity > 0 && (
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        小計: ¥{(option.priceExcludingTax * quantity).toLocaleString()}
                      </div>
                      <div className="font-medium text-gray-900">
                        (税込¥{(option.priceIncludingTax * quantity).toLocaleString()})
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Total price display */}
        {selectedOptions.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">オプション合計</span>
                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    ¥{totalExcludingTax.toLocaleString()} (税抜)
                  </div>
                  <div className="text-lg font-bold text-green-700">
                    ¥{totalIncludingTax.toLocaleString()} (税込)
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedOptions.length === 0 && (
          <div className="mt-4 text-center text-gray-500 text-sm">
            オプションを選択してください（任意）
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingOptionsSelector;
