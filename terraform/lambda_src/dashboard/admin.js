const AWS = require('aws-sdk');

const dynamoDB = new AWS.DynamoDB.DocumentClient();

// 環境変数からテーブル名を取得
const TABLES = {
  USERS: process.env.USERS_TABLE || 'studio-booking-users',
  BOOKINGS: process.env.BOOKINGS_TABLE || 'studio-booking-bookings',
  CALENDAR: process.env.CALENDAR_TABLE || 'studio-booking-calendar',
  OPTIONS: process.env.OPTIONS_TABLE || 'studio-booking-options',
  NOTIFICATIONS: process.env.NOTIFICATIONS_TABLE || 'studio-booking-notifications'
};

// ステータス定数
const BOOKING_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
};

const BOOKING_TYPE = {
  TEMPORARY: 'temporary',
  CONFIRMED: 'confirmed'
};

// レスポンスヘッダー
const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/**
 * 管理者ダッシュボードLambda関数
 * システム統計情報、管理タスク情報、売上データなどを提供
 */
exports.handler = async (event) => {
  try {
    console.log('Admin dashboard event received:', JSON.stringify(event, null, 2));
    
    const userId = getUserIdFromEvent(event);
    const isAdmin = getIsAdminFromEvent(event);
    
    // 認証チェック
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', '認証が必要です。');
    }
    
    // 管理者権限チェック
    if (!isAdmin) {
      return createErrorResponse(403, 'FORBIDDEN', '管理者権限が必要です。');
    }
    
    // パスに基づいて処理を分岐
    const path = event.path || event.resource || '';
    const method = event.httpMethod;
    
    if (path.includes('/dashboard') && method === 'GET') {
      return await handleDashboardOverview(event);
    } else if (path.includes('/dashboard/booking-stats') && method === 'GET') {
      return await handleBookingStats(event);
    } else if (path.includes('/dashboard/user-stats') && method === 'GET') {
      return await handleUserStats(event);
    } else if (path.includes('/dashboard/pending-tasks') && method === 'GET') {
      return await handlePendingTasks(event);
    } else if (path.includes('/dashboard/revenue-stats') && method === 'GET') {
      return await handleRevenueStats(event);
    } else {
      return createErrorResponse(404, 'NOT_FOUND', '指定されたエンドポイントが見つかりません。');
    }
    
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return createErrorResponse(500, 'SERVER_ERROR', 'ダッシュボード情報の取得中にエラーが発生しました。');
  }
};

/**
 * ダッシュボード概要情報取得
 */
async function handleDashboardOverview(event) {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const thisWeekStart = getWeekStart(today);
    const thisMonthStart = getMonthStart(today);
    
    // 並行して各統計を取得
    const [
      totalBookings,
      bookingsByStatus,
      bookingsByType,
      todayBookings,
      thisWeekBookings,
      thisMonthBookings,
      totalUsers,
      recentUsers,
      pendingTasksCount,
      systemHealth
    ] = await Promise.all([
      getTotalBookingsCount(),
      getBookingsByStatus(),
      getBookingsByType(),
      getBookingsCountByDate(todayStr),
      getBookingsCountByDateRange(thisWeekStart, todayStr),
      getBookingsCountByDateRange(thisMonthStart, todayStr),
      getTotalUsersCount(),
      getRecentUsersCount(30), // 過去30日のアクティブユーザー
      getPendingTasksCount(),
      getSystemHealthMetrics()
    ]);
    
    const dashboardData = {
      overview: {
        totalBookings,
        totalUsers,
        pendingTasksCount,
        systemStatus: systemHealth.status
      },
      bookingStats: {
        total: totalBookings,
        today: todayBookings,
        thisWeek: thisWeekBookings,
        thisMonth: thisMonthBookings,
        byStatus: bookingsByStatus,
        byType: bookingsByType
      },
      userStats: {
        total: totalUsers,
        activeRecent: recentUsers,
        newThisMonth: await getNewUsersCount(thisMonthStart)
      },
      quickActions: {
        pendingApprovals: pendingTasksCount,
        expiringSoon: await getExpiringSoonCount(),
        recentCancellations: await getRecentCancellationsCount(7) // 過去7日
      },
      systemHealth,
      lastUpdated: new Date().toISOString()
    };
    
    return createSuccessResponse(200, dashboardData);
    
  } catch (error) {
    console.error('Dashboard overview error:', error);
    
    // 部分的な情報でもレスポンスを返す
    const fallbackData = {
      overview: {
        totalBookings: 0,
        totalUsers: 0,
        pendingTasksCount: 0,
        systemStatus: 'unknown'
      },
      error: 'データの一部を取得できませんでした。',
      lastUpdated: new Date().toISOString()
    };
    
    return createSuccessResponse(200, fallbackData);
  }
}

