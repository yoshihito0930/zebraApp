const AWS = require('aws-sdk');
const { 
  TABLES, 
  BOOKING_TYPE,
  BOOKING_STATUS 
} = require('./lib/constants');
const deadlineService = require('./lib/deadlineService');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const eventBridge = new AWS.EventBridge();

/**
 * DynamoDBストリーム処理によるBookingsテーブルイベント監視
 * 予約の作成・更新・削除を検知し、適切な後続処理を実行
 */

/**
 * メインのストリーム処理ハンドラー
 * @param {Object} event - DynamoDBストリームイベント
 * @param {Object} context - Lambda実行コンテキスト
 */
exports.handler = async (event, context) => {
  console.log('DynamoDBストリームイベント受信:', JSON.stringify(event, null, 2));
  
  const results = [];
  
  // 各レコードを並行処理
  const processingPromises = event.Records.map(async (record) => {
    try {
      const result = await processStreamRecord(record);
      results.push(result);
      return result;
    } catch (error) {
      console.error('レコード処理エラー:', error);
      results.push({
        success: false,
        error: error.message,
        record: record.eventID
      });
      // 個別エラーは記録するが、全体の処理は継続
      return { success: false, error: error.message };
    }
  });
  
  await Promise.all(processingPromises);
  
  console.log('ストリーム処理完了:', JSON.stringify(results, null, 2));
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'ストリーム処理完了',
      processedRecords: results.length,
      results
    })
  };
};

/**
 * 個別のストリームレコードを処理
 * @param {Object} record - DynamoDBストリームレコード
 * @returns {Promise<Object>} 処理結果
 */
async function processStreamRecord(record) {
  const { eventName, dynamodb } = record;
  
  console.log(`イベント処理開始: ${eventName}`);
  
  switch (eventName) {
    case 'INSERT':
      return await handleBookingCreated(dynamodb.NewImage);
      
    case 'MODIFY':
      return await handleBookingModified(dynamodb.OldImage, dynamodb.NewImage);
      
    case 'REMOVE':
      return await handleBookingRemoved(dynamodb.OldImage);
      
    default:
      console.log(`未対応のイベントタイプ: ${eventName}`);
      return { success: true, message: '未対応のイベントタイプ', eventName };
  }
}

/**
 * 予約作成時の処理
 * @param {Object} newImage - 新規作成された予約データ
 * @returns {Promise<Object>} 処理結果
 */
async function handleBookingCreated(newImage) {
  const booking = unmarshallDynamoDBItem(newImage);
  console.log('新規予約作成:', booking.bookingId);
  
  const tasks = [];
  
  // 1. 管理者向け通知を生成
  tasks.push(createAdminNotification(booking, 'new_booking'));
  
  // 2. 仮予約の場合は確認期限管理を設定
  if (booking.bookingType === BOOKING_TYPE.TEMPORARY) {
    tasks.push(setupTemporaryBookingDeadlineManagement(booking));
  }
  
  // 3. ユーザー向け作成完了通知
  tasks.push(createUserNotification(booking, 'booking_created'));
  
  const results = await Promise.allSettled(tasks);
  
  return {
    success: true,
    message: '予約作成処理完了',
    bookingId: booking.bookingId,
    taskResults: results.map((result, index) => ({
      task: ['admin_notification', 'deadline_management', 'user_notification'][index],
      status: result.status,
      value: result.value || result.reason
    }))
  };
}

/**
 * 予約更新時の処理
 * @param {Object} oldImage - 更新前の予約データ
 * @param {Object} newImage - 更新後の予約データ
 * @returns {Promise<Object>} 処理結果
 */
async function handleBookingModified(oldImage, newImage) {
  const oldBooking = unmarshallDynamoDBItem(oldImage);
  const newBooking = unmarshallDynamoDBItem(newImage);
  
  console.log('予約更新:', newBooking.bookingId);
  
  const tasks = [];
  const changes = detectChanges(oldBooking, newBooking);
  
  // ステータス変更の処理
  if (changes.status) {
    tasks.push(handleStatusChange(oldBooking, newBooking));
  }
  
  // 予約タイプ変更の処理（仮予約→本予約など）
  if (changes.bookingType) {
    tasks.push(handleBookingTypeChange(oldBooking, newBooking));
  }
  
  // 日時変更の処理
  if (changes.timeSlot) {
    tasks.push(handleTimeSlotChange(oldBooking, newBooking));
  }
  
  const results = await Promise.allSettled(tasks);
  
  return {
    success: true,
    message: '予約更新処理完了',
    bookingId: newBooking.bookingId,
    changes,
    taskResults: results.map((result, index) => ({
      task: Object.keys(changes)[index],
      status: result.status,
      value: result.value || result.reason
    }))
  };
}

