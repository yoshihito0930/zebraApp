const AWS = require('aws-sdk');
const { TABLES, BOOKING_STATUS } = require('./constants');

const dynamoDB = new AWS.DynamoDB.DocumentClient();

/**
 * キープシステム管理モジュール
 * 同一時間帯での複数予約（第三キープまで）の管理
 */

// キープ順序の定数
const KEEP_ORDER = {
  FIRST: 1,    // 第一予約
  SECOND: 2,   // 第二キープ
  THIRD: 3     // 第三キープ
};

// 最大キープ数
const MAX_KEEP_COUNT = 3;

/**
 * 指定時間帯のキープ状況を取得
 * @param {string} startTime - 開始時間（ISO形式）
 * @param {string} endTime - 終了時間（ISO形式）
 * @param {string} excludeBookingId - 除外する予約ID（更新時用）
 * @returns {Promise<Array>} キープ状況の配列
 */
async function getKeepStatus(startTime, endTime, excludeBookingId = null) {
  const startDate = new Date(startTime).toISOString().split('T')[0];
  
  // Calendar テーブルから該当日の予約を取得
  const params = {
    TableName: TABLES.CALENDAR,
    KeyConditionExpression: 'PK = :dateKey',
    ExpressionAttributeValues: {
      ':dateKey': `DATE#${startDate}`
    }
  };

  const result = await dynamoDB.query(params).promise();
  
  // 時間重複する予約を抽出（キャンセル済みは除外）
  const overlappingBookings = result.Items.filter(item => {
    // 除外する予約IDがある場合はスキップ
    if (excludeBookingId && item.bookingId === excludeBookingId) {
      return false;
    }
    
    // キャンセル済みはスキップ
    if (item.status === BOOKING_STATUS.CANCELLED) {
      return false;
    }
    
    const existingStart = new Date(item.startTime);
    const existingEnd = new Date(item.endTime);
    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);
    
    // 時間重複判定
    return (newStart < existingEnd && newEnd > existingStart);
  });

  // キープ順序でソート
  overlappingBookings.sort((a, b) => (a.keepOrder || 1) - (b.keepOrder || 1));
  
  return overlappingBookings;
}

/**
 * 新規予約のキープ順序を決定
 * @param {string} startTime - 開始時間（ISO形式）
 * @param {string} endTime - 終了時間（ISO形式）
 * @returns {Promise<Object>} { canBook: boolean, keepOrder: number, isKeep: boolean }
 */
async function determineKeepOrder(startTime, endTime) {
  const existingBookings = await getKeepStatus(startTime, endTime);
  
  // 既存予約数をチェック
  const bookingCount = existingBookings.length;
  
  if (bookingCount >= MAX_KEEP_COUNT) {
    return {
      canBook: false,
      keepOrder: null,
      isKeep: false,
      message: `この時間帯は既に第${MAX_KEEP_COUNT}キープまで予約が入っているため、予約できません。`
    };
  }
  
  // 次のキープ順序を決定
  const nextKeepOrder = bookingCount + 1;
  const isKeep = nextKeepOrder > 1;
  
  return {
    canBook: true,
    keepOrder: nextKeepOrder,
    isKeep: isKeep,
    message: isKeep ? `第${nextKeepOrder - 1}キープとして予約されます。` : '第一予約として予約されます。'
  };
}

/**
 * 予約キャンセル時のキープ繰り上がり処理
 * @param {string} cancelledBookingId - キャンセルされた予約ID
 * @param {string} startTime - 開始時間（ISO形式）
 * @param {string} endTime - 終了時間（ISO形式）
 * @param {number} cancelledKeepOrder - キャンセルされた予約のキープ順序
 * @returns {Promise<Array>} 更新された予約の配列
 */
