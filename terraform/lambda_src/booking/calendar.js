const AWS = require('aws-sdk');
const { 
  TABLES, 
  BOOKING_STATUS, 
  BOOKING_TYPE,
  ERROR_CODES, 
  RESPONSE_HEADERS 
} = require('./lib/constants');
const { 
  generateAvailableTimeSlots,
  formatBookingForResponse 
} = require('./lib/bookingService');

const dynamoDB = new AWS.DynamoDB.DocumentClient();

/**
 * 予約カレンダーLambda関数
 * カレンダー表示用のデータを提供
 */
exports.handler = async (event) => {
  try {
    console.log('Calendar event received:', JSON.stringify(event, null, 2));
    
    const method = event.httpMethod;
    const path = event.path;
    const pathParameters = event.pathParameters || {};
    
    switch (method) {
      case 'GET':
        if (path.includes('/calendar/month/')) {
          return await handleGetMonthlyCalendar(event);
        } else if (path.includes('/calendar/week/')) {
          return await handleGetWeeklyCalendar(event);
        } else if (path.includes('/calendar/day/')) {
          return await handleGetDailyCalendar(event);
        } else if (path.includes('/calendar/events')) {
          return await handleGetCalendarEvents(event);
        }
        return createErrorResponse(404, ERROR_CODES.NOT_FOUND, 'カレンダーエンドポイントが見つかりません。');
      default:
        return createErrorResponse(405, ERROR_CODES.FORBIDDEN, 'サポートされていないHTTPメソッドです。');
    }
  } catch (error) {
    console.error('Calendar error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, 'カレンダー処理中にエラーが発生しました。');
  }
};

/**
 * 月間カレンダー表示用データ取得
 * GET /calendar/month/{year}/{month}
 */
async function handleGetMonthlyCalendar(event) {
  const userId = getUserIdFromEvent(event);
  const isAdmin = getIsAdminFromEvent(event);
  
  if (!userId) {
    return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
  }
  
  const { year, month } = event.pathParameters;
  
  if (!year || !month || isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '有効な年月を指定してください。');
  }
  
  try {
    const targetYear = parseInt(year);
    const targetMonth = parseInt(month);
    
    // 月の開始日と終了日を計算
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);
    
    // 月間の予約データを取得
    const monthlyBookings = await getBookingsForDateRange(startDate, endDate, userId, isAdmin);
    
    // 日別統計を生成
    const dailyStats = generateDailyStats(monthlyBookings, startDate, endDate);
    
    const response = {
      year: targetYear,
      month: targetMonth,
      dailyStats,
      totalBookings: monthlyBookings.length,
      bookings: monthlyBookings.map(formatBookingForCalendar)
    };
    
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Monthly calendar error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '月間カレンダーの取得中にエラーが発生しました。');
  }
}

/**
 * 週間カレンダー表示用データ取得
 * GET /calendar/week/{year}/{week}
 */
async function handleGetWeeklyCalendar(event) {
  const userId = getUserIdFromEvent(event);
  const isAdmin = getIsAdminFromEvent(event);
  
  if (!userId) {
    return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
  }
  
  const { year, week } = event.pathParameters;
  
  if (!year || !week || isNaN(year) || isNaN(week) || week < 1 || week > 53) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '有効な年と週番号を指定してください。');
  }
  
  try {
    const targetYear = parseInt(year);
    const targetWeek = parseInt(week);
    
    // 週の開始日と終了日を計算（月曜日始まり）
    const weekDates = getWeekDateRange(targetYear, targetWeek);
    
    // 週間の予約データを取得
    const weeklyBookings = await getBookingsForDateRange(weekDates.start, weekDates.end, userId, isAdmin);
    
    // 日別・時間別の詳細データを生成
    const dailyDetails = await generateDailyDetails(weeklyBookings, weekDates.start, weekDates.end);
    
    const response = {
      year: targetYear,
      week: targetWeek,
      startDate: weekDates.start.toISOString().split('T')[0],
      endDate: weekDates.end.toISOString().split('T')[0],
      dailyDetails,
      totalBookings: weeklyBookings.length,
      bookings: weeklyBookings.map(formatBookingForCalendar)
    };
    
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Weekly calendar error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '週間カレンダーの取得中にエラーが発生しました。');
  }
}

/**
 * 日間カレンダー表示用データ取得
 * GET /calendar/day/{year}/{month}/{day}
 */
async function handleGetDailyCalendar(event) {
  const userId = getUserIdFromEvent(event);
  const isAdmin = getIsAdminFromEvent(event);
  
  if (!userId) {
    return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
  }
  
  const { year, month, day } = event.pathParameters;
  
  if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '有効な年月日を指定してください。');
  }
  
  try {
    const targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    // 指定日の予約データを取得
    const dailyBookings = await getBookingsForDate(targetDate, userId, isAdmin);
    
    // 10分単位の時間枠を生成
    const availableSlots = generateAvailableTimeSlots(targetDate);
    
    // 時間枠に予約情報をマップ
    const timeSlots = mapBookingsToTimeSlots(availableSlots, dailyBookings);
    
    const response = {
      date: targetDate.toISOString().split('T')[0],
      timeSlots,
      bookings: dailyBookings.map(formatBookingForCalendar),
      totalSlots: timeSlots.length,
      bookedSlots: timeSlots.filter(slot => slot.status !== 'available').length
    };
    
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Daily calendar error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '日間カレンダーの取得中にエラーが発生しました。');
  }
}

