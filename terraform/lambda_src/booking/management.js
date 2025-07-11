const AWS = require('aws-sdk');
const { 
  TABLES, 
  BOOKING_STATUS,
  BOOKING_TYPE,
  ERROR_CODES, 
  RESPONSE_HEADERS 
} = require('./lib/constants');

const dynamoDB = new AWS.DynamoDB.DocumentClient();

/**
 * 管理者向け予約一覧・管理Lambda関数
 * 包括的な予約管理機能を提供
 */
exports.handler = async (event) => {
  try {
    console.log('Booking management event received:', JSON.stringify(event, null, 2));
    
    const userId = getUserIdFromEvent(event);
    const isAdmin = getIsAdminFromEvent(event);
    
    // 認証チェック
    if (!userId) {
      return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
    }
    
    // 管理者権限チェック
    if (!isAdmin) {
      return createErrorResponse(403, ERROR_CODES.FORBIDDEN, '管理者権限が必要です。');
    }
    
    // パスとメソッドに基づいて処理を分岐
    const path = event.path || event.resource || '';
    const method = event.httpMethod;
    
    if (path.includes('/admin/bookings/statistics') && method === 'GET') {
      return await handleBookingStatistics(event);
    } else if (path.includes('/admin/bookings/pending') && method === 'GET') {
      return await handlePendingBookings(event);
    } else if (path.includes('/admin/bookings/expiring-soon') && method === 'GET') {
      return await handleExpiringSoonBookings(event);
    } else if (path.includes('/admin/bookings/bulk-approve') && method === 'PUT') {
      return await handleBulkApprove(event, userId);
    } else if (path.includes('/admin/bookings/bulk-reject') && method === 'PUT') {
      return await handleBulkReject(event, userId);
    } else if (path.includes('/admin/bookings') && method === 'GET') {
      return await handleBookingsList(event);
    } else {
      return createErrorResponse(404, ERROR_CODES.NOT_FOUND, '指定されたエンドポイントが見つかりません。');
    }
    
  } catch (error) {
    console.error('Booking management error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '予約管理処理中にエラーが発生しました。');
  }
};

/**
 * 予約一覧取得（管理者用）
 */
async function handleBookingsList(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    
    // パラメータ解析
    const {
      status,
      bookingType,
      userId,
      fromDate,
      toDate,
      keepOrder,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryParams;
    
    // 入力値検証
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    
    let result;
    let totalCount = 0;
    
    // メインクエリの実行
    if (status) {
      // ステータス別検索
      result = await getBookingsByStatus(status, {
        bookingType,
        userId,
        fromDate,
        toDate,
        keepOrder,
        page: pageNum,
        limit: limitNum,
        sortBy,
        sortOrder
      });
    } else if (userId) {
      // ユーザー別検索
      result = await getBookingsByUser(userId, {
        status,
        bookingType,
        fromDate,
        toDate,
        page: pageNum,
        limit: limitNum,
        sortBy,
        sortOrder
      });
    } else if (fromDate || toDate) {
      // 日付範囲検索
      result = await getBookingsByDateRange(fromDate, toDate, {
        status,
        bookingType,
        userId,
        keepOrder,
        page: pageNum,
        limit: limitNum,
        sortBy,
        sortOrder
      });
    } else {
      // 全体検索（複数ステータスから取得）
      result = await getAllBookingsWithFilters({
        bookingType,
        keepOrder,
        page: pageNum,
        limit: limitNum,
        sortBy,
        sortOrder
      });
    }
    
    // ユーザー情報の追加取得
    const enrichedBookings = await enrichBookingsWithUserInfo(result.bookings);
    
    // 統計情報の取得
    const statistics = await getBookingStatisticsSummary(queryParams);
    
    const response = {
      data: enrichedBookings,
      pagination: {
        total: result.totalCount,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(result.totalCount / limitNum),
        hasNext: pageNum * limitNum < result.totalCount,
        hasPrev: pageNum > 1
      },
      filters: {
        status,
        bookingType,
        userId,
        fromDate,
        toDate,
        keepOrder
      },
      statistics,
      generatedAt: new Date().toISOString()
    };
    
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Get bookings list error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '予約一覧の取得中にエラーが発生しました。');
  }
}