async function promoteKeepBookings(cancelledBookingId, startTime, endTime, cancelledKeepOrder) {
  const existingBookings = await getKeepStatus(startTime, endTime, cancelledBookingId);
  
  // キャンセルされた予約より後のキープを繰り上げ
  const bookingsToPromote = existingBookings.filter(booking => 
    (booking.keepOrder || 1) > cancelledKeepOrder
  );
  
  const updatedBookings = [];
  
  // トランザクションアイテムを準備
  const transactItems = [];
  
  for (const booking of bookingsToPromote) {
    const newKeepOrder = (booking.keepOrder || 1) - 1;
    const newIsKeep = newKeepOrder > 1;
    
    // Bookings テーブル更新用の項目を取得
    const bookingParams = {
      TableName: TABLES.BOOKINGS,
      Key: {
        PK: `BOOKING#${booking.bookingId}`,
        SK: `USER#${booking.userId}`
      }
    };
    
    const bookingResult = await dynamoDB.get(bookingParams).promise();
    if (bookingResult.Item) {
      const updatedBooking = {
        ...bookingResult.Item,
        keepOrder: newKeepOrder,
        isKeep: newIsKeep,
        updatedAt: new Date().toISOString()
      };
      
      // Bookings テーブル更新
      transactItems.push({
        Put: {
          TableName: TABLES.BOOKINGS,
          Item: updatedBooking
        }
      });
      
      // Calendar テーブル更新
      const startDate = new Date(startTime).toISOString().split('T')[0];
      const startTimeStr = new Date(startTime).toISOString().split('T')[1].slice(0, 8);
      const endTimeStr = new Date(endTime).toISOString().split('T')[1].slice(0, 8);
      
      const updatedCalendar = {
        PK: `DATE#${startDate}`,
        SK: `TIME#${startTimeStr}#${endTimeStr}`,
        bookingId: booking.bookingId,
        userId: booking.userId,
        status: booking.status,
        bookingType: booking.bookingType,
        startTime: booking.startTime,
        endTime: booking.endTime,
        keepOrder: newKeepOrder,
        isKeep: newIsKeep
      };
      
      transactItems.push({
        Put: {
          TableName: TABLES.CALENDAR,
          Item: updatedCalendar
        }
      });
      
      updatedBookings.push(updatedBooking);
    }
  }
  
  // バッチでトランザクション実行
  if (transactItems.length > 0) {
    // DynamoDBのトランザクション制限により、25件ずつ処理
    const chunkSize = 25;
    for (let i = 0; i < transactItems.length; i += chunkSize) {
      const chunk = transactItems.slice(i, i + chunkSize);
      await dynamoDB.transactWrite({
        TransactItems: chunk
      }).promise();
    }
  }
  
  return updatedBookings;
}

/**
 * キープ状況の詳細情報を取得
 * @param {string} startTime - 開始時間（ISO形式）
 * @param {string} endTime - 終了時間（ISO形式）
 * @returns {Promise<Object>} キープ状況の詳細
 */
async function getKeepStatusDetail(startTime, endTime) {
  const existingBookings = await getKeepStatus(startTime, endTime);
  
  const keepInfo = {
    totalBookings: existingBookings.length,
    availableKeepSlots: MAX_KEEP_COUNT - existingBookings.length,
    canBook: existingBookings.length < MAX_KEEP_COUNT,
    bookings: existingBookings.map(booking => ({
      bookingId: booking.bookingId,
      userId: booking.userId,
      keepOrder: booking.keepOrder || 1,
      isKeep: booking.isKeep || false,
      status: booking.status,
      bookingType: booking.bookingType
    }))
  };
  
  return keepInfo;
}

/**
 * 指定予約のキープ順序を取得
 * @param {string} bookingId - 予約ID
 * @param {string} userId - ユーザーID
 * @returns {Promise<number|null>} キープ順序（取得できない場合はnull）
 */
async function getBookingKeepOrder(bookingId, userId) {
  const params = {
    TableName: TABLES.BOOKINGS,
    Key: {
      PK: `BOOKING#${bookingId}`,
      SK: `USER#${userId}`
    }
  };
  
  const result = await dynamoDB.get(params).promise();
  return result.Item ? (result.Item.keepOrder || 1) : null;
}

module.exports = {
  KEEP_ORDER,
  MAX_KEEP_COUNT,
  getKeepStatus,
  determineKeepOrder,
  promoteKeepBookings,
  getKeepStatusDetail,
  getBookingKeepOrder
};
