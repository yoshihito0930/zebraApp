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

const dynamoDB = new AWS.DynamoDB.DocumentClient();

/**
 * キャンセル料率を計算
 */
function calculateCancellationFeePercent(startTime) {
  const now = new Date();
  const bookingDate = new Date(startTime);
  const diffDays = Math.ceil((bookingDate - now) / (1000 * 60 * 60 * 24));

  if (diffDays >= 6) return CANCELLATION_FEE_RATES.MORE_THAN_6_DAYS;
  if (diffDays >= 4) return CANCELLATION_FEE_RATES.BETWEEN_4_TO_6_DAYS;
  if (diffDays >= 1) return CANCELLATION_FEE_RATES.BETWEEN_1_TO_3_DAYS;
  return CANCELLATION_FEE_RATES.SAME_DAY;
}

/**
 * 仮予約の確認期限を計算
 */
function calculateConfirmationDeadline(startTime) {
  const deadlineDate = new Date();
  deadlineDate.setDate(deadlineDate.getDate() + TEMPORARY_BOOKING_DEADLINE_DAYS);
  
  // 予約開始時間より前に期限を設定
  const bookingStartTime = new Date(startTime);
  return deadlineDate < bookingStartTime ? deadlineDate : bookingStartTime;
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
 * 予約データをBookingsテーブル用に変換（キープシステム対応）
 */
function formatBookingForTable(bookingData, userId, userInfo, keepOrder = 1, isKeep = false) {
  const bookingId = uuidv4();
  const now = new Date().toISOString();
  
  // 確認期限の計算
  const confirmationDeadline = bookingData.bookingType === BOOKING_TYPE.TEMPORARY
    ? calculateConfirmationDeadline(bookingData.startTime)
    : null;

  // キャンセル料率の計算
  const cancellationFeePercent = calculateCancellationFeePercent(bookingData.startTime);
  
  // 日付とソートキー用の値を準備
  const startDate = new Date(bookingData.startTime).toISOString().split('T')[0];
  const startTimeForSort = new Date(bookingData.startTime).toISOString();
  
  return {
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
    
    confirmationDeadline: confirmationDeadline ? confirmationDeadline.toISOString() : null,
    automaticCancellation: bookingData.bookingType === BOOKING_TYPE.TEMPORARY,
    cancellationFeePercent,
    options: bookingData.options || [],
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now
  };
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
 * 予約をトランザクションで作成（BookingsとCalendarテーブルに同時書き込み）
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
  calculateConfirmationDeadline,
  checkTimeSlotAvailability,
  generateAvailableTimeSlots,
  formatBookingForTable,
  formatCalendarEntry,
  formatBookingForResponse,
  getUserInfo,
  createBookingTransaction,
  updateBookingTransaction,
  deleteBookingTransaction
};
