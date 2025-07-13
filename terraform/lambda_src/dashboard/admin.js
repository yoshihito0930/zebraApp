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

// ===== GSIを活用した効率的な統計クエリ実装 =====

/**
 * 日付範囲での予約取得（GSI3を活用）
 */
async function getBookingsByDateRange(startDate, endDate) {
  try {
    const allBookings = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    // 日付範囲をバッチで並列処理
    const datePromises = [];
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      const params = {
        TableName: TABLES.BOOKINGS,
        IndexName: 'DateBookingsIndex',
        KeyConditionExpression: 'GSI3PK = :dateKey',
        ExpressionAttributeValues: {
          ':dateKey': `DATE#${dateStr}`
        }
      };
      
      datePromises.push(dynamoDB.query(params).promise());
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // 並列実行で高速化
    const results = await Promise.all(datePromises);
    results.forEach(result => {
      if (result.Items) {
        allBookings.push(...result.Items);
      }
    });
    
    return allBookings;
  } catch (error) {
    console.error('Get bookings by date range error:', error);
    return [];
  }
}

/**
 * 時間帯別利用分析
 */
async function getTimeSlotDistribution(startDate, endDate) {
  try {
    const bookings = await getBookingsByDateRange(startDate, endDate);
    const timeSlots = {};
    
    bookings.forEach(booking => {
      if (booking.startTime && booking.status === BOOKING_STATUS.APPROVED) {
        const startHour = new Date(booking.startTime).getHours();
        const timeSlot = `${String(startHour).padStart(2, '0')}:00`;
        
        if (!timeSlots[timeSlot]) {
          timeSlots[timeSlot] = {
            hour: timeSlot,
            count: 0,
            totalDuration: 0,
            revenue: 0
          };
        }
        
        timeSlots[timeSlot].count++;
        
        if (booking.endTime) {
          const duration = (new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60 * 60);
          timeSlots[timeSlot].totalDuration += duration;
          timeSlots[timeSlot].revenue += calculateBookingRevenue(booking);
        }
      }
    });
    
    return Object.values(timeSlots).sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  } catch (error) {
    console.error('Get time slot distribution error:', error);
    return [];
  }
}

/**
 * 曜日別利用分析
 */
async function getDayOfWeekDistribution(startDate, endDate) {
  try {
    const bookings = await getBookingsByDateRange(startDate, endDate);
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
    const distribution = {};
    
    dayOfWeek.forEach((day, index) => {
      distribution[day] = {
        day,
        dayIndex: index,
        count: 0,
        revenue: 0,
        avgDuration: 0
      };
    });
    
    bookings.forEach(booking => {
      if (booking.startTime && booking.status === BOOKING_STATUS.APPROVED) {
        const date = new Date(booking.startTime);
        const dayName = dayOfWeek[date.getDay()];
        
        distribution[dayName].count++;
        distribution[dayName].revenue += calculateBookingRevenue(booking);
        
        if (booking.endTime) {
          const duration = (new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60 * 60);
          distribution[dayName].avgDuration = (distribution[dayName].avgDuration + duration) / 2;
        }
      }
    });
    
    return Object.values(distribution);
  } catch (error) {
    console.error('Get day of week distribution error:', error);
    return [];
  }
}

/**
 * ステータストレンド分析（GSI2を活用）
 */
async function getStatusTrends(startDate, endDate) {
  try {
    const statuses = [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED, BOOKING_STATUS.REJECTED, BOOKING_STATUS.CANCELLED];
    const trends = {};
    
    for (const status of statuses) {
      const params = {
        TableName: TABLES.BOOKINGS,
        IndexName: 'StatusBookingsIndex',
        KeyConditionExpression: 'GSI2PK = :statusKey',
        FilterExpression: 'createdAt BETWEEN :startDate AND :endDate',
        ExpressionAttributeValues: {
          ':statusKey': `STATUS#${status}`,
          ':startDate': startDate,
          ':endDate': endDate + 'T23:59:59Z'
        }
      };
      
      const result = await dynamoDB.query(params).promise();
      trends[status] = result.Items || [];
    }
    
    return trends;
  } catch (error) {
    console.error('Get status trends error:', error);
    return {};
  }
}

/**
 * 平均予約時間計算
 */