/**
 * 予約統計詳細取得
 */
async function handleBookingStats(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const period = queryParams.period || 'month'; // month, week, day, year
    const endDate = queryParams.endDate || new Date().toISOString().split('T')[0];
    
    let startDate;
    switch (period) {
      case 'day':
        startDate = endDate;
        break;
      case 'week':
        startDate = getWeekStart(new Date(endDate));
        break;
      case 'month':
        startDate = getMonthStart(new Date(endDate));
        break;
      case 'year':
        startDate = getYearStart(new Date(endDate));
        break;
      default:
        startDate = getMonthStart(new Date(endDate));
    }
    
    const [
      periodBookings,
      timeSlotDistribution,
      dayOfWeekDistribution,
      statusTrends,
      averageBookingDuration
    ] = await Promise.all([
      getBookingsByDateRange(startDate, endDate),
      getTimeSlotDistribution(startDate, endDate),
      getDayOfWeekDistribution(startDate, endDate),
      getStatusTrends(startDate, endDate),
      getAverageBookingDuration(startDate, endDate)
    ]);
    
    const stats = {
      period: {
        type: period,
        startDate,
        endDate
      },
      summary: {
        totalBookings: periodBookings.length,
        totalRevenue: calculateTotalRevenue(periodBookings),
        averageDuration: averageBookingDuration,
        popularTimeSlots: timeSlotDistribution.slice(0, 5)
      },
      trends: {
        daily: groupBookingsByDay(periodBookings),
        hourly: timeSlotDistribution,
        dayOfWeek: dayOfWeekDistribution,
        status: statusTrends
      },
      performance: {
        approvalRate: calculateApprovalRate(periodBookings),
        cancellationRate: calculateCancellationRate(periodBookings),
        averageResponseTime: await getAverageResponseTime(startDate, endDate)
      }
    };
    
    return createSuccessResponse(200, stats);
    
  } catch (error) {
    console.error('Booking stats error:', error);
    return createErrorResponse(500, 'SERVER_ERROR', '予約統計の取得中にエラーが発生しました。');
  }
}

/**
 * ユーザー統計取得
 */
async function handleUserStats(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const period = queryParams.period || 'month';
    const endDate = queryParams.endDate || new Date().toISOString().split('T')[0];
    
    let startDate;
    switch (period) {
      case 'week':
        startDate = getWeekStart(new Date(endDate));
        break;
      case 'month':
        startDate = getMonthStart(new Date(endDate));
        break;
      case 'year':
        startDate = getYearStart(new Date(endDate));
        break;
      default:
        startDate = getMonthStart(new Date(endDate));
    }
    
    const [
      totalUsers,
      newUsers,
      activeUsers,
      userEngagement,
      topUsers
    ] = await Promise.all([
      getTotalUsersCount(),
      getNewUsersInPeriod(startDate, endDate),
      getActiveUsersInPeriod(startDate, endDate),
      getUserEngagementMetrics(startDate, endDate),
      getTopUsersByBookings(startDate, endDate, 10)
    ]);
    
    const stats = {
      period: {
        type: period,
        startDate,
        endDate
      },
      summary: {
        total: totalUsers,
        newInPeriod: newUsers.length,
        activeInPeriod: activeUsers.length,
        engagementRate: userEngagement.engagementRate
      },
      growth: {
        daily: groupUsersByDay(newUsers),
        retention: userEngagement.retention,
        churnRate: userEngagement.churnRate
      },
      topUsers: topUsers.map(user => ({
        userId: user.userId,
        fullName: user.fullName,
        bookingCount: user.bookingCount,
        totalRevenue: user.totalRevenue,
        lastBooking: user.lastBooking
      })),
      engagement: userEngagement
    };
    
    return createSuccessResponse(200, stats);
    
  } catch (error) {
    console.error('User stats error:', error);
    return createErrorResponse(500, 'SERVER_ERROR', 'ユーザー統計の取得中にエラーが発生しました。');
  }
}