/**
 * 承認待ち予約一覧取得
 */
async function handlePendingBookings(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const {
      bookingType,
      urgent = false,
      page = 1,
      limit = 20
    } = queryParams;
    
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    
    // 承認待ち予約を取得
    const result = await getBookingsByStatus(BOOKING_STATUS.PENDING, {
      bookingType,
      page: pageNum,
      limit: limitNum,
      sortBy: 'createdAt',
      sortOrder: 'asc'  // 古いものから表示
    });
    
    let pendingBookings = result.bookings;
    
    // 緊急フラグがある場合、期限が近いものを優先
    if (urgent === 'true') {
      pendingBookings = pendingBookings.filter(booking => {
        if (booking.bookingType === BOOKING_TYPE.TEMPORARY && booking.confirmationDeadline) {
          const deadline = new Date(booking.confirmationDeadline);
          const now = new Date();
          const hoursToDeadline = (deadline - now) / (1000 * 60 * 60);
          return hoursToDeadline <= 48; // 48時間以内
        }
        return false;
      });
    }
    
    // ユーザー情報の追加
    const enrichedBookings = await enrichBookingsWithUserInfo(pendingBookings);
    
    // 優先度の計算
    const bookingsWithPriority = enrichedBookings.map(booking => ({
      ...booking,
      priority: calculateBookingPriority(booking),
      timeToDeadline: booking.confirmationDeadline ? 
        calculateTimeToDeadline(booking.confirmationDeadline) : null
    }));
    
    // 優先度でソート
    bookingsWithPriority.sort((a, b) => b.priority - a.priority);
    
    const response = {
      data: bookingsWithPriority,
      pagination: {
        total: result.totalCount,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(result.totalCount / limitNum)
      },
      summary: {
        totalPending: result.totalCount,
        urgentCount: bookingsWithPriority.filter(b => b.priority >= 3).length,
        temporaryCount: bookingsWithPriority.filter(b => b.bookingType === BOOKING_TYPE.TEMPORARY).length,
        confirmedCount: bookingsWithPriority.filter(b => b.bookingType === BOOKING_TYPE.CONFIRMED).length
      },
      generatedAt: new Date().toISOString()
    };
    
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Get pending bookings error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '承認待ち予約の取得中にエラーが発生しました。');
  }
}

/**
 * 期限切れ間近予約取得
 */
async function handleExpiringSoonBookings(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const {
      hours = 24,
      page = 1,
      limit = 20
    } = queryParams;
    
    const hoursThreshold = Math.max(1, parseInt(hours, 10));
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    
    const now = new Date();
    const thresholdTime = new Date(now.getTime() + hoursThreshold * 60 * 60 * 1000);
    
    // 承認済み仮予約で期限が近いものを取得
    const params = {
      TableName: TABLES.BOOKINGS,
      IndexName: 'StatusBookingsIndex',
      KeyConditionExpression: 'GSI2PK = :statusKey',
      FilterExpression: 'bookingType = :tempType AND confirmationDeadline <= :threshold AND confirmationDeadline > :now',
      ExpressionAttributeValues: {
        ':statusKey': `STATUS#${BOOKING_STATUS.APPROVED}`,
        ':tempType': BOOKING_TYPE.TEMPORARY,
        ':threshold': thresholdTime.toISOString(),
        ':now': now.toISOString()
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    const expiringBookings = result.Items || [];
    
    // ユーザー情報の追加
    const enrichedBookings = await enrichBookingsWithUserInfo(expiringBookings);
    
    // 期限までの時間で並び替え
    enrichedBookings.sort((a, b) => {
      const aTime = new Date(a.confirmationDeadline);
      const bTime = new Date(b.confirmationDeadline);
      return aTime - bTime;
    });
    
    // ページネーション適用
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedBookings = enrichedBookings.slice(startIndex, startIndex + limitNum);
    
    const response = {
      data: paginatedBookings.map(booking => ({
        ...booking,
        timeToDeadline: calculateTimeToDeadline(booking.confirmationDeadline),
        urgencyLevel: calculateUrgencyLevel(booking.confirmationDeadline)
      })),
      pagination: {
        total: enrichedBookings.length,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(enrichedBookings.length / limitNum)
      },
      threshold: {
        hours: hoursThreshold,
        thresholdTime: thresholdTime.toISOString()
      },
      generatedAt: new Date().toISOString()
    };
    
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Get expiring soon bookings error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '期限切れ間近予約の取得中にエラーが発生しました。');
  }
}

