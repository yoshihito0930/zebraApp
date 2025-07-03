const AWS = require('aws-sdk');
const { 
  TABLES, 
  BOOKING_TYPE,
  BOOKING_STATUS,
  TEMPORARY_BOOKING_DEADLINE_DAYS 
} = require('./constants');

const dynamoDB = new AWS.DynamoDB.DocumentClient();

/**
 * 仮予約の期限管理サービス
 * EventBridge連携と期限通知の準備機能を提供
 */

/**
 * 仮予約の確認期限を計算
 * @param {string} startTime - 予約開始時間（ISO形式）
 * @returns {Date} 確認期限（利用日7日前の18:00）
 */
function calculateConfirmationDeadline(startTime) {
  const bookingDate = new Date(startTime);
  
  // 利用日7日前の18:00を期限とする
  const deadline = new Date(bookingDate);
  deadline.setDate(deadline.getDate() - TEMPORARY_BOOKING_DEADLINE_DAYS);
  deadline.setHours(18, 0, 0, 0);
  
  return deadline;
}

/**
 * 仮予約の通知スケジュールを計算
 * @param {string} startTime - 予約開始時間（ISO形式）
 * @returns {Object} 通知スケジュール情報
 */
function calculateNotificationSchedule(startTime) {
  const bookingDate = new Date(startTime);
  const confirmationDeadline = calculateConfirmationDeadline(startTime);
  
  // 利用日10日前と8日前に通知
  const firstNotificationDate = new Date(bookingDate);
  firstNotificationDate.setDate(firstNotificationDate.getDate() - 10);
  firstNotificationDate.setHours(18, 0, 0, 0);
  
  const secondNotificationDate = new Date(bookingDate);
  secondNotificationDate.setDate(secondNotificationDate.getDate() - 8);
  secondNotificationDate.setHours(18, 0, 0, 0);
  
  const now = new Date();
  
  return {
    confirmationDeadline: confirmationDeadline.toISOString(),
    firstNotification: {
      date: firstNotificationDate.toISOString(),
      shouldSend: firstNotificationDate > now
    },
    secondNotification: {
      date: secondNotificationDate.toISOString(),
      shouldSend: secondNotificationDate > now
    },
    deadlineNotification: {
      date: confirmationDeadline.toISOString(),
      shouldSend: confirmationDeadline > now
    }
  };
}

/**
 * 期限切れの仮予約を検索
 * @returns {Promise<Array>} 期限切れの仮予約リスト
 */
