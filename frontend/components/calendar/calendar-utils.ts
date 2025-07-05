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
