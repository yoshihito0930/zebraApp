const AWS = require('aws-sdk');
const { 
  TABLES, 
  BOOKING_STATUS, 
  BOOKING_TYPE,
  ERROR_CODES, 
  RESPONSE_HEADERS,
  BOOKING_INTERVALS
} = require('./lib/constants');
const { 
  validateBookingRequest, 
  validatePagination,
  validateBookingStatus 
} = require('./lib/validators');
const {
  checkTimeSlotAvailability,
  formatBookingForTable,
  formatCalendarEntry,
  formatBookingForResponse,
  getUserInfo,
  createBookingTransaction,
  updateBookingTransaction,
  deleteBookingTransaction,
  calculateCancellationFeePercent
} = require('./lib/bookingService');
const {
  determineKeepOrder,
  promoteKeepBookings,
  getKeepStatusDetail,
  getBookingKeepOrder
} = require('./lib/keepSystem');
const {
  validateBookingRequest: validateBusinessRules
} = require('./lib/businessRules');

const dynamoDB = new AWS.DynamoDB.DocumentClient();

/**
 * 予約管理Lambda関数
 * 予約のCRUD操作を提供
 */
exports.handler = async (event) => {
  try {
    console.log('Booking event received:', JSON.stringify(event, null, 2));
    
    // HTTP メソッドとパスに基づいて処理を分岐
    const method = event.httpMethod;
    const path = event.path;
    const pathParameters = event.pathParameters || {};
    
    switch (method) {
      case 'GET':
        if (path.includes('/keep-status')) {
          return await handleGetKeepStatus(event);
        } else if (pathParameters.id) {
          return await handleGetBooking(event);
        } else {
          return await handleListBookings(event);
        }
      case 'POST':
        if (path.includes('/confirm')) {
          return await handleConfirmTemporaryBooking(event);
        } else {
          return await handleCreateBooking(event);
        }
      case 'PUT':
        return await handleUpdateBooking(event);
      case 'DELETE':
        return await handleCancelBooking(event);
      default:
        return createErrorResponse(405, ERROR_CODES.FORBIDDEN, 'サポートされていないHTTPメソッドです。');
    }
  } catch (error) {
    console.error('Booking error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '予約処理中にエラーが発生しました。');
  }
};

/**
 * 予約一覧取得
 */
async function handleListBookings(event) {
  const userId = getUserIdFromEvent(event);
  if (!userId) {
    return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
  }
  
  const queryParams = event.queryStringParameters || {};
  const page = parseInt(queryParams.page) || 1;
  const limit = parseInt(queryParams.limit) || 20;
  const status = queryParams.status;
  const from = queryParams.from;
  const to = queryParams.to;
  
  // パラメータ検証
  const paginationErrors = validatePagination(page, limit);
  const statusErrors = validateBookingStatus(status);
  const errors = [...paginationErrors, ...statusErrors];
  
  if (errors.length > 0) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, errors.join(' '));
  }
  
  try {
    // ユーザー別予約一覧をGSI1で取得
    const params = {
      TableName: TABLES.BOOKINGS,
      IndexName: 'UserBookingsIndex',
      KeyConditionExpression: 'GSI1PK = :userKey',
      ExpressionAttributeValues: {
        ':userKey': `USER#${userId}`
      },
      ScanIndexForward: false, // 新しい順にソート
      Limit: limit
    };
    
    // ステータスフィルタ
    if (status) {
      params.FilterExpression = '#status = :status';
      params.ExpressionAttributeNames = { '#status': 'status' };
      params.ExpressionAttributeValues[':status'] = status;
    }
    
    // 日付範囲フィルタ
    if (from || to) {
      const dateFilter = [];
      if (from) {
        dateFilter.push('startTime >= :from');
        params.ExpressionAttributeValues[':from'] = `${from}T00:00:00.000Z`;
      }
      if (to) {
        dateFilter.push('startTime <= :to');
        params.ExpressionAttributeValues[':to'] = `${to}T23:59:59.999Z`;
      }
      
      if (params.FilterExpression) {
        params.FilterExpression += ' AND (' + dateFilter.join(' AND ') + ')';
      } else {
        params.FilterExpression = dateFilter.join(' AND ');
      }
    }
    
    const result = await dynamoDB.query(params).promise();
    
    // レスポンス用にフォーマット
    const bookings = result.Items.map(formatBookingForResponse);
    
    // ページング情報（簡易実装）
    const response = {
      data: bookings,
      pagination: {
        page,
        limit,
        total: result.Count, // 正確な総数を取得するにはCountクエリが必要
        hasMore: !!result.LastEvaluatedKey
      }
    };
    
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('List bookings error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '予約一覧の取得中にエラーが発生しました。');
  }
}