async function findExpiredTemporaryBookings() {
  const now = new Date().toISOString();
  
  try {
    // 仮予約で確認期限が過ぎたものを検索
    const params = {
      TableName: TABLES.BOOKINGS,
      IndexName: 'BookingStatusIndex', // GSI2
      KeyConditionExpression: 'GSI2PK = :statusKey',
      FilterExpression: 'bookingType = :bookingType AND confirmationDeadline < :now AND confirmationDeadline <> :null',
      ExpressionAttributeValues: {
        ':statusKey': `STATUS#${BOOKING_STATUS.APPROVED}`,
        ':bookingType': BOOKING_TYPE.TEMPORARY,
        ':now': now,
        ':null': null
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error('期限切れ仮予約検索エラー:', error);
    return [];
  }
}

/**
 * 期限切れ仮予約の自動キャンセル処理（EventBridge用）
 * @param {string} bookingId - 予約ID
 * @param {string} userId - ユーザーID
 * @returns {Promise<Object>} 処理結果
 */
async function processExpiredTemporaryBooking(bookingId, userId) {
  try {
    // 予約詳細を取得
    const params = {
      TableName: TABLES.BOOKINGS,
      Key: {
        PK: `BOOKING#${bookingId}`,
        SK: `USER#${userId}`
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (!result.Item) {
      return {
        success: false,
        message: '予約が見つかりません。'
      };
    }
    
    const booking = result.Item;
    
    // 既にキャンセル済みまたは仮予約でない場合はスキップ
    if (booking.status === BOOKING_STATUS.CANCELLED || 
        booking.bookingType !== BOOKING_TYPE.TEMPORARY) {
      return {
        success: false,
        message: '処理対象外の予約です。'
      };
    }
    
    // 確認期限をチェック
    const now = new Date();
    const deadline = new Date(booking.confirmationDeadline);
    
    if (now <= deadline) {
      return {
        success: false,
        message: 'まだ期限切れではありません。'
      };
    }
    
    // 自動キャンセル処理
    const updatedBooking = {
      ...booking,
      status: BOOKING_STATUS.CANCELLED,
      cancellationReason: '仮予約確認期限切れによる自動キャンセル',
      cancellationFeePercent: 0,
      updatedAt: now.toISOString()
    };
    
    // GSIキーを更新
    updatedBooking.GSI2PK = `STATUS#${BOOKING_STATUS.CANCELLED}`;
    
    // Bookingsテーブルを更新
    await dynamoDB.put({
      TableName: TABLES.BOOKINGS,
      Item: updatedBooking
    }).promise();
    
    // カレンダーテーブルから削除
    const startDate = new Date(booking.startTime).toISOString().split('T')[0];
    const startTime = new Date(booking.startTime).toISOString().split('T')[1].slice(0, 8);
    const endTime = new Date(booking.endTime).toISOString().split('T')[1].slice(0, 8);
    
    await dynamoDB.delete({
      TableName: TABLES.CALENDAR,
      Key: {
        PK: `DATE#${startDate}`,
        SK: `TIME#${startTime}#${endTime}#${bookingId}`
      }
    }).promise();
    
    return {
      success: true,
      message: '期限切れ仮予約を自動キャンセルしました。',
      booking: updatedBooking
    };
    
  } catch (error) {
    console.error('期限切れ仮予約処理エラー:', error);
    return {
      success: false,
      message: '自動キャンセル処理中にエラーが発生しました。'
    };
  }
}

/**
 * EventBridge用の通知データを生成
 * @param {Object} booking - 予約データ
 * @param {string} notificationType - 通知タイプ ('first', 'second', 'deadline')
 * @returns {Object} EventBridge用のイベントデータ
 */
function generateEventBridgeNotificationData(booking, notificationType) {
  const schedule = calculateNotificationSchedule(booking.startTime);
  
  let scheduledTime;
  let message;
  
  switch (notificationType) {
    case 'first':
      scheduledTime = schedule.firstNotification.date;
      message = '仮予約の確認期限が近づいています（利用日10日前通知）';
      break;
    case 'second':
      scheduledTime = schedule.secondNotification.date;
      message = '仮予約の確認期限が近づいています（利用日8日前通知）';
      break;
    case 'deadline':
      scheduledTime = schedule.deadlineNotification.date;
      message = '仮予約の確認期限です。本日18:00までに確定のご連絡をお願いします。';
      break;
    default:
      throw new Error('無効な通知タイプです。');
  }
  
  return {
    source: 'studio-booking-system',
    detailType: 'Temporary Booking Notification',
    detail: {
      bookingId: booking.bookingId,
      userId: booking.userId,
      userEmail: booking.userEmail,
      userName: booking.userName,
      notificationType,
      scheduledTime,
      message,
      bookingStartTime: booking.startTime,
      bookingEndTime: booking.endTime,
      confirmationDeadline: booking.confirmationDeadline
    }
  };
}

/**
 * EventBridge用の自動キャンセルデータを生成
 * @param {Object} booking - 予約データ
 * @returns {Object} EventBridge用の自動キャンセルイベントデータ
 */
function generateEventBridgeAutoCancelData(booking) {
  const deadline = new Date(booking.confirmationDeadline);
  // 期限の1時間後に自動キャンセル処理を実行
  deadline.setHours(deadline.getHours() + 1);
  
  return {
    source: 'studio-booking-system',
    detailType: 'Temporary Booking Auto Cancel',
    detail: {
      bookingId: booking.bookingId,
      userId: booking.userId,
      scheduledTime: deadline.toISOString(),
      action: 'auto-cancel',
      reason: '仮予約確認期限切れ'
    }
  };
}

/**
 * 仮予約通知対象を取得
 * @param {string} notificationType - 通知タイプ ('first', 'second', 'deadline')
 * @returns {Promise<Array>} 通知対象の予約リスト
 */
async function getNotificationTargetBookings(notificationType) {
  const now = new Date();
  const targetDate = new Date(now);
  
  // 通知タイプに応じて対象日を計算
  switch (notificationType) {
    case 'first':
      targetDate.setDate(targetDate.getDate() + 10);
      break;
    case 'second':
      targetDate.setDate(targetDate.getDate() + 8);
      break;
    case 'deadline':
      targetDate.setDate(targetDate.getDate() + 7);
      break;
    default:
      throw new Error('無効な通知タイプです。');
  }
  
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  
  try {
    // 該当日の仮予約を検索
    const params = {
      TableName: TABLES.BOOKINGS,
      IndexName: 'BookingStatusIndex',
      KeyConditionExpression: 'GSI2PK = :statusKey',
      FilterExpression: 'bookingType = :bookingType AND startTime >= :startDate AND startTime < :endDate',
      ExpressionAttributeValues: {
        ':statusKey': `STATUS#${BOOKING_STATUS.APPROVED}`,
        ':bookingType': BOOKING_TYPE.TEMPORARY,
        ':startDate': targetDate.toISOString(),
        ':endDate': nextDay.toISOString()
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error('通知対象取得エラー:', error);
    return [];
  }
}

/**
 * 仮予約の期限状況を確認
 * @param {string} bookingId - 予約ID
 * @param {string} userId - ユーザーID
 * @returns {Promise<Object>} 期限状況
 */
async function checkBookingDeadlineStatus(bookingId, userId) {
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
      return {
        exists: false,
        message: '予約が見つかりません。'
      };
    }
    
    const booking = result.Item;
    
    if (booking.bookingType !== BOOKING_TYPE.TEMPORARY) {
      return {
        exists: true,
        isTemporary: false,
        message: '本予約のため期限管理の対象外です。'
      };
    }
    
    const now = new Date();
    const deadline = booking.confirmationDeadline ? new Date(booking.confirmationDeadline) : null;
    
    if (!deadline) {
      return {
        exists: true,
        isTemporary: true,
        hasDeadline: false,
        message: '確認期限が設定されていません。'
      };
    }
    
    const isExpired = now > deadline;
    const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    
    return {
      exists: true,
      isTemporary: true,
      hasDeadline: true,
      deadline: deadline.toISOString(),
      isExpired,
      daysLeft: isExpired ? 0 : daysLeft,
      message: isExpired 
        ? '確認期限が過ぎています。' 
        : `確認期限まで${daysLeft}日です。`
    };
    
  } catch (error) {
    console.error('期限状況確認エラー:', error);
    return {
      exists: false,
      error: true,
      message: '期限状況の確認中にエラーが発生しました。'
    };
  }
}

module.exports = {
  calculateConfirmationDeadline,
  calculateNotificationSchedule,
  findExpiredTemporaryBookings,
  processExpiredTemporaryBooking,
  generateEventBridgeNotificationData,
  generateEventBridgeAutoCancelData,
  getNotificationTargetBookings,
  checkBookingDeadlineStatus
};