async function getAverageBookingDuration(startDate, endDate) {
  try {
    const bookings = await getBookingsByDateRange(startDate, endDate);
    let totalDuration = 0;
    let count = 0;
    
    bookings.forEach(booking => {
      if (booking.startTime && booking.endTime && booking.status === BOOKING_STATUS.APPROVED) {
        const duration = (new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60 * 60);
        totalDuration += duration;
        count++;
      }
    });
    
    return count > 0 ? totalDuration / count : 0;
  } catch (error) {
    console.error('Get average booking duration error:', error);
    return 0;
  }
}

/**
 * 管理者の平均応答時間計算
 */
async function getAverageResponseTime(startDate, endDate) {
  try {
    const bookings = await getBookingsByDateRange(startDate, endDate);
    let totalResponseTime = 0;
    let count = 0;
    
    bookings.forEach(booking => {
      if (booking.createdAt && (booking.approvedAt || booking.rejectedAt)) {
        const responseTime = booking.approvedAt || booking.rejectedAt;
        const timeDiff = new Date(responseTime) - new Date(booking.createdAt);
        totalResponseTime += timeDiff;
        count++;
      }
    });
    
    // 時間単位で返す
    return count > 0 ? (totalResponseTime / count) / (1000 * 60 * 60) : 0;
  } catch (error) {
    console.error('Get average response time error:', error);
    return 0;
  }
}

/**
 * 期間内の新規ユーザー取得
 */
async function getNewUsersInPeriod(startDate, endDate) {
  try {
    const params = {
      TableName: TABLES.USERS,
      FilterExpression: 'createdAt BETWEEN :startDate AND :endDate',
      ExpressionAttributeValues: {
        ':startDate': startDate,
        ':endDate': endDate + 'T23:59:59Z'
      }
    };
    
    const result = await dynamoDB.scan(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error('Get new users in period error:', error);
    return [];
  }
}

/**
 * 期間内のアクティブユーザー取得
 */
async function getActiveUsersInPeriod(startDate, endDate) {
  try {
    const bookings = await getBookingsByDateRange(startDate, endDate);
    const uniqueUsers = new Set();
    const userDetails = {};
    
    bookings.forEach(booking => {
      if (booking.userId) {
        uniqueUsers.add(booking.userId);
        if (!userDetails[booking.userId]) {
          userDetails[booking.userId] = {
            userId: booking.userId,
            fullName: booking.userName,
            email: booking.userEmail,
            bookingCount: 0,
            lastActivity: booking.createdAt
          };
        }
        userDetails[booking.userId].bookingCount++;
        
        if (booking.createdAt > userDetails[booking.userId].lastActivity) {
          userDetails[booking.userId].lastActivity = booking.createdAt;
        }
      }
    });
    
    return Object.values(userDetails);
  } catch (error) {
    console.error('Get active users in period error:', error);
    return [];
  }
}

/**
 * ユーザーエンゲージメント指標計算
 */
async function getUserEngagementMetrics(startDate, endDate) {
  try {
    const activeUsers = await getActiveUsersInPeriod(startDate, endDate);
    const totalUsers = await getTotalUsersCount();
    
    const engagementRate = totalUsers > 0 ? (activeUsers.length / totalUsers) * 100 : 0;
    
    // リピート率計算
    const repeatUsers = activeUsers.filter(user => user.bookingCount > 1);
    const repeatRate = activeUsers.length > 0 ? (repeatUsers.length / activeUsers.length) * 100 : 0;
    
    // 簡易的なchurn rate計算（実際の実装では前期比較が必要）
    const churnRate = Math.max(0, 100 - engagementRate);
    
    return {
      engagementRate: Math.round(engagementRate * 100) / 100,
      retention: Math.round(repeatRate * 100) / 100,
      churnRate: Math.round(churnRate * 100) / 100,
      activeUserCount: activeUsers.length,
      repeatUserCount: repeatUsers.length
    };
  } catch (error) {
    console.error('Get user engagement metrics error:', error);
    return { engagementRate: 0, retention: 0, churnRate: 0 };
  }
}

/**
 * トップユーザー取得（予約数順）
 */
async function getTopUsersByBookings(startDate, endDate, limit = 10) {
  try {
    const activeUsers = await getActiveUsersInPeriod(startDate, endDate);
    const bookings = await getBookingsByDateRange(startDate, endDate);
    
    // ユーザー別売上計算
    const userStats = {};
    bookings.forEach(booking => {
      if (booking.userId && booking.status === BOOKING_STATUS.APPROVED) {
        if (!userStats[booking.userId]) {
          userStats[booking.userId] = {
            userId: booking.userId,
            fullName: booking.userName,
            email: booking.userEmail,
            bookingCount: 0,
            totalRevenue: 0,
            lastBooking: booking.createdAt
          };
        }
        
        userStats[booking.userId].bookingCount++;
        userStats[booking.userId].totalRevenue += calculateBookingRevenue(booking);
        
        if (booking.createdAt > userStats[booking.userId].lastBooking) {
          userStats[booking.userId].lastBooking = booking.createdAt;
        }
      }
    });
    
    return Object.values(userStats)
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, limit);
  } catch (error) {
    console.error('Get top users by bookings error:', error);
    return [];
  }
}