/**
 * 予約削除時の処理
 * @param {Object} oldImage - 削除された予約データ
 * @returns {Promise<Object>} 処理結果
 */
async function handleBookingRemoved(oldImage) {
  const booking = unmarshallDynamoDBItem(oldImage);
  console.log('予約削除:', booking.bookingId);
  
  const tasks = [];
  
  // 1. 関係者への削除通知
  tasks.push(createUserNotification(booking, 'booking_deleted'));
  tasks.push(createAdminNotification(booking, 'booking_deleted'));
  
  // 2. 関連する通知スケジュールの削除
  if (booking.bookingType === BOOKING_TYPE.TEMPORARY) {
    tasks.push(cleanupTemporaryBookingSchedules(booking));
  }
  
  const results = await Promise.allSettled(tasks);
  
  return {
    success: true,
    message: '予約削除処理完了',
    bookingId: booking.bookingId,
    taskResults: results.map((result, index) => ({
      task: ['user_notification', 'admin_notification', 'schedule_cleanup'][index],
      status: result.status,
      value: result.value || result.reason
    }))
  };
}

/**
 * 予約ステータス変更の処理
 * @param {Object} oldBooking - 更新前の予約
 * @param {Object} newBooking - 更新後の予約
 * @returns {Promise<Object>} 処理結果
 */
async function handleStatusChange(oldBooking, newBooking) {
  const oldStatus = oldBooking.status;
  const newStatus = newBooking.status;
  
  console.log(`ステータス変更: ${oldStatus} → ${newStatus}`);
  
  const tasks = [];
  
  switch (newStatus) {
    case BOOKING_STATUS.APPROVED:
      // 承認時の処理
      tasks.push(createUserNotification(newBooking, 'booking_approved'));
      
      // 仮予約の場合は確認期限管理を開始
      if (newBooking.bookingType === BOOKING_TYPE.TEMPORARY && 
          newBooking.confirmationDeadline) {
        tasks.push(setupTemporaryBookingDeadlineManagement(newBooking));
      }
      break;
      
    case BOOKING_STATUS.REJECTED:
      // 拒否時の処理
      tasks.push(createUserNotification(newBooking, 'booking_rejected'));
      break;
      
    case BOOKING_STATUS.CANCELLED:
      // キャンセル時の処理
      tasks.push(createUserNotification(newBooking, 'booking_cancelled'));
      tasks.push(createAdminNotification(newBooking, 'booking_cancelled'));
      
      // 仮予約の通知スケジュール削除
      if (newBooking.bookingType === BOOKING_TYPE.TEMPORARY) {
        tasks.push(cleanupTemporaryBookingSchedules(newBooking));
      }
      break;
  }
  
  const results = await Promise.allSettled(tasks);
  
  return {
    success: true,
    message: `ステータス変更処理完了: ${oldStatus} → ${newStatus}`,
    results
  };
}

/**
 * 予約タイプ変更の処理
 * @param {Object} oldBooking - 更新前の予約
 * @param {Object} newBooking - 更新後の予約
 * @returns {Promise<Object>} 処理結果
 */
async function handleBookingTypeChange(oldBooking, newBooking) {
  const oldType = oldBooking.bookingType;
  const newType = newBooking.bookingType;
  
  console.log(`予約タイプ変更: ${oldType} → ${newType}`);
  
  const tasks = [];
  
  // 仮予約から本予約への変更
  if (oldType === BOOKING_TYPE.TEMPORARY && newType === BOOKING_TYPE.CONFIRMED) {
    // 確認完了通知
    tasks.push(createUserNotification(newBooking, 'booking_confirmed'));
    tasks.push(createAdminNotification(newBooking, 'booking_confirmed'));
    
    // 仮予約の通知スケジュール削除
    tasks.push(cleanupTemporaryBookingSchedules(newBooking));
  }
  
  const results = await Promise.allSettled(tasks);
  
  return {
    success: true,
    message: `予約タイプ変更処理完了: ${oldType} → ${newType}`,
    results
  };
}

/**
 * 日時変更の処理
 * @param {Object} oldBooking - 更新前の予約
 * @param {Object} newBooking - 更新後の予約
 * @returns {Promise<Object>} 処理結果
 */
async function handleTimeSlotChange(oldBooking, newBooking) {
  console.log('予約日時変更');
  
  const tasks = [];
  
  // 日時変更通知
  tasks.push(createUserNotification(newBooking, 'booking_time_changed'));
  tasks.push(createAdminNotification(newBooking, 'booking_time_changed'));
  
  // 仮予約の場合は新しい期限で通知スケジュール再設定
  if (newBooking.bookingType === BOOKING_TYPE.TEMPORARY &&
      newBooking.status === BOOKING_STATUS.APPROVED) {
    tasks.push(cleanupTemporaryBookingSchedules(oldBooking));
    tasks.push(setupTemporaryBookingDeadlineManagement(newBooking));
  }
  
  const results = await Promise.allSettled(tasks);
  
  return {
    success: true,
    message: '予約日時変更処理完了',
    results
  };
}

