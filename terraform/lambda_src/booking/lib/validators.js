const { BOOKING_TYPE, BOOKING_STATUS } = require('./constants');

/**
 * 予約作成/更新リクエストのバリデーション
 */
function validateBookingRequest(data) {
  const errors = [];

  // 必須フィールドの検証
  if (!data.startTime) {
    errors.push('開始時間は必須です。');
  }
  
  if (!data.endTime) {
    errors.push('終了時間は必須です。');
  }
  
  if (!data.bookingType) {
    errors.push('予約タイプは必須です。');
  }
  
  if (!data.purpose) {
    errors.push('利用目的は必須です。');
  }
  
  if (!data.peopleCount || data.peopleCount < 1) {
    errors.push('利用人数は1人以上で入力してください。');
  }

  // 日時の形式検証
  if (data.startTime && !isValidISODateTime(data.startTime)) {
    errors.push('開始時間の形式が無効です。');
  }
  
  if (data.endTime && !isValidISODateTime(data.endTime)) {
    errors.push('終了時間の形式が無効です。');
  }

  // 時間の論理チェック
  if (data.startTime && data.endTime) {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    
    if (startTime >= endTime) {
      errors.push('終了時間は開始時間より後である必要があります。');
    }
    
    // 過去の日時チェック
    const now = new Date();
    if (startTime <= now) {
      errors.push('開始時間は現在時刻より後である必要があります。');
    }
    
    // 最大予約時間（例：8時間）のチェック
    const durationHours = (endTime - startTime) / (1000 * 60 * 60);
    if (durationHours > 8) {
      errors.push('予約時間は最大8時間までです。');
    }
  }

  // 予約タイプの検証
  if (data.bookingType && !Object.values(BOOKING_TYPE).includes(data.bookingType)) {
    errors.push('無効な予約タイプです。');
  }

  // オプションの検証
  if (data.options && Array.isArray(data.options)) {
    data.options.forEach((option, index) => {
      if (!option.id) {
        errors.push(`オプション${index + 1}のIDが不正です。`);
      }
      if (!option.quantity || option.quantity < 1) {
        errors.push(`オプション${index + 1}の数量は1以上で入力してください。`);
      }
    });
  }

  return errors;
}

/**
 * 日付範囲の検証
 */
function validateDateRange(from, to) {
  const errors = [];

  if (!from || !to) {
    errors.push('開始日と終了日は必須です。');
    return errors;
  }

  if (!isValidDate(from)) {
    errors.push('開始日の形式が無効です。');
  }

  if (!isValidDate(to)) {
    errors.push('終了日の形式が無効です。');
  }

  if (isValidDate(from) && isValidDate(to)) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (fromDate > toDate) {
      errors.push('終了日は開始日以降である必要があります。');
    }

    // 最大取得期間（例：3ヶ月）のチェック
    const diffDays = (toDate - fromDate) / (1000 * 60 * 60 * 24);
    if (diffDays > 90) {
      errors.push('取得期間は最大90日までです。');
    }
  }

  return errors;
}

/**
 * 日付の検証（YYYY-MM-DD形式）
 */
function validateDate(dateString) {
  const errors = [];

  if (!dateString) {
    errors.push('日付は必須です。');
    return errors;
  }

  if (!isValidDate(dateString)) {
    errors.push('日付の形式が無効です（YYYY-MM-DD形式で入力してください）。');
  }

  return errors;
}

/**
 * ISO8601日時形式の検証
 */
function isValidISODateTime(dateTimeString) {
  const isoDateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  if (!isoDateTimeRegex.test(dateTimeString)) {
    return false;
  }
  
  const date = new Date(dateTimeString);
  return !isNaN(date.getTime());
}

/**
 * 日付形式の検証（YYYY-MM-DD）
 */
function isValidDate(dateString) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }
  
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.toISOString().startsWith(dateString);
}

/**
 * ページング パラメータの検証
 */
function validatePagination(page, limit) {
  const errors = [];
  
  if (page && (isNaN(page) || page < 1)) {
    errors.push('ページ番号は1以上の数値で入力してください。');
  }
  
  if (limit && (isNaN(limit) || limit < 1 || limit > 50)) {
    errors.push('取得件数は1〜50の範囲で入力してください。');
  }
  
  return errors;
}

/**
 * 予約ステータスの検証
 */
function validateBookingStatus(status) {
  const errors = [];
  
  if (status && !Object.values(BOOKING_STATUS).includes(status)) {
    errors.push('無効な予約ステータスです。');
  }
  
  return errors;
}

module.exports = {
  validateBookingRequest,
  validateDateRange,
  validateDate,
  validatePagination,
  validateBookingStatus,
  isValidISODateTime,
  isValidDate
};