/**
 * 予約統計情報取得
 */
async function handleBookingStatistics(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const {
      period = 'month',
      fromDate,
      toDate
    } = queryParams;
    
    let startDate, endDate;
    
    if (fromDate && toDate) {
      startDate = fromDate;
      endDate = toDate;
    } else {
      const now = new Date();
      switch (period) {
        case 'today':
          startDate = endDate = now.toISOString().split('T')[0];
          break;
        case 'week':
          startDate = getWeekStart(now);
          endDate = now.toISOString().split('T')[0];
          break;
        case 'month':
          startDate = getMonthStart(now);
          endDate = now.toISOString().split('T')[0];
          break;
        case 'year':
          startDate = getYearStart(now);
          endDate = now.toISOString().split('T')[0];
          break;
        default:
          startDate = getMonthStart(now);
          endDate = now.toISOString().split('T')[0];
      }
    }
    
    const [
      statusStats,
      typeStats,
      dailyStats,
      keepStats,
      revenueStats
    ] = await Promise.all([
      getBookingStatusStatistics(startDate, endDate),
      getBookingTypeStatistics(startDate, endDate),
      getDailyBookingStatistics(startDate, endDate),
      getKeepSystemStatistics(startDate, endDate),
      calculateBookingRevenue(startDate, endDate)
    ]);
    
    const response = {
      period: {
        type: period,
        startDate,
        endDate
      },
      summary: {
        totalBookings: statusStats.total,
        pendingBookings: statusStats.pending,
        approvedBookings: statusStats.approved,
        rejectedBookings: statusStats.rejected,
        cancelledBookings: statusStats.cancelled
      },
      statusBreakdown: statusStats,
      typeBreakdown: typeStats,
      keepSystemStats: keepStats,
      dailyTrends: dailyStats,
      revenue: revenueStats,
      generatedAt: new Date().toISOString()
    };
    
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Get booking statistics error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '予約統計の取得中にエラーが発生しました。');
  }
}

/**
 * 一括承認処理
 */
async function handleBulkApprove(event, adminUserId) {
  try {
    const requestBody = JSON.parse(event.body || '{}');
    const { bookingIds, convertToConfirmed = false, adminComment = '' } = requestBody;
    
    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '予約IDリストが必要です。');
    }
    
    if (bookingIds.length > 50) {
      return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '一度に承認できる予約は50件までです。');
    }
    
    const results = {
      successful: [],
      failed: [],
      totalProcessed: bookingIds.length
    };
    
    // 各予約を順次処理
    for (const bookingId of bookingIds) {
      try {
        const booking = await getBookingById(bookingId);
        
        if (!booking) {
          results.failed.push({
            bookingId,
            error: '予約が見つかりません。'
          });
          continue;
        }
        
        if (booking.status !== BOOKING_STATUS.PENDING) {
          results.failed.push({
            bookingId,
            error: '承認待ち状態の予約ではありません。'
          });
          continue;
        }
        
        // 予約承認処理
        const approvalResult = await approveBookingInternal(booking, {
          adminUserId,
          convertToConfirmed,
          adminComment
        });
        
        if (approvalResult.success) {
          results.successful.push({
            bookingId,
            booking: approvalResult.booking
          });
        } else {
          results.failed.push({
            bookingId,
            error: approvalResult.error
          });
        }
        
      } catch (error) {
        console.error(`Bulk approve error for booking ${bookingId}:`, error);
        results.failed.push({
          bookingId,
          error: '処理中にエラーが発生しました。'
        });
      }
    }
    
    const response = {
      ...results,
      successRate: (results.successful.length / results.totalProcessed) * 100,
      processedAt: new Date().toISOString()
    };
    
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Bulk approve error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '一括承認処理中にエラーが発生しました。');
  }
}

