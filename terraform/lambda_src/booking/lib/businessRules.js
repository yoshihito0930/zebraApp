const { BUSINESS_HOURS } = require('./constants');

/**
 * 予約申請に関する業務ルール管理モジュール
 */

// 予約間隔設定（分）
const BOOKING_INTERVALS = {
  DEFAULT: 60,    // デフォルト1時間
  MINIMUM: 30     // 最小30分
};

/**
 * 予約間隔をチェック
 * @param {string} startTime - 開始時間（ISO形式）
 * @param {string} endTime - 終了時間（ISO形式）
 * @param {number} intervalMinutes - 予約間隔（分）デフォルトは60分
 * @returns {Object} { isValid: boolean, message: string }
 */
function validateBookingInterval(startTime, endTime, intervalMinutes = BOOKING_INTERVALS.DEFAULT) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  // 開始時間と終了時間の分を取得
  const startMinutes = start.getMinutes();
  const endMinutes = end.getMinutes();
  
  // 指定間隔で割り切れるかチェック
  if (startMinutes % intervalMinutes !== 0) {
    return {
      isValid: false,
      message: `開始時間は${intervalMinutes}分間隔で設定してください。`
    };
  }
  
  if (endMinutes % intervalMinutes !== 0) {
    return {
      isValid: false,
      message: `終了時間は${intervalMinutes}分間隔で設定してください。`
    };
  }
  
  return {
    isValid: true,
    message: null
  };
}

/**
 * 営業時間内かどうかをチェック
 * @param {string} startTime - 開始時間（ISO形式）
 * @param {string} endTime - 終了時間（ISO形式）
 * @returns {Object} { isValid: boolean, message: string }
 */
function validateBusinessHours(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  const startHour = start.getHours();
  const endHour = end.getHours();
  
  // 24時間営業の場合（BUSINESS_HOURS.START = 0, END = 24）
  if (BUSINESS_HOURS.START === 0 && BUSINESS_HOURS.END === 24) {
    return {
      isValid: true,
      message: null
    };
  }
  
  // 営業時間外チェック
  if (startHour < BUSINESS_HOURS.START || endHour > BUSINESS_HOURS.END) {
    return {
      isValid: false,
      message: `営業時間は${BUSINESS_HOURS.START}:00〜${BUSINESS_HOURS.END}:00です。`
    };
  }
  
  return {
    isValid: true,
    message: null
  };
}

/**
 * 予約時間の妥当性をチェック
 * @param {string} startTime - 開始時間（ISO形式）
 * @param {string} endTime - 終了時間（ISO形式）
 * @returns {Object} { isValid: boolean, message: string }
 */
function validateBookingDuration(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  const durationMinutes = (end - start) / (1000 * 60);
  
  // 最小予約時間（2時間）
  const MIN_DURATION = 2 * 60; // 120分
  if (durationMinutes < MIN_DURATION) {
    return {
      isValid: false,
      message: `予約時間は最低${MIN_DURATION / 60}時間以上必要です。`
    };
  }
  
  // 最大予約時間制限なし
  
  return {
    isValid: true,
    message: null
  };
}

/**
 * 予約可能日をチェック
 * @param {string} startTime - 開始時間（ISO形式）
 * @returns {Object} { isValid: boolean, message: string }
 */
function validateBookingDate(startTime) {
  const start = new Date(startTime);
  const now = new Date();
  
  // 過去の日時チェック
  if (start <= now) {
    return {
      isValid: false,
      message: '過去の日時は予約できません。'
    };
  }
  
  // 当日予約の制限（例：当日の2時間前まで）
  const hoursBeforeBooking = 2;
  const minBookingTime = new Date(now.getTime() + hoursBeforeBooking * 60 * 60 * 1000);
  
  if (start < minBookingTime) {
    return {
      isValid: false,
      message: `予約は${hoursBeforeBooking}時間前まで可能です。`
    };
  }
  
  return {
    isValid: true,
    message: null
  };
}

/**
 * 予約申請データの包括的バリデーション
 * @param {Object} bookingData - 予約データ
 * @param {number} intervalMinutes - 予約間隔（分）
 * @returns {Array} エラーメッセージの配列
 */
function validateBookingRequest(bookingData, intervalMinutes = BOOKING_INTERVALS.DEFAULT) {
  const errors = [];
  
  const { startTime, endTime } = bookingData;
  
  // 予約日時チェック
  const dateValidation = validateBookingDate(startTime);
  if (!dateValidation.isValid) {
    errors.push(dateValidation.message);
  }
  
  // 営業時間チェック
  const businessHoursValidation = validateBusinessHours(startTime, endTime);
  if (!businessHoursValidation.isValid) {
    errors.push(businessHoursValidation.message);
  }
  
  // 予約時間チェック
  const durationValidation = validateBookingDuration(startTime, endTime);
  if (!durationValidation.isValid) {
    errors.push(durationValidation.message);
  }
  
  // 予約間隔チェック
  const intervalValidation = validateBookingInterval(startTime, endTime, intervalMinutes);
  if (!intervalValidation.isValid) {
    errors.push(intervalValidation.message);
  }
  
  return errors;
}

/**
 * 同一ユーザーの仮予約数制限チェック
 * @param {string} userId - ユーザーID
 * @param {string} bookingType - 予約タイプ
 * @returns {Promise<Object>} { isValid: boolean, message: string }
 */
async function validateUserTemporaryBookingLimit(userId, bookingType) {
  // 仮予約の場合のみチェック
  if (bookingType !== 'temporary') {
    return {
      isValid: true,
      message: null
    };
  }
  
  // TODO: 実際の仮予約数を取得してチェック
  // 現在は制限なしとする
  return {
    isValid: true,
    message: null
  };
}

/**
 * 休業日チェック
 * @param {string} startTime - 開始時間（ISO形式）
 * @returns {Object} { isValid: boolean, message: string }
 */
function validateHolidays(startTime) {
  const start = new Date(startTime);
  
  // TODO: 休業日の設定がある場合はここでチェック
  // 現在は全日営業とする
  
  return {
    isValid: true,
    message: null
  };
}

module.exports = {
  BOOKING_INTERVALS,
  validateBookingInterval,
  validateBusinessHours,
  validateBookingDuration,
  validateBookingDate,
  validateBookingRequest,
  validateUserTemporaryBookingLimit,
  validateHolidays
};
