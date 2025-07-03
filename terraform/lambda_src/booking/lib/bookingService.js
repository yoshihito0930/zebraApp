const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const {
  TABLES,
  BOOKING_STATUS,
  BOOKING_TYPE,
  CANCELLATION_FEE_RATES,
  BUSINESS_HOURS,
  TEMPORARY_BOOKING_DEADLINE_DAYS,
  KEEP_SYSTEM
} = require('./constants');
const {
  validateBookingTypeTransition,
  validateConfirmationRequirement,
  validateCancellationEligibility,
  validateUpdateEligibility
} = require('./businessRules');
const {
  calculateConfirmationDeadline,
  calculateNotificationSchedule,
  generateEventBridgeNotificationData,
  generateEventBridgeAutoCancelData
} = require('./deadlineService');

const dynamoDB = new AWS.DynamoDB.DocumentClient();

/**
 * キャンセル料率を計算（予約タイプ別対応）
 * @param {string} startTime - 予約開始時間
 * @param {string} bookingType - 予約タイプ
 * @returns {number} キャンセル料率（%）
 */
function calculateCancellationFeePercent(startTime, bookingType = BOOKING_TYPE.CONFIRMED) {
  // 仮予約の場合は常に0%
  if (bookingType === BOOKING_TYPE.TEMPORARY) {
    return 0;
  }

  const now = new Date();
  const bookingDate = new Date(startTime);
  const diffDays = Math.ceil((bookingDate - now) / (1000 * 60 * 60 * 24));

  if (diffDays >= 6) return CANCELLATION_FEE_RATES.MORE_THAN_6_DAYS;
  if (diffDays >= 4) return CANCELLATION_FEE_RATES.BETWEEN_4_TO_6_DAYS;
  if (diffDays >= 1) return CANCELLATION_FEE_RATES.BETWEEN_1_TO_3_DAYS;
  return CANCELLATION_FEE_RATES.SAME_DAY;
}

/**
 * 仮予約の確認期限を計算（強化版）
 * @param {string} startTime - 予約開始時間
 * @param {string} bookingType - 予約タイプ
 * @returns {Date|null} 確認期限（仮予約以外はnull）
 */
function calculateBookingConfirmationDeadline(startTime, bookingType) {
  if (bookingType !== BOOKING_TYPE.TEMPORARY) {
    return null;
  }
  
  return calculateConfirmationDeadline(startTime);
}

/**
 * 予約作成時のEventBridge連携準備
 * @param {Object} bookingData - 予約データ
 * @returns {Object} EventBridge連携用データ
 */
function prepareEventBridgeIntegration(bookingData) {
  if (bookingData.bookingType !== BOOKING_TYPE.TEMPORARY || !bookingData.confirmationDeadline) {
    return {
      hasNotifications: false,
      events: []
    };
  }

  const events = [];
  const schedule = calculateNotificationSchedule(bookingData.startTime);

  // 通知イベントの準備
  if (schedule.firstNotification.shouldSend) {
    events.push(generateEventBridgeNotificationData(bookingData, 'first'));
  }
  
  if (schedule.secondNotification.shouldSend) {
    events.push(generateEventBridgeNotificationData(bookingData, 'second'));
  }
  
  if (schedule.deadlineNotification.shouldSend) {
    events.push(generateEventBridgeNotificationData(bookingData, 'deadline'));
  }

  // 自動キャンセルイベントの準備
  events.push(generateEventBridgeAutoCancelData(bookingData));

  return {
    hasNotifications: true,
    events,
    schedule
  };
}

/**
 * 時間枠のキープ状況チェック（キープシステム対応）
 */
async function checkTimeSlotAvailability(startTime, endTime, excludeBookingId = null) {
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  
  // 日付別のクエリで重複する予約を検索
  const dateKey = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const params = {
    TableName: TABLES.CALENDAR,
    KeyConditionExpression: 'PK = :dateKey',
    ExpressionAttributeValues: {
      ':dateKey': `DATE#${dateKey}`
    }
  };

  const result = await dynamoDB.query(params).promise();
  
  // 時間枠の重複する予約を取得
  const overlappingBookings = result.Items.filter(item => {
    // 除外する予約IDがある場合はスキップ
    if (excludeBookingId && item.bookingId === excludeBookingId) {
      return false;
    }
    
    // キャンセル済みの予約はスキップ
    if (item.status === BOOKING_STATUS.CANCELLED) {
      return false;
    }
    
    const existingStart = new Date(item.startTime);
    const existingEnd = new Date(item.endTime);
    
    // 時間枠の重複判定
    return (startDate < existingEnd && endDate > existingStart);
  });

  // キープシステム対応：第三キープまで予約可能
  return overlappingBookings.length < KEEP_SYSTEM.MAX_KEEP_COUNT;
}