/**
 * 予約詳細取得
 */
async function handleGetBooking(event) {
  const userId = getUserIdFromEvent(event);
  const bookingId = event.pathParameters.id;
  
  if (!userId) {
    return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
  }
  
  if (!bookingId) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '予約IDが必要です。');
  }
  
  try {
    const params = {
      TableName: TABLES.BOOKINGS,
      Key: {
        PK: `BOOKING#${bookingId}`,
        SK: `USER#${userId}`
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (!result.Item) {
      return createErrorResponse(404, ERROR_CODES.BOOKING_NOT_FOUND, '予約が見つかりません。');
    }
    
    const booking = formatBookingForResponse(result.Item);
    return createSuccessResponse(200, booking);
    
  } catch (error) {
    console.error('Get booking error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '予約詳細の取得中にエラーが発生しました。');
  }
}

/**
 * 新規予約作成（キープシステム対応）
 */
async function handleCreateBooking(event) {
  const userId = getUserIdFromEvent(event);
  if (!userId) {
    return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
  }
  
  const requestBody = JSON.parse(event.body);
  
  // 基本入力検証
  const validationErrors = validateBookingRequest(requestBody);
  if (validationErrors.length > 0) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, validationErrors.join(' '));
  }
  
  // 業務ルール検証（予約間隔、営業時間など）
  const intervalMinutes = requestBody.intervalMinutes || BOOKING_INTERVALS.DEFAULT;
  const businessRuleErrors = validateBusinessRules(requestBody, intervalMinutes);
  if (businessRuleErrors.length > 0) {
    return createErrorResponse(400, ERROR_CODES.INVALID_BOOKING_INTERVAL, businessRuleErrors.join(' '));
  }
  
  try {
    // ユーザー情報取得
    const userInfo = await getUserInfo(userId);
    if (!userInfo) {
      return createErrorResponse(404, ERROR_CODES.NOT_FOUND, 'ユーザーが見つかりません。');
    }
    
    // キープシステムでの予約可能性チェック
    const keepResult = await determineKeepOrder(requestBody.startTime, requestBody.endTime);
    if (!keepResult.canBook) {
      return createErrorResponse(409, ERROR_CODES.KEEP_LIMIT_EXCEEDED, keepResult.message);
    }
    
    // 予約データの作成（キープ情報を含む）
    const bookingData = formatBookingForTable(
      requestBody, 
      userId, 
      userInfo, 
      keepResult.keepOrder, 
      keepResult.isKeep
    );
    const calendarData = formatCalendarEntry(bookingData);
    
    // トランザクションで予約作成
    await createBookingTransaction(bookingData, calendarData);
    
    // レスポンス用データにキープ情報を追加
    const response = formatBookingForResponse(bookingData);
    response.keepInfo = {
      keepOrder: keepResult.keepOrder,
      isKeep: keepResult.isKeep,
      message: keepResult.message
    };
    
    return createSuccessResponse(201, response);
    
  } catch (error) {
    console.error('Create booking error:', error);
    
    // トランザクション競合エラーのハンドリング
    if (error.code === 'TransactionCanceledException') {
      return createErrorResponse(409, ERROR_CODES.TIME_SLOT_UNAVAILABLE, 'キープ順序の変更により予約できませんでした。再度お試しください。');
    }
    
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '予約作成中にエラーが発生しました。');
  }
}

/**
 * 予約更新
 */