/**
 * 一括拒否処理
 */
async function handleBulkReject(event, adminUserId) {
  try {
    const requestBody = JSON.parse(event.body || '{}');
    const { bookingIds, reason, adminComment = '' } = requestBody;
    
    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '予約IDリストが必要です。');
    }
    
    if (!reason) {
      return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '拒否理由は必須です。');
    }
    
    if (bookingIds.length > 50) {
      return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '一度に拒否できる予約は50件までです。');
    }
    
    const results = {
      successful: [],
      failed: [],
      totalProcessed: bookingIds.length
    };
    
    // 各予約を順次処理
    for (const bookingId of bookingIds) {
      try {
        const booking = await getBookingById(bookingId);
        
        if (!booking) {
          results.failed.push({
            bookingId,
            error: '予約が見つかりません。'
          });
          continue;
        }
        
        if (booking.status !== BOOKING_STATUS.PENDING) {
          results.failed.push({
            bookingId,
            error: '承認待ち状態の予約ではありません。'
          });
          continue;
        }
        
        // 予約拒否処理
        const rejectionResult = await rejectBookingInternal(booking, {
          adminUserId,
          reason,
          adminComment
        });
        
        if (rejectionResult.success) {
          results.successful.push({
            bookingId,
            booking: rejectionResult.booking
          });
        } else {
          results.failed.push({
            bookingId,
            error: rejectionResult.error
          });
        }
        
      } catch (error) {
        console.error(`Bulk reject error for booking ${bookingId}:`, error);
        results.failed.push({
          bookingId,
          error: '処理中にエラーが発生しました。'
        });
      }
    }
    
    const response = {
      ...results,
      successRate: (results.successful.length / results.totalProcessed) * 100,
      processedAt: new Date().toISOString()
    };
    
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Bulk reject error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '一括拒否処理中にエラーが発生しました。');
  }
}

// ===== ヘルパー関数 =====

/**
 * ステータス別予約取得
 */
async function getBookingsByStatus(status, options = {}) {
  const { bookingType, userId, fromDate, toDate, keepOrder, page, limit } = options;
  
  let params = {
    TableName: TABLES.BOOKINGS,
    IndexName: 'StatusBookingsIndex',
    KeyConditionExpression: 'GSI2PK = :statusKey',
    ExpressionAttributeValues: {
      ':statusKey': `STATUS#${status}`
    }
  };
  
  // フィルター条件の構築
  const filterExpressions = [];
  const expressionAttributeValues = { ...params.ExpressionAttributeValues };
  
  if (bookingType) {
    filterExpressions.push('bookingType = :bookingType');
    expressionAttributeValues[':bookingType'] = bookingType;
  }
  
  if (userId) {
    filterExpressions.push('userId = :userId');
    expressionAttributeValues[':userId'] = userId;
  }
  
  if (fromDate) {
    filterExpressions.push('startTime >= :fromDate');
    expressionAttributeValues[':fromDate'] = fromDate;
  }
  
  if (toDate) {
    filterExpressions.push('startTime <= :toDate');
    expressionAttributeValues[':toDate'] = toDate + 'T23:59:59.999Z';
  }
  
  if (keepOrder !== undefined) {
    filterExpressions.push('keepOrder = :keepOrder');
    expressionAttributeValues[':keepOrder'] = parseInt(keepOrder, 10);
  }
  
  if (filterExpressions.length > 0) {
    params.FilterExpression = filterExpressions.join(' AND ');
    params.ExpressionAttributeValues = expressionAttributeValues;
  }
  
  const result = await dynamoDB.query(params).promise();
  const bookings = result.Items || [];
  
  // ソートとページネーション
  const sortedBookings = sortBookings(bookings, options.sortBy, options.sortOrder);
  const startIndex = ((page || 1) - 1) * (limit || 20);
  const paginatedBookings = sortedBookings.slice(startIndex, startIndex + (limit || 20));
  
  return {
    bookings: paginatedBookings,
    totalCount: bookings.length
  };
}

/**
 * ユーザー別予約取得
 */