/**
 * 指定日の利用可能な時間枠を生成（10分単位）
 */
function generateAvailableTimeSlots(date) {
  const slots = [];
  const targetDate = new Date(date);
  
  // 24時間を10分単位で分割（144スロット = 24時間 * 6スロット/時間）
  for (let slotIndex = 0; slotIndex < 144; slotIndex++) {
    const minutes = slotIndex * 10; // 10分単位
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    const startTime = new Date(targetDate);
    startTime.setHours(hours, mins, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 10);
    
    // 過去の時間は除外
    if (startTime > new Date()) {
      slots.push({
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      });
    }
  }
  
  return slots;
}

/**
 * 予約データをBookingsテーブル用に変換（キープシステム＋期限管理対応）
 */
function formatBookingForTable(bookingData, userId, userInfo, keepOrder = 1, isKeep = false) {
  const bookingId = uuidv4();
  const now = new Date().toISOString();
  
  // 確認期限の計算（強化版）
  const confirmationDeadline = calculateBookingConfirmationDeadline(bookingData.startTime, bookingData.bookingType);

  // 確認要求チェック
  const confirmationCheck = validateConfirmationRequirement(bookingData.startTime, bookingData.bookingType);

  // キャンセル料率の計算（予約タイプ別）
  const cancellationFeePercent = calculateCancellationFeePercent(bookingData.startTime, bookingData.bookingType);
  
  // 日付とソートキー用の値を準備
  const startDate = new Date(bookingData.startTime).toISOString().split('T')[0];
  const startTimeForSort = new Date(bookingData.startTime).toISOString();
  
  const formattedBooking = {
    // プライマリキー
    PK: `BOOKING#${bookingId}`,
    SK: `USER#${userId}`,
    
    // GSI用キー
    GSI1PK: `USER#${userId}`,
    GSI1SK: `BOOKING#${now}`,
    GSI2PK: `STATUS#${BOOKING_STATUS.PENDING}`,
    GSI2SK: startTimeForSort,
    GSI3PK: `DATE#${startDate}`,
    GSI3SK: `TIME#${new Date(bookingData.startTime).toISOString().split('T')[1].slice(0, 8)}`,
    
    // 予約データ
    bookingId,
    userId,
    userEmail: userInfo.email,
    userName: userInfo.fullName,
    companyName: userInfo.companyName || '',
    photographerName: bookingData.photographerName || '',
    plan: bookingData.plan || '',
    planDetails: bookingData.planDetails || '',
    insurance: bookingData.insurance || null,
    startTime: bookingData.startTime,
    endTime: bookingData.endTime,
    status: BOOKING_STATUS.PENDING,
    bookingType: bookingData.bookingType,
    purpose: bookingData.purpose,
    shootingDetails: bookingData.shootingDetails || '',
    protection: bookingData.protection || '',
    peopleCount: bookingData.peopleCount,
    
    // キープシステム関連
    keepOrder: keepOrder,
    isKeep: isKeep,
    
    // 期限管理関連（強化）
    confirmationDeadline: confirmationDeadline ? confirmationDeadline.toISOString() : null,
    requiresConfirmation: confirmationCheck.requiresConfirmation,
    automaticCancellation: bookingData.bookingType === BOOKING_TYPE.TEMPORARY,
    cancellationFeePercent,
    
    // その他
    options: bookingData.options || [],
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now
  };

  return formattedBooking;
}

/**
 * カレンダーテーブル用データを生成（キープシステム対応）
 */