/**
 * 管理タスク一覧取得
 */
async function handlePendingTasks(event) {
  try {
    const [
      pendingBookings,
      expiringSoonBookings,
      recentCancellations,
      flaggedUsers,
      systemAlerts
    ] = await Promise.all([
      getPendingBookingsDetailed(),
      getExpiringSoonBookingsDetailed(),
      getRecentCancellationsDetailed(7),
      getFlaggedUsers(),
      getSystemAlerts()
    ]);
    
    const tasks = {
      pendingApprovals: {
        count: pendingBookings.length,
        items: pendingBookings.slice(0, 20), // 最大20件表示
        priority: 'high'
      },
      expiringSoon: {
        count: expiringSoonBookings.length,
        items: expiringSoonBookings.slice(0, 10),
        priority: 'medium'
      },
      recentCancellations: {
        count: recentCancellations.length,
        items: recentCancellations.slice(0, 10),
        priority: 'low'
      },
      flaggedUsers: {
        count: flaggedUsers.length,
        items: flaggedUsers.slice(0, 5),
        priority: 'medium'
      },
      systemAlerts: {
        count: systemAlerts.length,
        items: systemAlerts,
        priority: 'high'
      },
      summary: {
        totalTasks: pendingBookings.length + expiringSoonBookings.length + flaggedUsers.length + systemAlerts.length,
        highPriority: pendingBookings.length + systemAlerts.length,
        mediumPriority: expiringSoonBookings.length + flaggedUsers.length,
        lowPriority: recentCancellations.length
      }
    };
    
    return createSuccessResponse(200, tasks);
    
  } catch (error) {
    console.error('Pending tasks error:', error);
    return createErrorResponse(500, 'SERVER_ERROR', '管理タスクの取得中にエラーが発生しました。');
  }
}

/**
 * 売上統計取得
 */
async function handleRevenueStats(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const period = queryParams.period || 'month';
    const endDate = queryParams.endDate || new Date().toISOString().split('T')[0];
    
    let startDate;
    switch (period) {
      case 'week':
        startDate = getWeekStart(new Date(endDate));
        break;
      case 'month':
        startDate = getMonthStart(new Date(endDate));
        break;
      case 'year':
        startDate = getYearStart(new Date(endDate));
        break;
      default:
        startDate = getMonthStart(new Date(endDate));
    }
    
    const [
      approvedBookings,
      optionStats,
      planStats,
      revenueByDay
    ] = await Promise.all([
      getApprovedBookingsByDateRange(startDate, endDate),
      getOptionUsageStats(startDate, endDate),
      getPlanUsageStats(startDate, endDate),
      getRevenueByDay(startDate, endDate)
    ]);
    
    const totalRevenue = calculateTotalRevenue(approvedBookings);
    const baseRevenue = calculateBaseRevenue(approvedBookings);
    const optionRevenue = calculateOptionRevenue(approvedBookings);
    
    const stats = {
      period: {
        type: period,
        startDate,
        endDate
      },
      summary: {
        totalRevenue,
        baseRevenue,
        optionRevenue,
        averagePerBooking: approvedBookings.length > 0 ? totalRevenue / approvedBookings.length : 0,
        bookingCount: approvedBookings.length
      },
      trends: {
        daily: revenueByDay,
        growth: calculateRevenueGrowth(revenueByDay)
      },
      breakdown: {
        byPlan: planStats,
        byOption: optionStats,
        byBookingType: calculateRevenueByBookingType(approvedBookings)
      },
      performance: {
        conversionRate: await calculateConversionRate(startDate, endDate),
        averageBookingValue: totalRevenue / (approvedBookings.length || 1),
        repeatCustomerRate: await calculateRepeatCustomerRate(startDate, endDate)
      }
    };
    
    return createSuccessResponse(200, stats);
    
  } catch (error) {
    console.error('Revenue stats error:', error);
    return createErrorResponse(500, 'SERVER_ERROR', '売上統計の取得中にエラーが発生しました。');
  }
}

