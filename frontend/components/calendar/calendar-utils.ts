// カレンダーコンポーネント用のユーティリティ関数

export interface BookingData {
  id: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime: string;
  status: string;
  bookingType: string;
  purpose: string;
  photographerName: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    userId: string;
    userName: string;
    status: string;
    bookingType: string;
    purpose: string;
    photographerName: string;
    createdAt: string;
  };
}

export interface AvailabilitySlot {
  start: string;
  end: string;
  available: boolean;
  type: string; // 'business_hours', 'break', 'blocked'
}

export interface CalendarApiResponse {
  events: CalendarEvent[];
  availability: AvailabilitySlot[];
}

// 予約ステータスとタイプに基づいてイベントの色を決定
export function getEventColor(status: string, bookingType: string): {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
} {
  let backgroundColor: string;
  let borderColor: string;
  const textColor = '#FFFFFF';

  switch (status) {
    case 'cancelled':
      backgroundColor = '#9CA3AF'; // gray-400
      borderColor = '#6B7280'; // gray-500
      break;
    case 'approved':
      if (bookingType === 'temporary') {
        backgroundColor = '#10B981'; // emerald-500
        borderColor = '#059669'; // emerald-600
      } else {
        backgroundColor = '#3B82F6'; // blue-500
        borderColor = '#2563EB'; // blue-600
      }
      break;
    case 'pending':
      backgroundColor = '#F59E0B'; // amber-500
      borderColor = '#D97706'; // amber-600
      break;
    case 'rejected':
      backgroundColor = '#EF4444'; // red-500
      borderColor = '#DC2626'; // red-600
      break;
    default:
      backgroundColor = '#6B7280'; // gray-500
      borderColor = '#4B5563'; // gray-600
  }

  return { backgroundColor, borderColor, textColor };
}

// 予約データをカレンダーイベント形式に変換
export function formatBookingAsEvent(booking: BookingData): CalendarEvent {
  const colors = getEventColor(booking.status, booking.bookingType);
  
  return {
    id: booking.id,
    title: `${booking.userName} - ${booking.purpose}`,
    start: booking.startTime,
    end: booking.endTime,
    backgroundColor: colors.backgroundColor,
    borderColor: colors.borderColor,
    textColor: colors.textColor,
    extendedProps: {
      userId: booking.userId,
      userName: booking.userName,
      status: booking.status,
      bookingType: booking.bookingType,
      purpose: booking.purpose,
      photographerName: booking.photographerName,
      createdAt: booking.createdAt
    }
  };
}

// 予約ステータスの日本語表示
export function getStatusText(status: string): string {
  switch (status) {
    case 'pending':
      return '申請中';
    case 'approved':
      return '承認済み';
    case 'rejected':
      return '拒否済み';
    case 'cancelled':
      return 'キャンセル済み';
    default:
      return '不明';
  }
}

// 予約タイプの日本語表示
export function getBookingTypeText(bookingType: string): string {
  switch (bookingType) {
    case 'temporary':
      return '仮予約';
    case 'confirmed':
      return '本予約';
    default:
      return '不明';
  }
}

// 日付フォーマット用ユーティリティ
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
}

export function formatTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

// 期間フォーマット
export function formatTimeRange(startTime: string | Date, endTime: string | Date): string {
  const start = formatTime(startTime);
  const end = formatTime(endTime);
  return `${start} - ${end}`;
}

// 色のコントラスト計算（アクセシビリティ用）
export function getContrastColor(hexColor: string): string {
  // 簡単なコントラスト計算
  const color = hexColor.replace('#', '');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  
  // 明度計算
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  return brightness > 155 ? '#000000' : '#FFFFFF';
}

// 空き状況をFullCalendarイベント形式に変換
export function formatAvailabilityAsEvents(availability: AvailabilitySlot[]): CalendarEvent[] {
  return availability.map((slot, index) => {
    const colors = getAvailabilityColor(slot.available, slot.type);
    
    return {
      id: `availability-${index}`,
      title: slot.available ? '空き' : '予約済み',
      start: slot.start,
      end: slot.end,
      backgroundColor: colors.backgroundColor,
      borderColor: colors.borderColor,
      textColor: colors.textColor,
      extendedProps: {
        userId: '',
        userName: '',
        status: slot.available ? 'available' : 'occupied',
        bookingType: 'availability',
        purpose: slot.type,
        photographerName: '',
        createdAt: '',
        isAvailabilitySlot: true,
        availabilityType: slot.type
      }
    };
  });
}

// 空き状況の色を決定
export function getAvailabilityColor(available: boolean, type: string): {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
} {
  let backgroundColor: string;
  let borderColor: string;
  const textColor = '#374151'; // gray-700

  if (type === 'business_hours') {
    if (available) {
      backgroundColor = '#DCFCE7'; // green-100
      borderColor = '#BBF7D0'; // green-200
    } else {
      backgroundColor = '#FEE2E2'; // red-100
      borderColor = '#FECACA'; // red-200
    }
  } else {
    // 営業時間外や休憩時間
    backgroundColor = '#F3F4F6'; // gray-100
    borderColor = '#E5E7EB'; // gray-200
  }

  return { backgroundColor, borderColor, textColor };
}

// 時間スロットの重複チェック
export function isTimeSlotAvailable(
  startTime: Date,
  endTime: Date,
  availability: AvailabilitySlot[]
): boolean {
  const start = startTime.toISOString();
  const end = endTime.toISOString();
  
  for (const slot of availability) {
    const slotStart = new Date(slot.start);
    const slotEnd = new Date(slot.end);
    
    // 時間枠が重複し、かつ利用可能でない場合
    if (start < slot.end && end > slot.start && !slot.available) {
      return false;
    }
  }
  
  return true;
}

// 営業時間チェック
export function isBusinessHours(dateTime: Date): boolean {
  const day = dateTime.getDay(); // 0=日曜日, 6=土曜日
  const hour = dateTime.getHours();
  
  // 平日（月-金）の9:00-22:00のみ営業
  return day >= 1 && day <= 5 && hour >= 9 && hour < 22;
}
