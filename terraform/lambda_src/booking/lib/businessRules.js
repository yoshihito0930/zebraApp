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
 * @param {Object} dynamoDB - DynamoDB DocumentClient
 * @returns {Promise<Object>} { isValid: boolean, message: string }
 */
async function validateUserTemporaryBookingLimit(userId, bookingType, dynamoDB) {
  // 仮予約の場合のみチェック
  if (bookingType !== 'temporary') {
    return {
      isValid: true,
      message: null
    };
  }
  
  try {
    // ユーザーの現在の仮予約数を取得
    const params = {
      TableName: process.env.BOOKINGS_TABLE || 'studio-booking-bookings',
      IndexName: 'UserBookingsIndex',
      KeyConditionExpression: 'GSI1PK = :userKey',
      FilterExpression: 'bookingType = :bookingType AND #status IN (:pending, :approved)',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':userKey': `USER#${userId}`,
        ':bookingType': 'temporary',
        ':pending': 'pending',
        ':approved': 'approved'
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    
    // 現在は制限なしとするが、将来的には制限を設けることも可能
    const MAX_TEMPORARY_BOOKINGS = 10; // 必要に応じて調整
    
    if (result.Count >= MAX_TEMPORARY_BOOKINGS) {
      return {
        isValid: false,
        message: `仮予約は最大${MAX_TEMPORARY_BOOKINGS}件まで申請できます。`
      };
    }
    
    return {
      isValid: true,
      message: null
    };
  } catch (error) {
    console.error('仮予約数制限チェックエラー:', error);
    // エラーの場合は通す（可用性を優先）
    return {
      isValid: true,
      message: null
    };
  }
}

/**
 * 予約タイプ変更の妥当性チェック
 * @param {string} currentBookingType - 現在の予約タイプ
 * @param {string} newBookingType - 新しい予約タイプ
 * @param {string} currentStatus - 現在の予約ステータス
 * @returns {Object} { isValid: boolean, message: string }
 */
function validateBookingTypeTransition(currentBookingType, newBookingType, currentStatus) {
  // 同じタイプの場合は問題なし
  if (currentBookingType === newBookingType) {
    return {
      isValid: true,
      message: null
    };
  }
  
  // 仮予約から本予約への変更
  if (currentBookingType === 'temporary' && newBookingType === 'confirmed') {
    // 承認済みの仮予約のみ本予約に変更可能
    if (currentStatus !== 'approved') {
      return {
        isValid: false,
        message: '承認済みの仮予約のみ本予約に変更できます。'
      };
    }
    return {
      isValid: true,
      message: null
    };
  }
  
  // 本予約から仮予約への変更は不可
  if (currentBookingType === 'confirmed' && newBookingType === 'temporary') {
    return {
      isValid: false,
      message: '本予約から仮予約への変更はできません。'
    };
  }
  
  return {
    isValid: false,
    message: '無効な予約タイプの変更です。'
  };
}

/**
 * 仮予約の確認要求チェック
 * @param {string} startTime - 予約開始時間（ISO形式）
 * @param {string} bookingType - 予約タイプ
 * @returns {Object} { isValid: boolean, message: string, requiresConfirmation: boolean }
 */
function validateConfirmationRequirement(startTime, bookingType) {
  if (bookingType !== 'temporary') {
    return {
      isValid: true,
      message: null,
      requiresConfirmation: false
    };
  }
  
  const bookingDate = new Date(startTime);
  const now = new Date();
  
  // 7日後の18:00を確認期限とする
  const confirmationDeadline = new Date(now);
  confirmationDeadline.setDate(confirmationDeadline.getDate() + 7);
  confirmationDeadline.setHours(18, 0, 0, 0);
  
  // 予約日が確認期限より後の場合は確認が必要
  if (bookingDate > confirmationDeadline) {
    return {
      isValid: true,
      message: `利用日7日前の18:00までに予約確定の連絡が必要です。期限: ${confirmationDeadline.toLocaleDateString('ja-JP')} 18:00`,
      requiresConfirmation: true
    };
  }
  
  // 確認期限内の場合は即座に確定扱い
  return {
    isValid: true,
    message: '確認期限内のため、即座に確定されます。',
    requiresConfirmation: false
  };
}

/**
 * キャンセル可能性チェック
 * @param {string} startTime - 予約開始時間（ISO形式）
 * @param {string} bookingType - 予約タイプ
 * @param {string} status - 予約ステータス
 * @returns {Object} { canCancel: boolean, cancellationFeePercent: number, message: string }
 */
function validateCancellationEligibility(startTime, bookingType, status) {
  // キャンセル済みや拒否済みの予約はキャンセル不可
  if (status === 'cancelled' || status === 'rejected') {
    return {
      canCancel: false,
      cancellationFeePercent: 0,
      message: 'この予約はキャンセルできません。'
    };
  }
  
  const now = new Date();
  const bookingDate = new Date(startTime);
  const diffDays = Math.ceil((bookingDate - now) / (1000 * 60 * 60 * 24));
  
  // 仮予約の場合はキャンセル料なし
  if (bookingType === 'temporary') {
    return {
      canCancel: true,
      cancellationFeePercent: 0,
      message: '仮予約のためキャンセル料は発生しません。'
    };
  }
  
  // 本予約の場合はキャンセル料を計算
  let cancellationFeePercent = 0;
  let message = '';
  
  if (diffDays >= 6) {
    cancellationFeePercent = 0;
    message = 'キャンセル料は発生しません。';
  } else if (diffDays >= 4) {
    cancellationFeePercent = 50;
    message = 'キャンセル料として予約時間分の利用料の50%が発生します。';
  } else if (diffDays >= 1) {
    cancellationFeePercent = 80;
    message = 'キャンセル料として予約時間分の利用料の80%が発生します。';
  } else {
    cancellationFeePercent = 100;
    message = 'キャンセル料として予約時間分の利用料の100%が発生します。';
  }
  
  return {
    canCancel: true,
    cancellationFeePercent,
    message
  };
}

/**
 * 予約変更可能性チェック
 * @param {string} bookingType - 予約タイプ
 * @param {string} status - 予約ステータス
 * @param {string} startTime - 予約開始時間（ISO形式）
 * @returns {Object} { canUpdate: boolean, message: string }
 */
function validateUpdateEligibility(bookingType, status, startTime) {
  // キャンセル済みや拒否済みの予約は変更不可
  if (status === 'cancelled' || status === 'rejected') {
    return {
      canUpdate: false,
      message: 'キャンセル済みまたは拒否済みの予約は変更できません。'
    };
  }
  
  const now = new Date();
  const bookingDate = new Date(startTime);
  
  // 過去の予約は変更不可
  if (bookingDate <= now) {
    return {
      canUpdate: false,
      message: '過去の予約は変更できません。'
    };
  }
  
  // 本予約で承認済みの場合は制限あり
  if (bookingType === 'confirmed' && status === 'approved') {
    const diffHours = (bookingDate - now) / (1000 * 60 * 60);
    
    // 24時間前からは変更不可
    if (diffHours < 24) {
      return {
        canUpdate: false,
        message: '本予約は利用開始24時間前からは変更できません。'
      };
    }
  }
  
  return {
    canUpdate: true,
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
  validateBookingTypeTransition,
  validateConfirmationRequirement,
  validateCancellationEligibility,
  validateUpdateEligibility,
  validateHolidays
};
