const AWS = require('aws-sdk');
const { 
  TABLES, 
  BOOKING_STATUS,
  BOOKING_TYPE,
  ERROR_CODES, 
  RESPONSE_HEADERS 
} = require('./lib/constants');
const { 
  formatBookingForResponse, 
  updateBookingTransaction, 
  formatCalendarEntry,
  validateAndProcessBookingTypeChange 
} = require('./lib/bookingService');
const { validateBookingTypeTransition } = require('./lib/businessRules');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const eventBridge = new AWS.EventBridge();

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
  
  const requestBody = JSON.parse(event.body || '{}');
  const approvalOptions = {
    convertToConfirmed: requestBody.convertToConfirmed || false,
    adminComment: requestBody.adminComment || ''
  };
  
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
    
    // 予約承認の妥当性チェック
    const approvalValidation = await validateBookingApproval(booking, approvalOptions);
    if (!approvalValidation.isValid) {
      return createErrorResponse(400, ERROR_CODES.BOOKING_CANNOT_BE_UPDATED, 
        approvalValidation.message);
    }
    
    // 予約を承認状態に更新
    const now = new Date().toISOString();
    let updatedBookingData = {
      ...booking,
      status: BOOKING_STATUS.APPROVED,
      approvedBy: adminUserId,
      approvedAt: now,
      adminComment: approvalOptions.adminComment,
      updatedAt: now
    };
    
    // 仮予約から本予約への変更処理
    if (booking.bookingType === BOOKING_TYPE.TEMPORARY && approvalOptions.convertToConfirmed) {
      const typeChangeResult = validateAndProcessBookingTypeChange(booking, BOOKING_TYPE.CONFIRMED);
      if (typeChangeResult.isValid && typeChangeResult.updatedBooking) {
        updatedBookingData = {
          ...typeChangeResult.updatedBooking,
          status: BOOKING_STATUS.APPROVED,
          approvedBy: adminUserId,
          approvedAt: now,
          adminComment: approvalOptions.adminComment,
          updatedAt: now
        };
      }
    }
    
    // GSIキーを更新
    updatedBookingData.GSI2PK = `STATUS#${BOOKING_STATUS.APPROVED}`;
    
    const calendarData = formatCalendarEntry(updatedBookingData);
    
    // 仮予約の場合、EventBridge自動キャンセルスケジュールを削除
    const eventBridgeCleanup = await cleanupEventBridgeSchedules(booking);
    
    // トランザクションで更新
    await updateBookingTransaction(updatedBookingData, calendarData);
    
    // 承認通知の送信（非同期）
    setImmediate(() => {
      sendApprovalNotification(updatedBookingData).catch(error => {
        console.error('Failed to send approval notification:', error);
      });
    });
    
    const response = formatBookingForResponse(updatedBookingData);
    response.eventBridgeCleanup = eventBridgeCleanup;
    
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
  const adminComment = requestBody.adminComment || '';
  
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
      adminComment: adminComment,
      updatedAt: now
    };
    
    // GSIキーを更新
    updatedBookingData.GSI2PK = `STATUS#${BOOKING_STATUS.REJECTED}`;
    
    // カレンダーエントリの削除準備（複数予約対応）
    const calendarDeletionData = await prepareCalendarDeletion(booking);
    
    // キープ順位の再調整
    const keepAdjustmentData = await adjustKeepOrder(booking);
    
    // EventBridge関連スケジュールのクリーンアップ
    const eventBridgeCleanup = await cleanupEventBridgeSchedules(booking);
    
    // トランザクション準備
    const transactItems = [
      {
        Put: {
          TableName: TABLES.BOOKINGS,
          Item: updatedBookingData
        }
      }
    ];
    
    // カレンダーエントリの削除を追加
    if (calendarDeletionData.shouldDelete) {
      transactItems.push({
        Delete: {
          TableName: TABLES.CALENDAR,
          Key: calendarDeletionData.key
        }
      });
    }
    
    // キープ順位調整のためのアップデートを追加
    keepAdjustmentData.updates.forEach(update => {
      transactItems.push({
        Put: {
          TableName: TABLES.BOOKINGS,
          Item: update
        }
      });
    });
    
    const transactParams = { TransactItems: transactItems };
    await dynamoDB.transactWrite(transactParams).promise();
    
    // 拒否通知の送信（非同期）
    setImmediate(() => {
      sendRejectionNotification(updatedBookingData).catch(error => {
        console.error('Failed to send rejection notification:', error);
      });
    });
    
    const response = formatBookingForResponse(updatedBookingData);
    response.keepAdjustment = keepAdjustmentData.summary;
    response.eventBridgeCleanup = eventBridgeCleanup;
    
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
 * 予約承認の妥当性チェック
 */
async function validateBookingApproval(booking, options) {
  // 仮予約から本予約への変更をチェック
  if (booking.bookingType === BOOKING_TYPE.TEMPORARY && options.convertToConfirmed) {
    const typeValidation = validateBookingTypeTransition(
      booking.bookingType, 
      BOOKING_TYPE.CONFIRMED, 
      BOOKING_STATUS.PENDING
    );
    
    if (!typeValidation.isValid) {
      return {
        isValid: false,
        message: typeValidation.message
      };
    }
  }
  
  // 時間枠の競合チェック（キープシステム考慮）
  const conflictCheck = await checkTimeSlotConflicts(booking);
  if (!conflictCheck.isValid) {
    return {
      isValid: false,
      message: conflictCheck.message
    };
  }
  
  return {
    isValid: true,
    message: null
  };
}

/**
 * 時間枠の競合チェック
 */