async function getBookingsByUser(userId, options = {}) {
  const params = {
    TableName: TABLES.BOOKINGS,
    IndexName: 'UserBookingsIndex',
    KeyConditionExpression: 'GSI1PK = :userKey',
    ExpressionAttributeValues: {
      ':userKey': `USER#${userId}`
    }
  };
  
  const result = await dynamoDB.query(params).promise();
  let bookings = result.Items || [];
  
  // 追加フィルタリング
  if (options.status) {
    bookings = bookings.filter(b => b.status === options.status);
  }
  
  if (options.bookingType) {
    bookings = bookings.filter(b => b.bookingType === options.bookingType);
  }
  
  // ソートとページネーション
  const sortedBookings = sortBookings(bookings, options.sortBy, options.sortOrder);
  const startIndex = ((options.page || 1) - 1) * (options.limit || 20);
  const paginatedBookings = sortedBookings.slice(startIndex, startIndex + (options.limit || 20));
  
  return {
    bookings: paginatedBookings,
    totalCount: bookings.length
  };
}

/**
 * 日付範囲別予約取得
 */
async function getBookingsByDateRange(fromDate, toDate, options = {}) {
  // 実装の簡略化のため、全予約を取得してフィルタリング
  const allBookings = await getAllBookingsWithFilters(options);
  
  let bookings = allBookings.bookings;
  
  if (fromDate) {
    bookings = bookings.filter(b => b.startTime >= fromDate);
  }
  
  if (toDate) {
    bookings = bookings.filter(b => b.startTime <= toDate + 'T23:59:59.999Z');
  }
  
  return {
    bookings: bookings.slice(0, options.limit || 20),
    totalCount: bookings.length
  };
}

/**
 * 全予約取得（フィルター付き）
 */
async function getAllBookingsWithFilters(options = {}) {
  const statuses = [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED, BOOKING_STATUS.REJECTED, BOOKING_STATUS.CANCELLED];
  let allBookings = [];
  
  for (const status of statuses) {
    const result = await getBookingsByStatus(status, { ...options, page: 1, limit: 1000 });
    allBookings = allBookings.concat(result.bookings);
  }
  
  // ソートとページネーション
  const sortedBookings = sortBookings(allBookings, options.sortBy, options.sortOrder);
  const startIndex = ((options.page || 1) - 1) * (options.limit || 20);
  const paginatedBookings = sortedBookings.slice(startIndex, startIndex + (options.limit || 20));
  
  return {
    bookings: paginatedBookings,
    totalCount: allBookings.length
  };
}

/**
 * 予約にユーザー情報を追加
 */
async function enrichBookingsWithUserInfo(bookings) {
  const userIds = [...new Set(bookings.map(b => b.userId))];
  const userInfoMap = new Map();
  
  // バッチでユーザー情報を取得
  for (const userId of userIds) {
    try {
      const params = {
        TableName: TABLES.USERS,
        Key: { PK: `USER#${userId}` }
      };
      
      const result = await dynamoDB.get(params).promise();
      if (result.Item) {
        userInfoMap.set(userId, {
          fullName: result.Item.fullName,
          email: result.Item.email,
          phone: result.Item.phone,
          totalUsageMinutes: result.Item.totalUsageMinutes || 0,
          bookingCount: result.Item.bookingCount || 0
        });
      }
    } catch (error) {
      console.error(`Failed to get user info for ${userId}:`, error);
    }
  }
  
  return bookings.map(booking => ({
    ...booking,
    userInfo: userInfoMap.get(booking.userId) || {
      fullName: '不明なユーザー',
      email: '',
      phone: '',
      totalUsageMinutes: 0,
      bookingCount: 0
    }
  }));
}

/**
 * 予約IDで予約を取得
 */
async function getBookingById(bookingId) {
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
 * 予約の並び替え
 */
function sortBookings(bookings, sortBy = 'createdAt', sortOrder = 'desc') {
  return bookings.sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];
    
    // 日付形式の場合
    if (sortBy.includes('At') || sortBy.includes('Time')) {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }
    
    if (sortOrder === 'desc') {
      return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
    } else {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    }
  });
}