function formatCalendarEntry(bookingData) {
  const startDate = new Date(bookingData.startTime).toISOString().split('T')[0];
  const startTime = new Date(bookingData.startTime).toISOString().split('T')[1].slice(0, 8);
  const endTime = new Date(bookingData.endTime).toISOString().split('T')[1].slice(0, 8);
  
  return {
    PK: `DATE#${startDate}`,
    SK: `TIME#${startTime}#${endTime}#${bookingData.bookingId}`, // 複数予約に対応するためbookingIdを含める
    bookingId: bookingData.bookingId,
    userId: bookingData.userId,
    status: bookingData.status,
    bookingType: bookingData.bookingType,
    startTime: bookingData.startTime,
    endTime: bookingData.endTime,
    keepOrder: bookingData.keepOrder || 1,
    isKeep: bookingData.isKeep || false
  };
}

/**
 * レスポンス用に予約データをフォーマット
 */
function formatBookingForResponse(booking) {
  const response = { ...booking };
  
  // 内部キーを除外
  delete response.PK;
  delete response.SK;
  delete response.GSI1PK;
  delete response.GSI1SK;
  delete response.GSI2PK;
  delete response.GSI2SK;
  delete response.GSI3PK;
  delete response.GSI3SK;
  
  // IDフィールドを統一
  response.id = response.bookingId;
  
  return response;
}

/**
 * ユーザー情報を取得
 */
async function getUserInfo(userId) {
  const params = {
    TableName: TABLES.USERS,
    Key: {
      PK: `USER#${userId}`
    }
  };
  
  const result = await dynamoDB.get(params).promise();
  return result.Item;
}

/**
 * 予約をトランザクションで作成（BookingsとCalendarテーブルに同時書き込み＋EventBridge連携準備）
 * @param {Object} bookingData - 予約データ
 * @param {Object} calendarData - カレンダーデータ
 * @returns {Promise<Object>} 作成結果とEventBridge情報
 */
async function createBookingTransaction(bookingData, calendarData) {
  const transactParams = {
    TransactItems: [
      {
        Put: {
          TableName: TABLES.BOOKINGS,
          Item: bookingData,
          ConditionExpression: 'attribute_not_exists(PK)'
        }
      },
      {
        Put: {
          TableName: TABLES.CALENDAR,
          Item: calendarData,
          ConditionExpression: 'attribute_not_exists(PK)'
        }
      }
    ]
  };
  
  await dynamoDB.transactWrite(transactParams).promise();

  // EventBridge連携データを準備
  const eventBridgeData = prepareEventBridgeIntegration(bookingData);

  return {
    success: true,
    bookingData,
    calendarData,
    eventBridgeData
  };
}

/**
 * 予約タイプ変更の検証と処理
 * @param {Object} existingBooking - 既存の予約データ
 * @param {string} newBookingType - 新しい予約タイプ
 * @returns {Object} 変更可能性とメッセージ
 */
function validateAndProcessBookingTypeChange(existingBooking, newBookingType) {
  const validation = validateBookingTypeTransition(
    existingBooking.bookingType,
    newBookingType,
    existingBooking.status
  );

  if (!validation.isValid) {
    return validation;
  }

  // 本予約への変更の場合、追加処理
  if (existingBooking.bookingType === BOOKING_TYPE.TEMPORARY && 
      newBookingType === BOOKING_TYPE.CONFIRMED) {
    
    // 確認期限を削除
    const updatedBooking = {
      ...existingBooking,
      bookingType: newBookingType,
      confirmationDeadline: null,
      requiresConfirmation: false,
      automaticCancellation: false,
      // キャンセル料率を再計算
      cancellationFeePercent: calculateCancellationFeePercent(existingBooking.startTime, newBookingType),
      updatedAt: new Date().toISOString()
    };

    return {
      isValid: true,
      message: '仮予約から本予約に変更されました。',
      updatedBooking
    };
  }

  return validation;
}

/**
 * 予約キャンセルの検証と処理
 * @param {Object} existingBooking - 既存の予約データ
 * @returns {Object} キャンセル可能性と料金情報
 */
function validateAndProcessBookingCancellation(existingBooking) {
  const cancellationCheck = validateCancellationEligibility(
    existingBooking.startTime,
    existingBooking.bookingType,
    existingBooking.status
  );

  if (!cancellationCheck.canCancel) {
    return cancellationCheck;
  }

  const updatedBooking = {
    ...existingBooking,
    status: BOOKING_STATUS.CANCELLED,
    cancellationFeePercent: cancellationCheck.cancellationFeePercent,
    cancellationReason: '利用者による手動キャンセル',
    updatedAt: new Date().toISOString()
  };

  // GSIキーを更新
  updatedBooking.GSI2PK = `STATUS#${BOOKING_STATUS.CANCELLED}`;

  return {
    canCancel: true,
    cancellationFeePercent: cancellationCheck.cancellationFeePercent,
    message: cancellationCheck.message,
    updatedBooking
  };
}