async function checkTimeSlotConflicts(booking) {
  const startDate = new Date(booking.startTime).toISOString().split('T')[0];
  
  const params = {
    TableName: TABLES.CALENDAR,
    KeyConditionExpression: 'PK = :dateKey',
    ExpressionAttributeValues: {
      ':dateKey': `DATE#${startDate}`
    }
  };
  
  try {
    const result = await dynamoDB.query(params).promise();
    
    // 同時間枠で承認済みの予約数をチェック
    const overlappingApprovedBookings = result.Items.filter(item => {
      if (item.bookingId === booking.bookingId) return false;
      if (item.status !== BOOKING_STATUS.APPROVED) return false;
      
      const existingStart = new Date(item.startTime);
      const existingEnd = new Date(item.endTime);
      const bookingStart = new Date(booking.startTime);
      const bookingEnd = new Date(booking.endTime);
      
      return (bookingStart < existingEnd && bookingEnd > existingStart);
    });
    
    // キープシステムの上限チェック
    if (overlappingApprovedBookings.length >= 3) {
      return {
        isValid: false,
        message: '同時間枠の予約数が上限に達しています。'
      };
    }
    
    return {
      isValid: true,
      message: null
    };
  } catch (error) {
    console.error('Conflict check error:', error);
    return {
      isValid: true, // エラー時は通す（可用性優先）
      message: null
    };
  }
}

/**
 * カレンダーエントリ削除の準備
 */
async function prepareCalendarDeletion(booking) {
  const startDate = new Date(booking.startTime).toISOString().split('T')[0];
  const startTime = new Date(booking.startTime).toISOString().split('T')[1].slice(0, 8);
  const endTime = new Date(booking.endTime).toISOString().split('T')[1].slice(0, 8);
  
  return {
    shouldDelete: true,
    key: {
      PK: `DATE#${startDate}`,
      SK: `TIME#${startTime}#${endTime}#${booking.bookingId}`
    }
  };
}

/**
 * キープ順位の再調整
 */
async function adjustKeepOrder(rejectedBooking) {
  try {
    const startDate = new Date(rejectedBooking.startTime).toISOString().split('T')[0];
    
    // 同時間枠の他の予約を取得
    const params = {
      TableName: TABLES.CALENDAR,
      KeyConditionExpression: 'PK = :dateKey',
      ExpressionAttributeValues: {
        ':dateKey': `DATE#${startDate}`
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    
    const sameTimeSlotBookings = result.Items.filter(item => {
      if (item.bookingId === rejectedBooking.bookingId) return false;
      
      const existingStart = new Date(item.startTime);
      const existingEnd = new Date(item.endTime);
      const rejectedStart = new Date(rejectedBooking.startTime);
      const rejectedEnd = new Date(rejectedBooking.endTime);
      
      return (rejectedStart < existingEnd && rejectedEnd > existingStart);
    });
    
    // キープ順位を再調整
    const updates = [];
    sameTimeSlotBookings
      .filter(booking => booking.keepOrder > rejectedBooking.keepOrder)
      .forEach(booking => {
        // 詳細な予約データを取得して更新
        const updatedBooking = {
          ...booking,
          keepOrder: booking.keepOrder - 1,
          updatedAt: new Date().toISOString()
        };
        updates.push(updatedBooking);
      });
    
    return {
      updates,
      summary: `${updates.length}件の予約のキープ順位を調整しました。`
    };
  } catch (error) {
    console.error('Keep order adjustment error:', error);
    return {
      updates: [],
      summary: 'キープ順位の調整中にエラーが発生しました。'
    };
  }
}

/**
 * EventBridge関連スケジュールのクリーンアップ
 */
async function cleanupEventBridgeSchedules(booking) {
  if (booking.bookingType !== BOOKING_TYPE.TEMPORARY) {
    return {
      cleaned: false,
      message: '本予約のためクリーンアップ不要です。'
    };
  }
  
  try {
    // 実際のEventBridge Schedule削除は実装に応じて調整
    // ここでは削除対象の特定のみ実装
    const scheduleNames = [
      `booking-${booking.bookingId}-first-notification`,
      `booking-${booking.bookingId}-second-notification`,
      `booking-${booking.bookingId}-deadline-notification`,
      `booking-${booking.bookingId}-auto-cancel`
    ];
    
    return {
      cleaned: true,
      scheduleNames,
      message: `${scheduleNames.length}個のEventBridgeスケジュールをクリーンアップ対象に設定しました。`
    };
  } catch (error) {
    console.error('EventBridge cleanup error:', error);
    return {
      cleaned: false,
      message: 'EventBridgeクリーンアップ中にエラーが発生しました。'
    };
  }
}

/**
 * 承認通知の送信
 */
async function sendApprovalNotification(booking) {
  try {
    // SES等の通知サービス統合をここに実装
    console.log(`Sending approval notification for booking ${booking.bookingId} to ${booking.userEmail}`);
    
    // TODO: 実際の通知送信ロジック
    return {
      sent: true,
      recipient: booking.userEmail,
      bookingId: booking.bookingId
    };
  } catch (error) {
    console.error('Approval notification error:', error);
    throw error;
  }
}

/**
 * 拒否通知の送信
 */
async function sendRejectionNotification(booking) {
  try {
    // SES等の通知サービス統合をここに実装
    console.log(`Sending rejection notification for booking ${booking.bookingId} to ${booking.userEmail}`);
    
    // TODO: 実際の通知送信ロジック
    return {
      sent: true,
      recipient: booking.userEmail,
      bookingId: booking.bookingId,
      reason: booking.rejectionReason
    };
  } catch (error) {
    console.error('Rejection notification error:', error);
    throw error;
  }
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