/**
 * カレンダーイベント形式でのデータ取得
 * GET /calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
async function handleGetCalendarEvents(event) {
  const userId = getUserIdFromEvent(event);
  const isAdmin = getIsAdminFromEvent(event);
  
  if (!userId) {
    return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
  }
  
  const queryParams = event.queryStringParameters || {};
  const startParam = queryParams.start;
  const endParam = queryParams.end;
  
  if (!startParam || !endParam) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '開始日と終了日を指定してください。');
  }
  
  try {
    const startDate = new Date(startParam);
    const endDate = new Date(endParam);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '有効な日付形式で指定してください。');
    }
    
    // 指定期間の予約データを取得
    const bookings = await getBookingsForDateRange(startDate, endDate, userId, isAdmin);
    
    // FullCalendar.js形式のイベントデータに変換
    const events = bookings.map(formatBookingAsCalendarEvent);
    
    const response = {
      events,
      total: events.length
    };
    
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Calendar events error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, 'カレンダーイベントの取得中にエラーが発生しました。');
  }
}

/**
 * 指定期間の予約データを取得
 */
async function getBookingsForDateRange(startDate, endDate, userId, isAdmin) {
  const bookings = [];
  
  // 日付ごとにクエリを実行
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    
    const params = {
      TableName: TABLES.BOOKINGS,
      IndexName: 'DateBookingsIndex',
      KeyConditionExpression: 'GSI3PK = :dateKey',
      ExpressionAttributeValues: {
        ':dateKey': `DATE#${dateKey}`
      }
    };
    
    // 一般ユーザーは自分の予約のみ表示
    if (!isAdmin) {
      params.FilterExpression = 'userId = :userId';
      params.ExpressionAttributeValues[':userId'] = userId;
    }
    
    try {
      const result = await dynamoDB.query(params).promise();
      bookings.push(...result.Items);
    } catch (error) {
      console.error(`Error querying date ${dateKey}:`, error);
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return bookings;
}

/**
 * 指定日の予約データを取得
 */
async function getBookingsForDate(targetDate, userId, isAdmin) {
  const dateKey = targetDate.toISOString().split('T')[0];
  
  const params = {
    TableName: TABLES.BOOKINGS,
    IndexName: 'DateBookingsIndex',
    KeyConditionExpression: 'GSI3PK = :dateKey',
    ExpressionAttributeValues: {
      ':dateKey': `DATE#${dateKey}`
    }
  };
  
  // 一般ユーザーは自分の予約のみ表示
  if (!isAdmin) {
    params.FilterExpression = 'userId = :userId';
    params.ExpressionAttributeValues[':userId'] = userId;
  }
  
  const result = await dynamoDB.query(params).promise();
  return result.Items;
}

/**
 * 日別統計を生成
 */
function generateDailyStats(bookings, startDate, endDate) {
  const stats = {};
  
  // 全日を初期化
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    stats[dateKey] = {
      date: dateKey,
      totalBookings: 0,
      pendingBookings: 0,
      approvedBookings: 0,
      temporaryBookings: 0,
      confirmedBookings: 0
    };
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // 予約データから統計を計算
  bookings.forEach(booking => {
    const bookingDate = new Date(booking.startTime).toISOString().split('T')[0];
    if (stats[bookingDate]) {
      stats[bookingDate].totalBookings++;
      
      if (booking.status === BOOKING_STATUS.PENDING) {
        stats[bookingDate].pendingBookings++;
      } else if (booking.status === BOOKING_STATUS.APPROVED) {
        stats[bookingDate].approvedBookings++;
      }
      
      if (booking.bookingType === BOOKING_TYPE.TEMPORARY) {
        stats[bookingDate].temporaryBookings++;
      } else if (booking.bookingType === BOOKING_TYPE.CONFIRMED) {
        stats[bookingDate].confirmedBookings++;
      }
    }
  });
  
  return Object.values(stats);
}

/**
 * 日別詳細データを生成
 */
async function generateDailyDetails(bookings, startDate, endDate) {
  const details = {};
  
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const dayBookings = bookings.filter(booking => 
      new Date(booking.startTime).toISOString().split('T')[0] === dateKey
    );
    
    // その日の利用可能時間枠を生成
    const availableSlots = generateAvailableTimeSlots(currentDate);
    const timeSlots = mapBookingsToTimeSlots(availableSlots, dayBookings);
    
    details[dateKey] = {
      date: dateKey,
      timeSlots,
      bookings: dayBookings.map(formatBookingForCalendar),
      totalSlots: timeSlots.length,
      bookedSlots: timeSlots.filter(slot => slot.status !== 'available').length
    };
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return details;
}

/**
 * 週の日付範囲を取得
 */
function getWeekDateRange(year, week) {
  const firstDayOfYear = new Date(year, 0, 1);
  const firstMonday = new Date(firstDayOfYear);
  
  // 年初の月曜日を求める
  const dayOfWeek = firstDayOfYear.getDay() || 7; // 日曜日を7に調整
  firstMonday.setDate(firstDayOfYear.getDate() + (1 - dayOfWeek));
  
  // 指定週の月曜日を計算
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
  
  // 週の終わり（日曜日）を計算
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  return {
    start: weekStart,
    end: weekEnd
  };
}

/**
 * 時間枠に予約情報をマップ
 */
function mapBookingsToTimeSlots(availableSlots, bookings) {
  return availableSlots.map(slot => {
    const slotStart = new Date(slot.startTime);
    const slotEnd = new Date(slot.endTime);
    
    // この時間枠に重複する予約を検索
    const overlappingBooking = bookings.find(booking => {
      const bookingStart = new Date(booking.startTime);
      const bookingEnd = new Date(booking.endTime);
      
      return (slotStart < bookingEnd && slotEnd > bookingStart);
    });
    
    if (overlappingBooking) {
      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: getSlotStatus(overlappingBooking),
        booking: formatBookingForCalendar(overlappingBooking)
      };
    } else {
      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: 'available',
        booking: null
      };
    }
  });
}