/**
 * 仮予約の期限管理を設定
 * @param {Object} booking - 予約データ
 * @returns {Promise<Object>} 処理結果
 */
async function setupTemporaryBookingDeadlineManagement(booking) {
  try {
    // 確認期限が設定されていない場合はスキップ
    if (!booking.confirmationDeadline) {
      return {
        success: true,
        message: '確認期限が設定されていないためスキップ'
      };
    }
    
    const schedule = deadlineService.calculateNotificationSchedule(booking.startTime);
    const events = [];
    
    // 10日前通知のEventBridgeイベント生成
    if (schedule.firstNotification.shouldSend) {
      const notificationEvent = deadlineService.generateEventBridgeNotificationData(
        booking, 'first'
      );
      events.push(publishEventBridgeEvent(notificationEvent));
    }
    
    // 8日前通知のEventBridgeイベント生成
    if (schedule.secondNotification.shouldSend) {
      const notificationEvent = deadlineService.generateEventBridgeNotificationData(
        booking, 'second'
      );
      events.push(publishEventBridgeEvent(notificationEvent));
    }
    
    // 期限日通知のEventBridgeイベント生成
    if (schedule.deadlineNotification.shouldSend) {
      const deadlineEvent = deadlineService.generateEventBridgeNotificationData(
        booking, 'deadline'
      );
      events.push(publishEventBridgeEvent(deadlineEvent));
    }
    
    // 自動キャンセルのEventBridgeイベント生成
    const autoCancelEvent = deadlineService.generateEventBridgeAutoCancelData(booking);
    events.push(publishEventBridgeEvent(autoCancelEvent));
    
    await Promise.all(events);
    
    return {
      success: true,
      message: '仮予約期限管理設定完了',
      scheduledEvents: events.length
    };
    
  } catch (error) {
    console.error('仮予約期限管理設定エラー:', error);
    return {
      success: false,
      message: '仮予約期限管理設定失敗',
      error: error.message
    };
  }
}

/**
 * 仮予約の通知スケジュールをクリーンアップ
 * @param {Object} booking - 予約データ
 * @returns {Promise<Object>} 処理結果
 */
async function cleanupTemporaryBookingSchedules(booking) {
  try {
    // TODO: EventBridge Schedulerからの削除処理を実装
    // 現在はログ出力のみ
    console.log('仮予約通知スケジュールクリーンアップ:', booking.bookingId);
    
    return {
      success: true,
      message: '仮予約通知スケジュールクリーンアップ完了'
    };
    
  } catch (error) {
    console.error('通知スケジュールクリーンアップエラー:', error);
    return {
      success: false,
      message: '通知スケジュールクリーンアップ失敗',
      error: error.message
    };
  }
}

/**
 * ユーザー向け通知を作成
 * @param {Object} booking - 予約データ
 * @param {string} notificationType - 通知タイプ
 * @returns {Promise<Object>} 処理結果
 */
async function createUserNotification(booking, notificationType) {
  try {
    const notificationMessages = {
      booking_created: '予約申請を受け付けました。承認をお待ちください。',
      booking_approved: '予約申請が承認されました。',
      booking_rejected: '予約申請が拒否されました。',
      booking_cancelled: '予約がキャンセルされました。',
      booking_confirmed: '仮予約が本予約として確定されました。',
      booking_time_changed: '予約時間が変更されました。',
      booking_deleted: '予約が削除されました。'
    };
    
    const notification = {
      PK: `USER#${booking.userId}`,
      SK: `NOTIFICATION#${new Date().toISOString()}`,
      'TYPE#booking': new Date().toISOString(),
      title: getNotificationTitle(notificationType),
      content: notificationMessages[notificationType] || '予約に関する更新があります。',
      type: 'booking',
      isRead: false,
      relatedEntityId: booking.bookingId,
      createdAt: new Date().toISOString(),
      readAt: null
    };
    
    await dynamoDB.put({
      TableName: TABLES.NOTIFICATIONS || 'studio-booking-notifications',
      Item: notification
    }).promise();
    
    return {
      success: true,
      message: 'ユーザー通知作成完了',
      notificationType
    };
    
  } catch (error) {
    console.error('ユーザー通知作成エラー:', error);
    return {
      success: false,
      message: 'ユーザー通知作成失敗',
      error: error.message
    };
  }
}

/**
 * 管理者向け通知を作成
 * @param {Object} booking - 予約データ
 * @param {string} notificationType - 通知タイプ
 * @returns {Promise<Object>} 処理結果
 */