async function handleUpdateBooking(event) {
  const userId = getUserIdFromEvent(event);
  const bookingId = event.pathParameters.id;
  
  if (!userId) {
    return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
  }
  
  if (!bookingId) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '予約IDが必要です。');
  }
  
  const requestBody = JSON.parse(event.body);
  
  // 入力検証
  const validationErrors = validateBookingRequest(requestBody);
  if (validationErrors.length > 0) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, validationErrors.join(' '));
  }
  
  try {
    // 既存の予約を取得
    const existingBooking = await getBookingById(bookingId, userId);
    if (!existingBooking) {
      return createErrorResponse(404, ERROR_CODES.BOOKING_NOT_FOUND, '予約が見つかりません。');
    }
    
    // 承認済みまたはキャンセル済みの予約は更新不可
    if (existingBooking.status === BOOKING_STATUS.APPROVED || 
        existingBooking.status === BOOKING_STATUS.CANCELLED) {
      return createErrorResponse(400, ERROR_CODES.BOOKING_CANNOT_BE_UPDATED, 
        '承認済みまたはキャンセル済みの予約は更新できません。');
    }
    
    // 時間が変更される場合は空き状況をチェック
    if (requestBody.startTime !== existingBooking.startTime || 
        requestBody.endTime !== existingBooking.endTime) {
      const isAvailable = await checkTimeSlotAvailability(
        requestBody.startTime, 
        requestBody.endTime, 
        bookingId
      );
      if (!isAvailable) {
        return createErrorResponse(409, ERROR_CODES.TIME_SLOT_UNAVAILABLE, 
          '指定された時間枠は既に予約されています。');
      }
    }
    
    // ユーザー情報取得
    const userInfo = await getUserInfo(userId);
    
    // 更新データの作成
    const updatedBookingData = {
      ...existingBooking,
      ...requestBody,
      updatedAt: new Date().toISOString()
    };
    
    // GSIキーの更新
    if (requestBody.startTime) {
      const startDate = new Date(requestBody.startTime).toISOString().split('T')[0];
      const startTimeForSort = new Date(requestBody.startTime).toISOString();
      updatedBookingData.GSI2SK = startTimeForSort;
      updatedBookingData.GSI3PK = `DATE#${startDate}`;
      updatedBookingData.GSI3SK = `TIME#${new Date(requestBody.startTime).toISOString().split('T')[1].slice(0, 8)}`;
    }
    
    const calendarData = formatCalendarEntry(updatedBookingData);
    
    // トランザクションで更新
    await updateBookingTransaction(updatedBookingData, calendarData);
    
    const response = formatBookingForResponse(updatedBookingData);
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Update booking error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '予約更新中にエラーが発生しました。');
  }
}

/**
 * 予約キャンセル（キープ繰り上がり処理対応）
 */
async function handleCancelBooking(event) {
  const userId = getUserIdFromEvent(event);
  const bookingId = event.pathParameters.id;
  
  if (!userId) {
    return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
  }
  
  if (!bookingId) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '予約IDが必要です。');
  }
  
  try {
    // 既存の予約を取得
    const existingBooking = await getBookingById(bookingId, userId);
    if (!existingBooking) {
      return createErrorResponse(404, ERROR_CODES.BOOKING_NOT_FOUND, '予約が見つかりません。');
    }
    
    // 既にキャンセル済みの予約は処理不可
    if (existingBooking.status === BOOKING_STATUS.CANCELLED) {
      return createErrorResponse(400, ERROR_CODES.BOOKING_CANNOT_BE_CANCELLED, 
        '既にキャンセル済みの予約です。');
    }
    
    // キャンセル料率を計算
    const cancellationFeePercent = calculateCancellationFeePercent(existingBooking.startTime);
    
    // キャンセルされる予約のキープ順序を取得
    const cancelledKeepOrder = existingBooking.keepOrder || 1;
    
    // 予約ステータスを更新
    const updatedBookingData = {
      ...existingBooking,
      status: BOOKING_STATUS.CANCELLED,
      cancellationFeePercent,
      updatedAt: new Date().toISOString()
    };
    
    // GSIキーを更新
    updatedBookingData.GSI2PK = `STATUS#${BOOKING_STATUS.CANCELLED}`;
    
    // カレンダーデータを削除
    const startDate = new Date(existingBooking.startTime).toISOString().split('T')[0];
    const startTime = new Date(existingBooking.startTime).toISOString().split('T')[1].slice(0, 8);
    const endTime = new Date(existingBooking.endTime).toISOString().split('T')[1].slice(0, 8);
    
    await deleteBookingTransaction(
      `BOOKING#${bookingId}`,
      `USER#${userId}`,
      `DATE#${startDate}`,
      `TIME#${startTime}#${endTime}#${bookingId}`
    );
    
    // Bookingsテーブルにキャンセル情報を保存
    await dynamoDB.put({
      TableName: TABLES.BOOKINGS,
      Item: updatedBookingData
    }).promise();
    
    // キープ繰り上がり処理
    const promotedBookings = await promoteKeepBookings(
      bookingId,
      existingBooking.startTime,
      existingBooking.endTime,
      cancelledKeepOrder
    );
    
    const response = {
      cancellationFeePercent,
      booking: formatBookingForResponse(updatedBookingData),
      promotedBookings: promotedBookings.map(formatBookingForResponse)
    };
    
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Cancel booking error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '予約キャンセル中にエラーが発生しました。');
  }
}