/**
 * 予約情報から時間枠のステータスを決定
 */
function getSlotStatus(booking) {
  if (booking.status === BOOKING_STATUS.CANCELLED) {
    return 'available';
  } else if (booking.status === BOOKING_STATUS.APPROVED) {
    return booking.bookingType === BOOKING_TYPE.TEMPORARY ? 'temporary_approved' : 'confirmed';
  } else if (booking.status === BOOKING_STATUS.PENDING) {
    return booking.bookingType === BOOKING_TYPE.TEMPORARY ? 'temporary_pending' : 'confirmed_pending';
  } else if (booking.status === BOOKING_STATUS.REJECTED) {
    return 'available';
  }
  
  return 'occupied';
}

/**
 * カレンダー表示用に予約データをフォーマット
 */
function formatBookingForCalendar(booking) {
  return {
    id: booking.bookingId,
    userId: booking.userId,
    userName: booking.userName,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    bookingType: booking.bookingType,
    purpose: booking.purpose,
    photographerName: booking.photographerName,
    createdAt: booking.createdAt
  };
}

/**
 * FullCalendar.js形式のイベントデータにフォーマット
 */
function formatBookingAsCalendarEvent(booking) {
  // 予約タイプとステータスに応じた色設定
  let backgroundColor, borderColor, textColor;
  
  if (booking.status === BOOKING_STATUS.CANCELLED) {
    backgroundColor = '#9CA3AF'; // gray-400
    borderColor = '#6B7280'; // gray-500
    textColor = '#FFFFFF';
  } else if (booking.status === BOOKING_STATUS.APPROVED) {
    if (booking.bookingType === BOOKING_TYPE.TEMPORARY) {
      backgroundColor = '#10B981'; // emerald-500
      borderColor = '#059669'; // emerald-600
    } else {
      backgroundColor = '#3B82F6'; // blue-500
      borderColor = '#2563EB'; // blue-600
    }
    textColor = '#FFFFFF';
  } else if (booking.status === BOOKING_STATUS.PENDING) {
    backgroundColor = '#F59E0B'; // amber-500
    borderColor = '#D97706'; // amber-600
    textColor = '#FFFFFF';
  } else if (booking.status === BOOKING_STATUS.REJECTED) {
    backgroundColor = '#EF4444'; // red-500
    borderColor = '#DC2626'; // red-600
    textColor = '#FFFFFF';
  } else {
    backgroundColor = '#6B7280'; // gray-500
    borderColor = '#4B5563'; // gray-600
    textColor = '#FFFFFF';
  }
  
  return {
    id: booking.bookingId,
    title: `${booking.userName} - ${booking.purpose}`,
    start: booking.startTime,
    end: booking.endTime,
    backgroundColor,
    borderColor,
    textColor,
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

/**
 * ヘルパー関数：イベントからユーザーIDを取得
 */
function getUserIdFromEvent(event) {
  const requestContext = event.requestContext || {};
  const authorizer = requestContext.authorizer || {};
  return authorizer.userId;
}

/**
 * ヘルパー関数：イベントから管理者権限を取得
 */
function getIsAdminFromEvent(event) {
  const requestContext = event.requestContext || {};
  const authorizer = requestContext.authorizer || {};
  return authorizer.isAdmin === 'true' || authorizer.isAdmin === true;
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