// ===== ヘルパー関数 =====

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

// ===== 日付ヘルパー関数 =====

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 月曜日を週の始まりとする
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

// ===== DynamoDB クエリ関数 =====

/**
 * 総予約数を取得
 */
async function getTotalBookingsCount() {
  try {
    // すべてのステータスの予約数を合計
    const statuses = [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED, BOOKING_STATUS.REJECTED, BOOKING_STATUS.CANCELLED];
    let total = 0;
    
    for (const status of statuses) {
      const params = {
        TableName: TABLES.BOOKINGS,
        IndexName: 'StatusBookingsIndex',
        KeyConditionExpression: 'GSI2PK = :statusKey',
        ExpressionAttributeValues: {
          ':statusKey': `STATUS#${status}`
        },
        Select: 'COUNT'
      };
      
      const result = await dynamoDB.query(params).promise();
      total += result.Count || 0;
    }
    
    return total;
  } catch (error) {
    console.error('Get total bookings count error:', error);
    return 0;
  }
}

/**
 * ステータス別予約数を取得
 */
async function getBookingsByStatus() {
  try {
    const statuses = [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED, BOOKING_STATUS.REJECTED, BOOKING_STATUS.CANCELLED];
    const result = {};
    
    for (const status of statuses) {
      const params = {
        TableName: TABLES.BOOKINGS,
        IndexName: 'StatusBookingsIndex',
        KeyConditionExpression: 'GSI2PK = :statusKey',
        ExpressionAttributeValues: {
          ':statusKey': `STATUS#${status}`
        },
        Select: 'COUNT'
      };
      
      const queryResult = await dynamoDB.query(params).promise();
      result[status] = queryResult.Count || 0;
    }
    
    return result;
  } catch (error) {
    console.error('Get bookings by status error:', error);
    return {};
  }
}

/**
 * 予約タイプ別予約数を取得
 */