/**
 * ユーザーを日別にグループ化
 */
function groupUsersByDay(users) {
  const grouped = {};
  
  users.forEach(user => {
    const date = user.createdAt ? user.createdAt.split('T')[0] : null;
    if (date) {
      if (!grouped[date]) {
        grouped[date] = 0;
      }
      grouped[date]++;
    }
  });
  
  return grouped;
}

/**
 * 承認待ち予約詳細取得（GSI2活用）
 */
async function getPendingBookingsDetailed() {
  try {
    const params = {
      TableName: TABLES.BOOKINGS,
      IndexName: 'StatusBookingsIndex',
      KeyConditionExpression: 'GSI2PK = :statusKey',
      ExpressionAttributeValues: {
        ':statusKey': `STATUS#${BOOKING_STATUS.PENDING}`
      },
      ScanIndexForward: false // 最新順
    };
    
    const result = await dynamoDB.query(params).promise();
    return (result.Items || []).map(booking => ({
      bookingId: booking.bookingId,
      userId: booking.userId,
      userName: booking.userName,
      userEmail: booking.userEmail,
      startTime: booking.startTime,
      endTime: booking.endTime,
      bookingType: booking.bookingType,
      createdAt: booking.createdAt,
      purpose: booking.purpose,
      totalRevenue: calculateBookingRevenue(booking),
      daysSincePending: Math.floor((new Date() - new Date(booking.createdAt)) / (1000 * 60 * 60 * 24))
    }));
  } catch (error) {
    console.error('Get pending bookings detailed error:', error);
    return [];
  }
}

/**
 * 期限切れ間近の予約詳細取得
 */
async function getExpiringSoonBookingsDetailed() {
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
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    return (result.Items || []).map(booking => ({
      bookingId: booking.bookingId,
      userId: booking.userId,
      userName: booking.userName,
      userEmail: booking.userEmail,
      startTime: booking.startTime,
      endTime: booking.endTime,
      confirmationDeadline: booking.confirmationDeadline,
      hoursUntilExpiry: Math.floor((new Date(booking.confirmationDeadline) - now) / (1000 * 60 * 60))
    }));
  } catch (error) {
    console.error('Get expiring soon bookings detailed error:', error);
    return [];
  }
}

/**
 * 最近のキャンセル詳細取得
 */
async function getRecentCancellationsDetailed(days) {
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
      ScanIndexForward: false
    };
    
    const result = await dynamoDB.query(params).promise();
    return (result.Items || []).map(booking => ({
      bookingId: booking.bookingId,
      userId: booking.userId,
      userName: booking.userName,
      userEmail: booking.userEmail,
      startTime: booking.startTime,
      endTime: booking.endTime,
      cancelledAt: booking.updatedAt,
      cancellationReason: booking.cancellationReason || 'N/A',
      daysSinceCancellation: Math.floor((new Date() - new Date(booking.updatedAt)) / (1000 * 60 * 60 * 24))
    }));
  } catch (error) {
    console.error('Get recent cancellations detailed error:', error);
    return [];
  }
}

/**
 * フラグ付きユーザー取得（頻繁なキャンセル等）
 */
