// Booking form data types
export interface BookingFormData {
  startTime: string;
  endTime: string;
  bookingType: 'temporary' | 'confirmed';
  purpose: string;
  userCount: number;
  companyName?: string;
  photographerName?: string;
  horizonProtection: 'yes' | 'no';
  specialRequests?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  agreeToTerms: boolean;
}

export interface BookingFormErrors {
  startTime?: string;
  endTime?: string;
  bookingType?: string;
  purpose?: string;
  userCount?: string;
  companyName?: string;
  photographerName?: string;
  horizonProtection?: string;
  specialRequests?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  agreeToTerms?: string;
  general?: string;
}

export interface AvailabilityCheck {
  available: boolean;
  keepPosition?: number; // 1 = first booking, 2 = second keep, 3 = third keep
  maxKeepPosition: number;
  conflictingBookings?: Array<{
    id: string;
    userName: string;
    bookingType: string;
    keepPosition: number;
  }>;
}

export interface BookingSubmissionResponse {
  success: boolean;
  bookingId?: string;
  keepPosition?: number;
  message: string;
  errors?: BookingFormErrors;
}

// Business rule constants
export const BOOKING_CONSTANTS = {
  MIN_DURATION_HOURS: 2,
  INTERVAL_MINUTES: 60, // 1 hour intervals
  BUSINESS_HOURS: {
    START: 9,
    END: 22,
    DAYS: [1, 2, 3, 4, 5] // Monday to Friday
  },
  MAX_KEEP_POSITIONS: 3,
  TEMPORARY_BOOKING_DEADLINE_DAYS: 7
};

// Booking type information
export const BOOKING_TYPES = {
  temporary: {
    name: '仮予約',
    description: '利用7日前18:00までに本予約への変更が必要',
    benefits: [
      'キャンセル料なし',
      '本予約への変更可能'
    ],
    limitations: [
      '7日前18:00までに要確定',
      '未確定の場合自動キャンセル'
    ]
  },
  confirmed: {
    name: '本予約',
    description: '即座に確定される予約',
    benefits: [
      '即座に確定',
      '期限なし',
    ],
    limitations: [
      'キャンセル料適用',
      '～4日前: 50%',
      '3～1日前: 80%',
      '当日: 100%'
    ]
  }
};

// Purpose options
export const PURPOSE_OPTIONS = [
  { value: 'portrait', label: 'ポートレート撮影' },
  { value: 'fashion', label: 'ファッション撮影' },
  { value: 'product', label: '商品撮影' },
  { value: 'event', label: 'イベント撮影' },
  { value: 'family', label: '家族写真' },
  { value: 'business', label: 'ビジネス撮影' },
  { value: 'other', label: 'その他' }
];

// User count options
export const USER_COUNT_OPTIONS = [
  { value: '1', label: '1人' },
  { value: '2', label: '2人' },
  { value: '3', label: '3人' },
  { value: '4', label: '4人' },
  { value: '5', label: '5人' },
  { value: '6', label: '6人' },
  { value: '7', label: '7人' },
  { value: '8', label: '8人' },
  { value: '9', label: '9人' },
  { value: '10', label: '10人' },
  { value: '11', label: '11人以上' }
];

// Horizon protection options
export const HORIZON_PROTECTION_OPTIONS = [
  { value: 'yes', label: 'あり' },
  { value: 'no', label: 'なし' }
];