async function getBookingsByType() {
  try {
    // 承認済み予約のみを対象とする
    const params = {
      TableName: TABLES.BOOKINGS,
      IndexName: 'StatusBookingsIndex',
      KeyConditionExpression: 'GSI2PK = :statusKey',
      ExpressionAttributeValues: {
        ':statusKey': `STATUS#${BOOKING_STATUS.APPROVED}`
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    const bookings = result.Items || [];
    
    const typeCount = {
      [BOOKING_TYPE.TEMPORARY]: 0,
      [BOOKING_TYPE.CONFIRMED]: 0
    };
    
    bookings.forEach(booking => {
      if (booking.bookingType && typeCount.hasOwnProperty(booking.bookingType)) {
        typeCount[booking.bookingType]++;
      }
    });
    
    return typeCount;
  } catch (error) {
    console.error('Get bookings by type error:', error);
    return {};
  }
}

/**
 * 特定日の予約数を取得
 */
async function getBookingsCountByDate(date) {
  try {
    const params = {
      TableName: TABLES.BOOKINGS,
      IndexName: 'DateBookingsIndex',
      KeyConditionExpression: 'GSI3PK = :dateKey',
      ExpressionAttributeValues: {
        ':dateKey': `DATE#${date}`
      },
      Select: 'COUNT'
    };
    
    const result = await dynamoDB.query(params).promise();
    return result.Count || 0;
  } catch (error) {
    console.error('Get bookings count by date error:', error);
    return 0;
  }
}

/**
 * 日付範囲の予約数を取得
 */
async function getBookingsCountByDateRange(startDate, endDate) {
  try {
    let totalCount = 0;
    const currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const count = await getBookingsCountByDate(dateStr);
      totalCount += count;
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return totalCount;
  } catch (error) {
    console.error('Get bookings count by date range error:', error);
    return 0;
  }
}

/**
 * 総ユーザー数を取得
 */
async function getTotalUsersCount() {
  try {
    const params = {
      TableName: TABLES.USERS,
      Select: 'COUNT'
    };
    
    const result = await dynamoDB.scan(params).promise();
    return result.Count || 0;
  } catch (error) {
    console.error('Get total users count error:', error);
    return 0;
  }
}

/**
 * 最近のアクティブユーザー数を取得
 */
async function getRecentUsersCount(days) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString();
    
    // 最近承認された予約を持つユーザーを取得
    const params = {
      TableName: TABLES.BOOKINGS,
      IndexName: 'StatusBookingsIndex',
      KeyConditionExpression: 'GSI2PK = :statusKey',
      FilterExpression: 'approvedAt >= :cutoffDate',
      ExpressionAttributeValues: {
        ':statusKey': `STATUS#${BOOKING_STATUS.APPROVED}`,
        ':cutoffDate': cutoffStr
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    const bookings = result.Items || [];
    
    // ユニークユーザーIDを抽出
    const uniqueUsers = new Set(bookings.map(booking => booking.userId));
    return uniqueUsers.size;
  } catch (error) {
    console.error('Get recent users count error:', error);
    return 0;
  }
}

/**
 * 承認待ちタスク数を取得
 */
async function getPendingTasksCount() {
  try {
    const params = {
      TableName: TABLES.BOOKINGS,
      IndexName: 'StatusBookingsIndex',
      KeyConditionExpression: 'GSI2PK = :statusKey',
      ExpressionAttributeValues: {
        ':statusKey': `STATUS#${BOOKING_STATUS.PENDING}`
      },
      Select: 'COUNT'
    };
    
    const result = await dynamoDB.query(params).promise();
    return result.Count || 0;
  } catch (error) {
    console.error('Get pending tasks count error:', error);
    return 0;
  }
}

/**
 * システムヘルスメトリクスを取得
 */
async function getSystemHealthMetrics() {
  try {
    // 簡単なヘルスチェック
    const recentErrors = 0; // CloudWatch等から取得予定
    const avgResponseTime = 200; // CloudWatch等から取得予定
    
    let status = 'healthy';
    if (recentErrors > 10) {
      status = 'degraded';
    }
    if (avgResponseTime > 1000) {
      status = 'slow';
    }
    
    return {
      status,
      metrics: {
        recentErrors,
        avgResponseTime,
        uptime: '99.9%'
      }
    };
  } catch (error) {
    console.error('Get system health error:', error);
    return {
      status: 'unknown',
      metrics: {}
    };
  }
}

/**
 * 新規ユーザー数を取得
 */
async function getNewUsersCount(startDate) {
  try {
    const params = {
      TableName: TABLES.USERS,
      FilterExpression: 'createdAt >= :startDate',
      ExpressionAttributeValues: {
        ':startDate': startDate
      },
      Select: 'COUNT'
    };
    
    const result = await dynamoDB.scan(params).promise();
    return result.Count || 0;
  } catch (error) {
    console.error('Get new users count error:', error);
    return 0;
  }
}

/**
 * 期限切れ間近の予約数を取得
 */
async function getExpiringSoonCount() {
  try {
    const now = new Date();
    const soonThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24時間後
    
    const params = {
      TableName: TABLES.BOOKINGS,
      IndexName: 'StatusBookingsIndex',
      KeyConditionExpression: 'GSI2PK = :statusKey',
      FilterExpression: 'bookingType = :tempType AND confirmationDeadline <= :threshold AND confirmationDeadline > :now',
      ExpressionAttributeValues: {
        ':statusKey': `STATUS#${BOOKING_STATUS.APPROVED}`,
        ':tempType': BOOKING_TYPE.TEMPORARY,
        ':threshold': soonThreshold.toISOString(),
        ':now': now.toISOString()
      },
      Select: 'COUNT'
    };
    
    const result = await dynamoDB.query(params).promise();
    return result.Count || 0;
  } catch (error) {
    console.error('Get expiring soon count error:', error);
    return 0;
  }
}

/**
 * 最近のキャンセル数を取得
 */
async function getRecentCancellationsCount(days) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const params = {
      TableName: TABLES.BOOKINGS,
      IndexName: 'StatusBookingsIndex',
      KeyConditionExpression: 'GSI2PK = :statusKey',
      FilterExpression: 'updatedAt >= :cutoffDate',
      ExpressionAttributeValues: {
        ':statusKey': `STATUS#${BOOKING_STATUS.CANCELLED}`,
        ':cutoffDate': cutoffDate.toISOString()
      },
      Select: 'COUNT'
    };
    
    const result = await dynamoDB.query(params).promise();
    return result.Count || 0;
  } catch (error) {
    console.error('Get recent cancellations count error:', error);
    return 0;
  }
}