async function getFlaggedUsers() {
  try {
    // キャンセル頻度が高いユーザーを特定
    const params = {
      TableName: TABLES.BOOKINGS,
      IndexName: 'StatusBookingsIndex',
      KeyConditionExpression: 'GSI2PK = :statusKey',
      ExpressionAttributeValues: {
        ':statusKey': `STATUS#${BOOKING_STATUS.CANCELLED}`
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    const cancellations = result.Items || [];
    
    // ユーザー別キャンセル数集計
    const userCancellations = {};
    cancellations.forEach(booking => {
      if (booking.userId) {
        if (!userCancellations[booking.userId]) {
          userCancellations[booking.userId] = {
            userId: booking.userId,
            userName: booking.userName,
            userEmail: booking.userEmail,
            cancellationCount: 0,
            lastCancellation: null
          };
        }
        userCancellations[booking.userId].cancellationCount++;
        
        if (!userCancellations[booking.userId].lastCancellation || 
            booking.updatedAt > userCancellations[booking.userId].lastCancellation) {
          userCancellations[booking.userId].lastCancellation = booking.updatedAt;
        }
      }
    });
    
    // 3回以上キャンセルしたユーザーをフラグ対象とする
    return Object.values(userCancellations)
      .filter(user => user.cancellationCount >= 3)
      .sort((a, b) => b.cancellationCount - a.cancellationCount);
  } catch (error) {
    console.error('Get flagged users error:', error);
    return [];
  }
}

/**
 * システムアラート取得
 */
async function getSystemAlerts() {
  try {
    const alerts = [];
    
    // 高負荷時間帯チェック
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = await getBookingsCountByDate(today);
    
    if (todayBookings > 10) {
      alerts.push({
        type: 'high_load',
        severity: 'warning',
        message: `本日の予約数が${todayBookings}件と高負荷になっています`,
        timestamp: new Date().toISOString()
      });
    }
    
    // 承認待ち予約チェック
    const pendingCount = await getPendingTasksCount();
    if (pendingCount > 5) {
      alerts.push({
        type: 'pending_overflow',
        severity: 'high',
        message: `承認待ち予約が${pendingCount}件あります`,
        timestamp: new Date().toISOString()
      });
    }
    
    // 期限切れ間近チェック
    const expiringSoon = await getExpiringSoonCount();
    if (expiringSoon > 0) {
      alerts.push({
        type: 'expiring_soon',
        severity: 'medium',
        message: `${expiringSoon}件の仮予約が24時間以内に期限切れになります`,
        timestamp: new Date().toISOString()
      });
    }
    
    return alerts;
  } catch (error) {
    console.error('Get system alerts error:', error);
    return [];
  }
}

/**
 * 承認済み予約を日付範囲で取得
 */
async function getApprovedBookingsByDateRange(startDate, endDate) {
  try {
    const allBookings = await getBookingsByDateRange(startDate, endDate);
    return allBookings.filter(booking => booking.status === BOOKING_STATUS.APPROVED);
  } catch (error) {
    console.error('Get approved bookings by date range error:', error);
    return [];
  }
}

/**
 * オプション使用統計
 */
async function getOptionUsageStats(startDate, endDate) {
  try {
    const approvedBookings = await getApprovedBookingsByDateRange(startDate, endDate);
    const optionStats = {};
    
    approvedBookings.forEach(booking => {
      if (booking.options && Array.isArray(booking.options)) {
        booking.options.forEach(option => {
          if (!optionStats[option.id]) {
            optionStats[option.id] = {
              optionId: option.id,
              name: option.name,
              totalUsage: 0,
              totalQuantity: 0,
              totalRevenue: 0,
              usageRate: 0
            };
          }
          
          optionStats[option.id].totalUsage++;
          optionStats[option.id].totalQuantity += option.quantity || 1;
          optionStats[option.id].totalRevenue += (option.taxIncludedPrice || option.price || 0) * (option.quantity || 1);
        });
      }
    });
    
    // 使用率計算
    const totalBookings = approvedBookings.length;
    Object.values(optionStats).forEach(stat => {
      stat.usageRate = totalBookings > 0 ? (stat.totalUsage / totalBookings) * 100 : 0;
    });
    
    return Object.values(optionStats).sort((a, b) => b.totalRevenue - a.totalRevenue);
  } catch (error) {
    console.error('Get option usage stats error:', error);
    return [];
  }
}

/**
 * プラン使用統計
 */
async function getPlanUsageStats(startDate, endDate) {
  try {
    const approvedBookings = await getApprovedBookingsByDateRange(startDate, endDate);
    const planStats = {};
    
    approvedBookings.forEach(booking => {
      const plan = booking.plan || 'unknown';
      
      if (!planStats[plan]) {
        planStats[plan] = {
          plan: plan,
          planDetails: booking.planDetails || '',
          totalBookings: 0,
          totalRevenue: 0,
          avgDuration: 0
        };
      }
      
      planStats[plan].totalBookings++;
      planStats[plan].totalRevenue += calculateBookingRevenue(booking);
      
      if (booking.startTime && booking.endTime) {
        const duration = (new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60 * 60);
        planStats[plan].avgDuration = (planStats[plan].avgDuration + duration) / 2;
      }
    });
    
    return Object.values(planStats).sort((a, b) => b.totalRevenue - a.totalRevenue);
  } catch (error) {
    console.error('Get plan usage stats error:', error);
    return [];
  }
}

/**
 * 日別売上データ取得
 */
async function getRevenueByDay(startDate, endDate) {
  try {
    const approvedBookings = await getApprovedBookingsByDateRange(startDate, endDate);
    const revenueByDay = {};
    
    // 日付範囲の全日をゼロで初期化
    const currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      revenueByDay[dateStr] = {
        date: dateStr,
        revenue: 0,
        bookingCount: 0,
        avgBookingValue: 0
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // 実際の売上データを集計
    approvedBookings.forEach(booking => {
      const date = booking.startTime ? booking.startTime.split('T')[0] : null;
      if (date && revenueByDay[date]) {
        const revenue = calculateBookingRevenue(booking);
        revenueByDay[date].revenue += revenue;
        revenueByDay[date].bookingCount++;
      }
    });
    
    // 平均予約価値を計算
    Object.values(revenueByDay).forEach(day => {
      day.avgBookingValue = day.bookingCount > 0 ? day.revenue / day.bookingCount : 0;
    });
    
    return Object.values(revenueByDay).sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Get revenue by day error:', error);
    return [];
  }
}

/**
 * コンバージョン率計算
 */
async function calculateConversionRate(startDate, endDate) {
  try {
    const statusTrends = await getStatusTrends(startDate, endDate);
    const totalApplications = (statusTrends[BOOKING_STATUS.PENDING] || []).length + 
                             (statusTrends[BOOKING_STATUS.APPROVED] || []).length + 
                             (statusTrends[BOOKING_STATUS.REJECTED] || []).length;
    const approvedApplications = (statusTrends[BOOKING_STATUS.APPROVED] || []).length;
    
    return totalApplications > 0 ? (approvedApplications / totalApplications) * 100 : 0;
  } catch (error) {
    console.error('Calculate conversion rate error:', error);
    return 0;
  }
}

/**
 * リピート顧客率計算
 */
async function calculateRepeatCustomerRate(startDate, endDate) {
  try {
    const activeUsers = await getActiveUsersInPeriod(startDate, endDate);
    const repeatUsers = activeUsers.filter(user => user.bookingCount > 1);
    
    return activeUsers.length > 0 ? (repeatUsers.length / activeUsers.length) * 100 : 0;
  } catch (error) {
    console.error('Calculate repeat customer rate error:', error);
    return 0;
  }
}

/**
 * 売上成長率計算
 */
function calculateRevenueGrowth(revenueByDay) {
  if (revenueByDay.length < 2) return 0;
  
  const firstDayRevenue = revenueByDay[0].revenue;
  const lastDayRevenue = revenueByDay[revenueByDay.length - 1].revenue;
  
  if (firstDayRevenue === 0) return lastDayRevenue > 0 ? 100 : 0;
  
  return ((lastDayRevenue - firstDayRevenue) / firstDayRevenue) * 100;
}

/**
 * 予約タイプ別売上計算
 */
function calculateRevenueByBookingType(bookings) {
  const typeRevenue = {
    [BOOKING_TYPE.TEMPORARY]: 0,
    [BOOKING_TYPE.CONFIRMED]: 0
  };
  
  bookings.forEach(booking => {
    if (booking.status === BOOKING_STATUS.APPROVED) {
      const revenue = calculateBookingRevenue(booking);
      if (typeRevenue.hasOwnProperty(booking.bookingType)) {
        typeRevenue[booking.bookingType] += revenue;
      }
    }
  });
  
  return typeRevenue;
}

/**
 * 個別予約の売上計算ヘルパー
 */
function calculateBookingRevenue(booking) {
  let revenue = 0;
  
  // 基本料金計算
  if (booking.startTime && booking.endTime) {
    const duration = (new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60 * 60);
    revenue += duration * 5500; // 基本料金（税込）
  }
  
  // オプション料金計算
  if (booking.options && Array.isArray(booking.options)) {
    booking.options.forEach(option => {
      revenue += (option.taxIncludedPrice || option.price || 0) * (option.quantity || 1);
    });
  }
  
  // 保険料金計算
  if (booking.insurance && booking.insurance.selected) {
    revenue += booking.insurance.taxIncludedPrice || booking.insurance.price || 0;
  }
  
  return revenue;
}