/**
 * キープ状況確認
 * GET /api/bookings/keep-status?startTime=xxx&endTime=xxx
 */
async function handleGetKeepStatus(event) {
  const userId = getUserIdFromEvent(event);
  if (!userId) {
    return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
  }
  
  const queryParams = event.queryStringParameters || {};
  const { startTime, endTime } = queryParams;
  
  if (!startTime || !endTime) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '開始時間と終了時間が必要です。');
  }
  
  try {
    // 基本的な日時検証
    if (!isValidISODateTime(startTime) || !isValidISODateTime(endTime)) {
      return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '日時の形式が無効です。');
    }
    
    // キープ状況の詳細を取得
    const keepStatusDetail = await getKeepStatusDetail(startTime, endTime);
    
    // 新規予約の可能性を確認
    const keepResult = await determineKeepOrder(startTime, endTime);
    
    const response = {
      timeSlot: {
        startTime,
        endTime
      },
      keepStatus: keepStatusDetail,
      canBook: keepResult.canBook,
      nextKeepOrder: keepResult.keepOrder,
      message: keepResult.message
    };
    
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Get keep status error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, 'キープ状況の取得中にエラーが発生しました。');
  }
}

/**
 * 仮予約から本予約への変更
 */
async function handleConfirmTemporaryBooking(event) {
  const userId = getUserIdFromEvent(event);
  const bookingId = event.pathParameters.id;
  
  if (!userId) {
    return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
  }
  
  if (!bookingId) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '予約IDが必要です。');
  }
  
  try {
    // 既存の予約を取得
    const existingBooking = await getBookingById(bookingId, userId);
    if (!existingBooking) {
      return createErrorResponse(404, ERROR_CODES.BOOKING_NOT_FOUND, '予約が見つかりません。');
    }
    
    // 仮予約でない場合はエラー
    if (existingBooking.bookingType !== BOOKING_TYPE.TEMPORARY) {
      return createErrorResponse(400, ERROR_CODES.INVALID_BOOKING_TYPE, 
        '仮予約ではないため、本予約への変更はできません。');
    }
    
    // 承認済みでない場合はエラー
    if (existingBooking.status !== BOOKING_STATUS.APPROVED) {
      return createErrorResponse(400, ERROR_CODES.BOOKING_CANNOT_BE_UPDATED, 
        '承認済みの仮予約のみ本予約に変更できます。');
    }
    
    // 本予約へ変更
    const updatedBookingData = {
      ...existingBooking,
      bookingType: BOOKING_TYPE.CONFIRMED,
      confirmationDeadline: null,
      automaticCancellation: false,
      updatedAt: new Date().toISOString()
    };
    
    const calendarData = formatCalendarEntry(updatedBookingData);
    
    // トランザクションで更新
    await updateBookingTransaction(updatedBookingData, calendarData);
    
    const response = formatBookingForResponse(updatedBookingData);
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Confirm booking error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '本予約への変更中にエラーが発生しました。');
  }
}

/**
 * ヘルパー関数：ISO8601日時形式の検証
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
 * ヘルパー関数：イベントからユーザーIDを取得
 */
function getUserIdFromEvent(event) {
  const requestContext = event.requestContext || {};
  const authorizer = requestContext.authorizer || {};
  return authorizer.userId;
}

/**
 * ヘルパー関数：予約IDとユーザーIDで予約を取得
 */
async function getBookingById(bookingId, userId) {
  const params = {
    TableName: TABLES.BOOKINGS,
    Key: {
      PK: `BOOKING#${bookingId}`,
      SK: `USER#${userId}`
    }
  };
  
  const result = await dynamoDB.get(params).promise();
  return result.Item;
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