async function createAdminNotification(booking, notificationType) {
  try {
    // TODO: 管理者ユーザーIDの取得処理を実装
    const adminUserId = 'ADMIN'; // 暫定値
    
    const adminNotificationMessages = {
      new_booking: `新しい予約申請があります。（${booking.userName}様）`,
      booking_cancelled: `予約がキャンセルされました。（${booking.userName}様）`,
      booking_confirmed: `仮予約が本予約として確定されました。（${booking.userName}様）`,
      booking_time_changed: `予約時間が変更されました。（${booking.userName}様）`,
      booking_deleted: `予約が削除されました。（${booking.userName}様）`
    };
    
    const notification = {
      PK: `USER#${adminUserId}`,
      SK: `NOTIFICATION#${new Date().toISOString()}`,
      'TYPE#admin': new Date().toISOString(),
      title: getAdminNotificationTitle(notificationType),
      content: adminNotificationMessages[notificationType] || '予約に関する管理者向け更新があります。',
      type: 'admin',
      isRead: false,
      relatedEntityId: booking.bookingId,
      createdAt: new Date().toISOString(),
      readAt: null
    };
    
    await dynamoDB.put({
      TableName: TABLES.NOTIFICATIONS || 'studio-booking-notifications',
      Item: notification
    }).promise();
    
    return {
      success: true,
      message: '管理者通知作成完了',
      notificationType
    };
    
  } catch (error) {
    console.error('管理者通知作成エラー:', error);
    return {
      success: false,
      message: '管理者通知作成失敗',
      error: error.message
    };
  }
}

/**
 * EventBridgeイベントを発行
 * @param {Object} eventData - イベントデータ
 * @returns {Promise<Object>} 処理結果
 */
async function publishEventBridgeEvent(eventData) {
  try {
    const params = {
      Entries: [
        {
          Source: eventData.source,
          DetailType: eventData.detailType,
          Detail: JSON.stringify(eventData.detail),
          Time: new Date()
        }
      ]
    };
    
    const result = await eventBridge.putEvents(params).promise();
    
    return {
      success: true,
      message: 'EventBridgeイベント発行完了',
      eventId: result.Entries[0].EventId
    };
    
  } catch (error) {
    console.error('EventBridgeイベント発行エラー:', error);
    return {
      success: false,
      message: 'EventBridgeイベント発行失敗',
      error: error.message
    };
  }
}

/**
 * DynamoDBアイテムのアンマーシャル処理
 * @param {Object} item - DynamoDBの型付きアイテム
 * @returns {Object} 通常のJavaScriptオブジェクト
 */
function unmarshallDynamoDBItem(item) {
  return AWS.DynamoDB.Converter.unmarshall(item);
}

/**
 * 予約データの変更点を検出
 * @param {Object} oldBooking - 変更前の予約
 * @param {Object} newBooking - 変更後の予約
 * @returns {Object} 変更点
 */
function detectChanges(oldBooking, newBooking) {
  const changes = {};
  
  if (oldBooking.status !== newBooking.status) {
    changes.status = {
      from: oldBooking.status,
      to: newBooking.status
    };
  }
  
  if (oldBooking.bookingType !== newBooking.bookingType) {
    changes.bookingType = {
      from: oldBooking.bookingType,
      to: newBooking.bookingType
    };
  }
  
  if (oldBooking.startTime !== newBooking.startTime || 
      oldBooking.endTime !== newBooking.endTime) {
    changes.timeSlot = {
      from: {
        startTime: oldBooking.startTime,
        endTime: oldBooking.endTime
      },
      to: {
        startTime: newBooking.startTime,
        endTime: newBooking.endTime
      }
    };
  }
  
  return changes;
}

/**
 * 通知タイトルを取得
 * @param {string} notificationType - 通知タイプ
 * @returns {string} 通知タイトル
 */
function getNotificationTitle(notificationType) {
  const titles = {
    booking_created: '予約申請受付完了',
    booking_approved: '予約申請承認',
    booking_rejected: '予約申請拒否',
    booking_cancelled: '予約キャンセル',
    booking_confirmed: '仮予約確定',
    booking_time_changed: '予約時間変更',
    booking_deleted: '予約削除'
  };
  
  return titles[notificationType] || '予約更新';
}

/**
 * 管理者向け通知タイトルを取得
 * @param {string} notificationType - 通知タイプ
 * @returns {string} 管理者向け通知タイトル
 */
function getAdminNotificationTitle(notificationType) {
  const titles = {
    new_booking: '新規予約申請',
    booking_cancelled: '予約キャンセル（管理者向け）',
    booking_confirmed: '仮予約確定（管理者向け）',
    booking_time_changed: '予約時間変更（管理者向け）',
    booking_deleted: '予約削除（管理者向け）'
  };
  
  return titles[notificationType] || '予約管理更新';
}
