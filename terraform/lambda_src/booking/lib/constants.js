// 予約システム共通定数定義

// テーブル名
const TABLES = {
  BOOKINGS: process.env.BOOKINGS_TABLE || 'studio-booking-bookings',
  CALENDAR: process.env.CALENDAR_TABLE || 'studio-booking-calendar',
  OPTIONS: process.env.OPTIONS_TABLE || 'studio-booking-options',
  USERS: process.env.USERS_TABLE || 'studio-booking-users'
};

// 予約ステータス
const BOOKING_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
};

// 予約タイプ
const BOOKING_TYPE = {
  TEMPORARY: 'temporary',
  CONFIRMED: 'confirmed'
};

// キャンセル料率設定
const CANCELLATION_FEE_RATES = {
  MORE_THAN_6_DAYS: 0,    // 6日以上前: 0%
  BETWEEN_4_TO_6_DAYS: 50, // 4-6日前: 50%
  BETWEEN_1_TO_3_DAYS: 80, // 1-3日前: 80%
  SAME_DAY: 100           // 当日: 100%
};

// 営業時間設定
const BUSINESS_HOURS = {
  START: 0,  // 0:00 (24時間営業)
  END: 24,   // 24:00
  SLOT_DURATION: 1/6 // 10分単位 (1/6時間)
};

// 仮予約の確認期限（日数）
const TEMPORARY_BOOKING_DEADLINE_DAYS = 7;

// キープシステム関連定数
const KEEP_SYSTEM = {
  MAX_KEEP_COUNT: 3,
  KEEP_ORDER: {
    FIRST: 1,
    SECOND: 2,
    THIRD: 3
  }
};

// 予約間隔設定（分）
const BOOKING_INTERVALS = {
  DEFAULT: 60,    // デフォルト1時間
  MINIMUM: 30     // 最小30分
};

// エラーコード
const ERROR_CODES = {
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  TIME_SLOT_UNAVAILABLE: 'TIME_SLOT_UNAVAILABLE',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  BOOKING_CANNOT_BE_UPDATED: 'BOOKING_CANNOT_BE_UPDATED',
  BOOKING_CANNOT_BE_CANCELLED: 'BOOKING_CANNOT_BE_CANCELLED',
  INVALID_BOOKING_TYPE: 'INVALID_BOOKING_TYPE',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  KEEP_LIMIT_EXCEEDED: 'KEEP_LIMIT_EXCEEDED',
  INVALID_BOOKING_INTERVAL: 'INVALID_BOOKING_INTERVAL',
  BUSINESS_HOURS_VIOLATION: 'BUSINESS_HOURS_VIOLATION',
  SERVER_ERROR: 'SERVER_ERROR'
};

// 共通レスポンスヘッダー
const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

module.exports = {
  TABLES,
  BOOKING_STATUS,
  BOOKING_TYPE,
  CANCELLATION_FEE_RATES,
  BUSINESS_HOURS,
  TEMPORARY_BOOKING_DEADLINE_DAYS,
  KEEP_SYSTEM,
  BOOKING_INTERVALS,
  ERROR_CODES,
  RESPONSE_HEADERS
};