/**
 * 予約優先度計算
 */
function calculateBookingPriority(booking) {
  let priority = 1;
  
  // 仮予約で期限が近い場合は優先度高
  if (booking.bookingType === BOOKING_TYPE.TEMPORARY && booking.confirmationDeadline) {
    const hoursToDeadline = calculateTimeToDeadline(booking.confirmationDeadline).hours;
    if (hoursToDeadline <= 24) priority += 3;
    else if (hoursToDeadline <= 48) priority += 2;
    else if (hoursToDeadline <= 72) priority += 1;
  }
  
  // キープ順序が高い場合
  if (booking.keepOrder === 1) priority += 2;
  else if (booking.keepOrder === 2) priority += 1;
  
  // 予約開始時間が近い場合
  const hoursToStart = (new Date(booking.startTime) - new Date()) / (1000 * 60 * 60);
  if (hoursToStart <= 24) priority += 1;
  
  return Math.min(priority, 5); // 最大5
}

/**
 * 期限までの時間計算
 */
function calculateTimeToDeadline(deadline) {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate - now;
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return {
    total: diffMs,
    hours,
    minutes,
    isPast: diffMs < 0,
    humanReadable: diffMs < 0 ? '期限切れ' : `${hours}時間${minutes}分`
  };
}

/**
 * 緊急度レベル計算
 */
function calculateUrgencyLevel(deadline) {
  const timeToDeadline = calculateTimeToDeadline(deadline);
  
  if (timeToDeadline.isPast) return 'expired';
  if (timeToDeadline.hours <= 6) return 'critical';
  if (timeToDeadline.hours <= 24) return 'high';
  if (timeToDeadline.hours <= 48) return 'medium';
  return 'low';
}

/**
 * 予約統計概要取得
 */
async function getBookingStatisticsSummary(filters) {
  // 簡略化実装
  const statusCounts = await Promise.all([
    BOOKING_STATUS.PENDING,
    BOOKING_STATUS.APPROVED,
    BOOKING_STATUS.REJECTED,
    BOOKING_STATUS.CANCELLED
  ].map(async status => {
    const result = await getBookingsByStatus(status, { page: 1, limit: 1000 });
    return { status, count: result.totalCount };
  }));
  
  return {
    byStatus: statusCounts.reduce((acc, item) => {
      acc[item.status] = item.count;
      return acc;
    }, {}),
    total: statusCounts.reduce((sum, item) => sum + item.count, 0)
  };
}

// 統計関数の実装（基本的なモック）
async function getBookingStatusStatistics(startDate, endDate) {
  return {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0
  };
}

async function getBookingTypeStatistics(startDate, endDate) {
  return {
    temporary: 0,
    confirmed: 0
  };
}

async function getDailyBookingStatistics(startDate, endDate) {
  return [];
}

async function getKeepSystemStatistics(startDate, endDate) {
  return {
    firstBookings: 0,
    secondKeeps: 0,
    thirdKeeps: 0,
    totalKeeps: 0
  };
}

async function calculateBookingRevenue(startDate, endDate) {
  return {
    total: 0,
    byType: {
      temporary: 0,
      confirmed: 0
    }
  };
}

// 内部承認・拒否関数（基本実装）
async function approveBookingInternal(booking, options) {
  // 実装の詳細は省略（実際の承認ロジックを実装）
  return { success: true, booking };
}

async function rejectBookingInternal(booking, options) {
  // 実装の詳細は省略（実際の拒否ロジックを実装）
  return { success: true, booking };
}

// 日付ヘルパー関数
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getMonthStart(date) {
  const d = new Date(date);
  d.setDate(1);
  return d.toISOString().split('T')[0];
}

function getYearStart(date) {
  const d = new Date(date);
  d.setMonth(0);
  d.setDate(1);
  return d.toISOString().split('T')[0];
}

/**
 * イベントからユーザーIDを取得
 */
function getUserIdFromEvent(event) {
  const requestContext = event.requestContext || {};
  const authorizer = requestContext.authorizer || {};
  return authorizer.userId;
}

/**
 * イベントから管理者フラグを取得
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
