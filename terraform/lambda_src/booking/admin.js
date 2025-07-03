const AWS = require('aws-sdk');
const { 
  TABLES, 
  BOOKING_STATUS,
  ERROR_CODES, 
  RESPONSE_HEADERS 
} = require('./lib/constants');
const { formatBookingForResponse, updateBookingTransaction, formatCalendarEntry } = require('./lib/bookingService');

const dynamoDB = new AWS.DynamoDB.DocumentClient();

/**
 * 管理者向け予約管理Lambda関数
 * 予約承認・拒否機能を提供
 */
exports.handler = async (event) => {
  try {
    console.log('Admin booking event received:', JSON.stringify(event, null, 2));
    
    const userId = getUserIdFromEvent(event);
    const isAdmin = getIsAdminFromEvent(event);
    
    if (!userId) {
      return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
    }
    
    if (!isAdmin) {
      return createErrorResponse(403, ERROR_CODES.FORBIDDEN, '管理者権限が必要です。');
    }
    
    // HTTP メソッドとパスに基づいて処理を分岐
    const path = event.path;
    
    if (path.includes('/approve')) {
      return await handleApproveBooking(event, userId);
    } else if (path.includes('/reject')) {
      return await handleRejectBooking(event, userId);
    } else {
      return createErrorResponse(404, ERROR_CODES.NOT_FOUND, 'エンドポイントが見つかりません。');
    }
    
  } catch (error) {
    console.error('Admin booking error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '予約管理処理中にエラーが発生しました。');
  }
};

/**
 * 予約承認
 */
async function handleApproveBooking(event, adminUserId) {
  const bookingId = event.pathParameters.id;
  
  if (!bookingId) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '予約IDが必要です。');
  }
  
  try {
    // 予約を取得（すべてのユーザーの予約から検索）
    const booking = await getBookingById(bookingId);
    if (!booking) {
      return createErrorResponse(404, ERROR_CODES.BOOKING_NOT_FOUND, '予約が見つかりません。');
    }
    
    // 承認待ち状態でない場合はエラー
    if (booking.status !== BOOKING_STATUS.PENDING) {
      return createErrorResponse(400, ERROR_CODES.BOOKING_CANNOT_BE_UPDATED, 
        '承認待ち状態の予約のみ承認できます。');
    }
    
    // 予約を承認状態に更新
    const now = new Date().toISOString();
    const updatedBookingData = {
      ...booking,
      status: BOOKING_STATUS.APPROVED,
      approvedBy: adminUserId,
      approvedAt: now,
      updatedAt: now
    };
    
    // GSIキーを更新
    updatedBookingData.GSI2PK = `STATUS#${BOOKING_STATUS.APPROVED}`;
    
    const calendarData = formatCalendarEntry(updatedBookingData);
    
    // トランザクションで更新
    await updateBookingTransaction(updatedBookingData, calendarData);
    
    const response = formatBookingForResponse(updatedBookingData);
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Approve booking error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '予約承認中にエラーが発生しました。');
  }
}

/**
 * 予約拒否
 */
async function handleRejectBooking(event, adminUserId) {
  const bookingId = event.pathParameters.id;
  
  if (!bookingId) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '予約IDが必要です。');
  }
  
  const requestBody = JSON.parse(event.body || '{}');
  const reason = requestBody.reason;
  
  if (!reason) {
    return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '拒否理由は必須です。');
  }
  
  try {
    // 予約を取得（すべてのユーザーの予約から検索）
    const booking = await getBookingById(bookingId);
    if (!booking) {
      return createErrorResponse(404, ERROR_CODES.BOOKING_NOT_FOUND, '予約が見つかりません。');
    }
    
    // 承認待ち状態でない場合はエラー
    if (booking.status !== BOOKING_STATUS.PENDING) {
      return createErrorResponse(400, ERROR_CODES.BOOKING_CANNOT_BE_UPDATED, 
        '承認待ち状態の予約のみ拒否できます。');
    }
    
    // 予約を拒否状態に更新
    const now = new Date().toISOString();
    const updatedBookingData = {
      ...booking,
      status: BOOKING_STATUS.REJECTED,
      rejectedBy: adminUserId,
      rejectedAt: now,
      rejectionReason: reason,
      updatedAt: now
    };
    
    // GSIキーを更新
    updatedBookingData.GSI2PK = `STATUS#${BOOKING_STATUS.REJECTED}`;
    
    // 拒否された予約はカレンダーから削除
    const startDate = new Date(booking.startTime).toISOString().split('T')[0];
    const startTime = new Date(booking.startTime).toISOString().split('T')[1].slice(0, 8);
    const endTime = new Date(booking.endTime).toISOString().split('T')[1].slice(0, 8);
    
    // Bookingsテーブルの更新とCalendarテーブルからの削除
    const transactParams = {
      TransactItems: [
        {
          Put: {
            TableName: TABLES.BOOKINGS,
            Item: updatedBookingData
          }
        },
        {
          Delete: {
            TableName: TABLES.CALENDAR,
            Key: {
              PK: `DATE#${startDate}`,
              SK: `TIME#${startTime}#${endTime}`
            }
          }
        }
      ]
    };
    
    await dynamoDB.transactWrite(transactParams).promise();
    
    const response = formatBookingForResponse(updatedBookingData);
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Reject booking error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '予約拒否中にエラーが発生しました。');
  }
}

/**
 * 予約IDで予約を取得（全ユーザー対象）
 */
async function getBookingById(bookingId) {
  // GSI2を使用してステータス別に検索
  const statuses = [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED, BOOKING_STATUS.REJECTED, BOOKING_STATUS.CANCELLED];
  
  for (const status of statuses) {
    const params = {
      TableName: TABLES.BOOKINGS,
      IndexName: 'StatusBookingsIndex',
      KeyConditionExpression: 'GSI2PK = :statusKey',
      FilterExpression: 'bookingId = :bookingId',
      ExpressionAttributeValues: {
        ':statusKey': `STATUS#${status}`,
        ':bookingId': bookingId
      },
      Limit: 1
    };
    
    const result = await dynamoDB.query(params).promise();
    if (result.Items && result.Items.length > 0) {
      return result.Items[0];
    }
  }
  
  return null;
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
 * ヘルパー関数：イベントから管理者フラグを取得
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
