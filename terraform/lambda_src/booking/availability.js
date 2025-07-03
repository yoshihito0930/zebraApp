const AWS = require('aws-sdk');
const { 
  TABLES, 
  BOOKING_STATUS, 
  BUSINESS_HOURS,
  ERROR_CODES, 
  RESPONSE_HEADERS 
} = require('./lib/constants');
const { generateAvailableTimeSlots } = require('./lib/bookingService');
const { validateDate, validateDateRange } = require('./lib/validators');

const dynamoDB = new AWS.DynamoDB.DocumentClient();

/**
 * 空き状況確認Lambda関数
 * カレンダー表示と空き枠取得のAPI処理を提供
 */
exports.handler = async (event) => {
  try {
    console.log('Availability event received:', JSON.stringify(event, null, 2));
    
    // HTTP メソッドとパスに基づいて処理を分岐
    const method = event.httpMethod;
    const path = event.path;
    
    if (method !== 'GET') {
      return createErrorResponse(405, ERROR_CODES.FORBIDDEN, 'サポートされていないHTTPメソッドです。');
    }
    
    switch (true) {
      case path.includes('/calendar/available-slots'):
        return await handleGetAvailableSlots(event);
      case path.includes('/calendar'):
        return await handleGetCalendarData(event);
      default:
        return createErrorResponse(404, ERROR_CODES.NOT_FOUND, 'APIエンドポイントが見つかりません。');
    }
  } catch (error) {
    console.error('Availability error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '空き状況取得中にエラーが発生しました。');
  }
};

/**
 * 指定日の空き時間枠取得
 */
async function handleGetAvailableSlots(event) {
  const userId = getUserIdFromEvent(event);
  if (!userId) {
    return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
  }
  
  const queryParams = event.queryStringParameters || {};
  const date = queryParams.date;
  
  // 日付パラメータの検証
  const validationErrors = validateDate(date);
  if (validationErrors.length > 0) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, validationErrors.join(' '));
  }
  
  try {
    // 指定日の営業時間内全時間枠を生成
    const allTimeSlots = generateAvailableTimeSlots(date);
    
    // 指定日の予約済み時間枠を取得
    const bookedSlots = await getBookedSlots(date);
    
    // 空き時間枠を計算
    const availableSlots = filterAvailableSlots(allTimeSlots, bookedSlots);
    
    return createSuccessResponse(200, availableSlots);
    
  } catch (error) {
    console.error('Get available slots error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '空き時間枠の取得中にエラーが発生しました。');
  }
}

/**
 * 指定期間のカレンダーデータ取得
 */
async function handleGetCalendarData(event) {
  const userId = getUserIdFromEvent(event);
  if (!userId) {
    return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
  }
  
  const queryParams = event.queryStringParameters || {};
  const from = queryParams.from;
  const to = queryParams.to;
  
  // 日付範囲パラメータの検証
  const validationErrors = validateDateRange(from, to);
  if (validationErrors.length > 0) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, validationErrors.join(' '));
  }
  
  try {
    // 日付範囲のカレンダーデータを取得
    const calendarData = await getCalendarDataForRange(from, to);
    
    return createSuccessResponse(200, calendarData);
    
  } catch (error) {
    console.error('Get calendar data error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, 'カレンダーデータの取得中にエラーが発生しました。');
  }
}

/**
 * 指定日の予約済み時間枠を取得
 */
async function getBookedSlots(date) {
  const params = {
    TableName: TABLES.CALENDAR,
    KeyConditionExpression: 'PK = :dateKey',
    ExpressionAttributeValues: {
      ':dateKey': `DATE#${date}`
    }
  };
  
  const result = await dynamoDB.query(params).promise();
  
  return result.Items.filter(item => {
    // キャンセル済みの予約は除外
    return item.status !== BOOKING_STATUS.CANCELLED;
  }).map(item => ({
    startTime: item.startTime,
    endTime: item.endTime,
    status: item.status,
    bookingType: item.bookingType,
    bookingId: item.bookingId
  }));
}

/**
 * 空き時間枠をフィルタリング
 */
function filterAvailableSlots(allSlots, bookedSlots) {
  return allSlots.filter(slot => {
    const slotStart = new Date(slot.startTime);
    const slotEnd = new Date(slot.endTime);
    
    // 予約済み時間枠と重複していないかチェック
    const hasConflict = bookedSlots.some(booked => {
      const bookedStart = new Date(booked.startTime);
      const bookedEnd = new Date(booked.endTime);
      
      // 時間枠の重複判定
      return (slotStart < bookedEnd && slotEnd > bookedStart);
    });
    
    return !hasConflict;
  });
}

/**
 * 日付範囲のカレンダーデータを取得
 */
async function getCalendarDataForRange(from, to) {
  const startDate = new Date(from);
  const endDate = new Date(to);
  const calendarData = [];
  
  // 日付範囲をループして各日のデータを取得
  for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
    const dateString = currentDate.toISOString().split('T')[0];
    
    // 営業時間内の全時間枠を生成
    const allTimeSlots = generateAvailableTimeSlots(dateString);
    
    // 予約済み時間枠を取得
    const bookedSlots = await getBookedSlots(dateString);
    
    // 時間枠ごとのステータスを作成
    const timeSlots = allTimeSlots.map(slot => {
      const slotStart = new Date(slot.startTime);
      const slotEnd = new Date(slot.endTime);
      
      // この時間枠に対応する予約を検索
      const booking = bookedSlots.find(booked => {
        const bookedStart = new Date(booked.startTime);
        const bookedEnd = new Date(booked.endTime);
        
        // 時間枠の完全一致または重複をチェック
        return (slotStart >= bookedStart && slotEnd <= bookedEnd) ||
               (slotStart < bookedEnd && slotEnd > bookedStart);
      });
      
      if (booking) {
        return {
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: booking.bookingType === 'temporary' ? 'temporary' : 'confirmed',
          bookingId: booking.bookingId
        };
      } else {
        return {
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: 'available'
        };
      }
    });
    
    calendarData.push({
      date: dateString,
      timeSlots: timeSlots
    });
  }
  
  return calendarData;
}


/**
 * ヘルパー関数：イベントからユーザーIDを取得
 */
function getUserIdFromEvent(event) {
  const requestContext = event.requestContext || {};
  const authorizer = requestContext.authorizer || {};
  return authorizer.userId;
}

/**
 * 成功レスポンスの作成
 */
function createSuccessResponse(statusCode, data) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify(data)
  };
}

/**
 * エラーレスポンスの作成
 */
function createErrorResponse(statusCode, code, message) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify({
      code,
      message
    })
  };
}