// 追加のヘルパー関数（基本的な集計処理）

function calculateTotalRevenue(bookings) {
  return bookings.reduce((total, booking) => {
    if (booking.status !== BOOKING_STATUS.APPROVED) return total;
    
    let bookingRevenue = 0;
    
    // 基本料金の計算（時間 × 基本料金）
    if (booking.startTime && booking.endTime) {
      const duration = (new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60 * 60); // 時間
      bookingRevenue += duration * 5500; // 基本料金（例）
    }
    
    // オプション料金の計算
    if (booking.options && Array.isArray(booking.options)) {
      booking.options.forEach(option => {
        bookingRevenue += (option.taxIncludedPrice || option.price || 0) * (option.quantity || 1);
      });
    }
    
    return total + bookingRevenue;
  }, 0);
}

function calculateBaseRevenue(bookings) {
  return bookings.reduce((total, booking) => {
    if (booking.status !== BOOKING_STATUS.APPROVED) return total;
    
    if (booking.startTime && booking.endTime) {
      const duration = (new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60 * 60);
      return total + (duration * 5500);
    }
    
    return total;
  }, 0);
}

function calculateOptionRevenue(bookings) {
  return bookings.reduce((total, booking) => {
    if (booking.status !== BOOKING_STATUS.APPROVED) return total;
    
    let optionTotal = 0;
    if (booking.options && Array.isArray(booking.options)) {
      booking.options.forEach(option => {
        optionTotal += (option.taxIncludedPrice || option.price || 0) * (option.quantity || 1);
      });
    }
    
    return total + optionTotal;
  }, 0);
}

function groupBookingsByDay(bookings) {
  const grouped = {};
  
  bookings.forEach(booking => {
    const date = booking.startTime ? booking.startTime.split('T')[0] : null;
    if (date) {
      if (!grouped[date]) {
        grouped[date] = 0;
      }
      grouped[date]++;
    }
  });
  
  return grouped;
}

function calculateApprovalRate(bookings) {
  const totalBookings = bookings.length;
  if (totalBookings === 0) return 0;
  
  const approvedBookings = bookings.filter(b => b.status === BOOKING_STATUS.APPROVED).length;
  return (approvedBookings / totalBookings) * 100;
}

function calculateCancellationRate(bookings) {
  const totalBookings = bookings.length;
  if (totalBookings === 0) return 0;
  
  const cancelledBookings = bookings.filter(b => b.status === BOOKING_STATUS.CANCELLED).length;
  return (cancelledBookings / totalBookings) * 100;
}

// その他の統計関数は実装の簡略化のため基本的なモックを返す
async function getBookingsByDateRange(startDate, endDate) { return []; }
async function getTimeSlotDistribution(startDate, endDate) { return []; }
async function getDayOfWeekDistribution(startDate, endDate) { return []; }
async function getStatusTrends(startDate, endDate) { return []; }
async function getAverageBookingDuration(startDate, endDate) { return 0; }
async function getAverageResponseTime(startDate, endDate) { return 0; }
async function getNewUsersInPeriod(startDate, endDate) { return []; }
async function getActiveUsersInPeriod(startDate, endDate) { return []; }
async function getUserEngagementMetrics(startDate, endDate) { return { engagementRate: 0, retention: 0, churnRate: 0 }; }
async function getTopUsersByBookings(startDate, endDate, limit) { return []; }
async function groupUsersByDay(users) { return {}; }
async function getPendingBookingsDetailed() { return []; }
async function getExpiringSoonBookingsDetailed() { return []; }
async function getRecentCancellationsDetailed(days) { return []; }
async function getFlaggedUsers() { return []; }
async function getSystemAlerts() { return []; }
async function getApprovedBookingsByDateRange(startDate, endDate) { return []; }
async function getOptionUsageStats(startDate, endDate) { return []; }
async function getPlanUsageStats(startDate, endDate) { return []; }
async function getRevenueByDay(startDate, endDate) { return []; }
async function calculateConversionRate(startDate, endDate) { return 0; }
async function calculateRepeatCustomerRate(startDate, endDate) { return 0; }
function calculateRevenueGrowth(revenueByDay) { return 0; }
function calculateRevenueByBookingType(bookings) { return {}; }