/**
 * 予約更新の検証と処理
 * @param {Object} existingBooking - 既存の予約データ
 * @param {Object} updateData - 更新データ
 * @returns {Object} 更新可能性と更新されたデータ
 */
function validateAndProcessBookingUpdate(existingBooking, updateData) {
  const updateCheck = validateUpdateEligibility(
    existingBooking.bookingType,
    existingBooking.status,
    existingBooking.startTime
  );

  if (!updateCheck.canUpdate) {
    return updateCheck;
  }

  // 予約タイプの変更がある場合
  if (updateData.bookingType && updateData.bookingType !== existingBooking.bookingType) {
    const typeChangeResult = validateAndProcessBookingTypeChange(existingBooking, updateData.bookingType);
    
    if (!typeChangeResult.isValid) {
      return typeChangeResult;
    }

    if (typeChangeResult.updatedBooking) {
      return {
        canUpdate: true,
        message: typeChangeResult.message,
        updatedBooking: {
          ...typeChangeResult.updatedBooking,
          ...updateData,
          updatedAt: new Date().toISOString()
        }
      };
    }
  }

  // 通常の更新処理
  const updatedBooking = {
    ...existingBooking,
    ...updateData,
    updatedAt: new Date().toISOString()
  };

  // 時間が変更された場合、GSIキーを更新
  if (updateData.startTime) {
    const startDate = new Date(updateData.startTime).toISOString().split('T')[0];
    const startTimeForSort = new Date(updateData.startTime).toISOString();
    updatedBooking.GSI2SK = startTimeForSort;
    updatedBooking.GSI3PK = `DATE#${startDate}`;
    updatedBooking.GSI3SK = `TIME#${new Date(updateData.startTime).toISOString().split('T')[1].slice(0, 8)}`;
    
    // 確認期限を再計算（仮予約の場合）
    if (updatedBooking.bookingType === BOOKING_TYPE.TEMPORARY) {
      const newDeadline = calculateBookingConfirmationDeadline(updateData.startTime, updatedBooking.bookingType);
      updatedBooking.confirmationDeadline = newDeadline ? newDeadline.toISOString() : null;
    }
  }

  return {
    canUpdate: true,
    message: null,
    updatedBooking
  };
}

/**
 * 予約をトランザクションで更新
 */
async function updateBookingTransaction(bookingData, calendarData) {
  const transactParams = {
    TransactItems: [
      {
        Put: {
          TableName: TABLES.BOOKINGS,
          Item: bookingData
        }
      },
      {
        Put: {
          TableName: TABLES.CALENDAR,
          Item: calendarData
        }
      }
    ]
  };
  
  await dynamoDB.transactWrite(transactParams).promise();
}

/**
 * 予約をトランザクションで削除
 */
async function deleteBookingTransaction(bookingPK, bookingSK, calendarPK, calendarSK) {
  const transactParams = {
    TransactItems: [
      {
        Delete: {
          TableName: TABLES.BOOKINGS,
          Key: {
            PK: bookingPK,
            SK: bookingSK
          }
        }
      },
      {
        Delete: {
          TableName: TABLES.CALENDAR,
          Key: {
            PK: calendarPK,
            SK: calendarSK
          }
        }
      }
    ]
  };
  
  await dynamoDB.transactWrite(transactParams).promise();
}

module.exports = {
  calculateCancellationFeePercent,
  calculateBookingConfirmationDeadline,
  checkTimeSlotAvailability,
  generateAvailableTimeSlots,
  formatBookingForTable,
  formatCalendarEntry,
  formatBookingForResponse,
  getUserInfo,
  createBookingTransaction,
  updateBookingTransaction,
  deleteBookingTransaction,
  prepareEventBridgeIntegration,
  validateAndProcessBookingTypeChange,
  validateAndProcessBookingCancellation,
  validateAndProcessBookingUpdate
};
