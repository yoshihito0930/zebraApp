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
 * 予約分析専用Lambda関数
 * 高度な分析クエリとレポート生成機能を提供
 */
exports.handler = async (event) => {
  try {
    console.log('Analytics event received:', JSON.stringify(event, null, 2));
    
    const userId = getUserIdFromEvent(event);
    const isAdmin = getIsAdminFromEvent(event);
    
    if (!userId) {
      return createErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
    }
    
    if (!isAdmin) {
      return createErrorResponse(403, ERROR_CODES.FORBIDDEN, '管理者権限が必要です。');
    }
    
    // パスに基づいて処理を分岐
    const path = event.path || event.resource || '';
    const method = event.httpMethod;
    
    if (path.includes('/analytics/advanced-search') && method === 'POST') {
      return await handleAdvancedSearch(event);
    } else if (path.includes('/analytics/booking-trends') && method === 'GET') {
      return await handleBookingTrends(event);
    } else if (path.includes('/analytics/user-behavior') && method === 'GET') {
      return await handleUserBehaviorAnalysis(event);
    } else if (path.includes('/analytics/capacity-analysis') && method === 'GET') {
      return await handleCapacityAnalysis(event);
    } else if (path.includes('/analytics/revenue-forecasting') && method === 'GET') {
      return await handleRevenueForecasting(event);
    } else if (path.includes('/analytics/export') && method === 'POST') {
      return await handleDataExport(event);
    } else {
      return createErrorResponse(404, ERROR_CODES.NOT_FOUND, '指定されたエンドポイントが見つかりません。');
    }
    
  } catch (error) {
    console.error('Analytics error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '分析処理中にエラーが発生しました。');
  }
};

/**
 * 高度な予約検索（複数条件、GSI活用）
 */
async function handleAdvancedSearch(event) {
  try {
    const searchCriteria = JSON.parse(event.body || '{}');
    
    const {
      status,
      bookingType,
      startDate,
      endDate,
      userId,
      plan,
      minRevenue,
      maxRevenue,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 50,
      offset = 0
    } = searchCriteria;
    
    let results = [];
    
    // ステータス指定がある場合はGSI2を使用
    if (status) {
      results = await searchByStatus(status, searchCriteria);
    }
    // 日付範囲指定がある場合はGSI3を使用
    else if (startDate && endDate) {
      results = await searchByDateRange(startDate, endDate, searchCriteria);
    }
    // ユーザー指定がある場合はGSI1を使用
    else if (userId) {
      results = await searchByUser(userId, searchCriteria);
    }
    // 条件なしの場合は全件検索（制限付き）
    else {
      results = await searchAll(searchCriteria);
    }
    
    // 追加フィルタリング
    results = applyAdditionalFilters(results, searchCriteria);
    
    // ソート
    results = sortResults(results, sortBy, sortOrder);
    
    // ページネーション
    const total = results.length;
    const paginatedResults = results.slice(offset, offset + limit);
    
    // 統計情報付加
    const statistics = calculateSearchStatistics(results);
    
    return createSuccessResponse(200, {
      results: paginatedResults,
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + limit < total
      },
      statistics,
      searchCriteria
    });
    
  } catch (error) {
    console.error('Advanced search error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '高度検索処理中にエラーが発生しました。');
  }
}

/**
 * 予約トレンド分析
 */
async function handleBookingTrends(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const {
      period = 'month',
      metric = 'count',
      groupBy = 'day',
      endDate = new Date().toISOString().split('T')[0]
    } = queryParams;
    
    const { startDate } = calculateDateRange(period, endDate);
    
    // GSI3を活用した効率的な日付範囲クエリ
    const bookings = await getBookingsByDateRangeOptimized(startDate, endDate);
    
    let trendData;
    
    switch (groupBy) {
      case 'hour':
        trendData = groupBookingsByHour(bookings, metric);
        break;
      case 'day':
        trendData = groupBookingsByDay(bookings, metric);
        break;
      case 'week':
        trendData = groupBookingsByWeek(bookings, metric);
        break;
      case 'month':
        trendData = groupBookingsByMonth(bookings, metric);
        break;
      default:
        trendData = groupBookingsByDay(bookings, metric);
    }
    
    // トレンド分析
    const trendAnalysis = analyzeTrends(trendData);
    
    // 予測データ生成（簡易版）
    const forecast = generateSimpleForecast(trendData, 7); // 7期間先の予測
    
    return createSuccessResponse(200, {
      period: { period, startDate, endDate },
      groupBy,
      metric,
      trendData,
      analysis: trendAnalysis,
      forecast,
      totalBookings: bookings.length,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Booking trends error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, 'トレンド分析中にエラーが発生しました。');
  }
}

/**
 * ユーザー行動分析
 */
async function handleUserBehaviorAnalysis(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const {
      period = 'month',
      endDate = new Date().toISOString().split('T')[0]
    } = queryParams;
    
    const { startDate } = calculateDateRange(period, endDate);
    
    // 並列クエリで効率化
    const [
      bookings,
      userSegments,
      conversionFunnel,
      loyaltyAnalysis
    ] = await Promise.all([
      getBookingsByDateRangeOptimized(startDate, endDate),
      analyzeUserSegments(startDate, endDate),
      analyzeConversionFunnel(startDate, endDate),
      analyzeLoyalty(startDate, endDate)
    ]);
    
    // ユーザー行動パターン分析
    const behaviorPatterns = analyzeBehaviorPatterns(bookings);
    
    // リテンション分析
    const retentionData = analyzeRetention(bookings);
    
    // ユーザーライフサイクル分析
    const lifecycleAnalysis = analyzeUserLifecycle(bookings);
    
    return createSuccessResponse(200, {
      period: { period, startDate, endDate },
      userSegments,
      conversionFunnel,
      loyaltyAnalysis,
      behaviorPatterns,
      retentionData,
      lifecycleAnalysis,
      summary: {
        totalUsers: userSegments.totalUsers,
        activeUsers: userSegments.activeUsers,
        newUsers: userSegments.newUsers,
        returningUsers: userSegments.returningUsers
      },
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('User behavior analysis error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, 'ユーザー行動分析中にエラーが発生しました。');
  }
}

/**
 * キャパシティ分析
 */
async function handleCapacityAnalysis(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const {
      startDate = new Date().toISOString().split('T')[0],
      endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30日後
      timeSlotSize = 1 // 時間単位
    } = queryParams;
    
    // カレンダーテーブルからデータ取得（GSI活用）
    const capacityData = await analyzeCapacityUtilization(startDate, endDate, timeSlotSize);
    
    // ピーク時間帯分析
    const peakAnalysis = analyzePeakTimes(capacityData);
    
    // 稼働率分析
    const utilizationAnalysis = analyzeUtilization(capacityData);
    
    // 最適化提案
    const optimizationSuggestions = generateOptimizationSuggestions(capacityData, peakAnalysis);
    
    return createSuccessResponse(200, {
      period: { startDate, endDate },
      timeSlotSize,
      capacityData,
      peakAnalysis,
      utilizationAnalysis,
      optimizationSuggestions,
      summary: {
        averageUtilization: utilizationAnalysis.averageUtilization,
        peakUtilization: utilizationAnalysis.peakUtilization,
        lowUtilizationSlots: utilizationAnalysis.lowUtilizationSlots
      },
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Capacity analysis error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, 'キャパシティ分析中にエラーが発生しました。');
  }
}

/**
 * 売上予測
 */
async function handleRevenueForecasting(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const {
      period = 'month',
      forecastPeriod = 30, // 予測期間（日）
      endDate = new Date().toISOString().split('T')[0]
    } = queryParams;
    
    const { startDate } = calculateDateRange(period, endDate);
    
    // 過去の売上データ取得
    const historicalRevenue = await getHistoricalRevenue(startDate, endDate);
    
    // 季節性分析
    const seasonalityAnalysis = analyzeSeasonality(historicalRevenue);
    
    // トレンド分析
    const trendAnalysis = analyzeTrendPattern(historicalRevenue);
    
    // 予測モデル（移動平均 + トレンド + 季節性）
    const forecast = generateRevenueForecast(
      historicalRevenue,
      trendAnalysis,
      seasonalityAnalysis,
      parseInt(forecastPeriod)
    );
    
    // 信頼区間計算
    const confidenceIntervals = calculateConfidenceIntervals(forecast, historicalRevenue);
    
    return createSuccessResponse(200, {
      historicalData: {
        period: { startDate, endDate },
        revenue: historicalRevenue
      },
      analysis: {
        trend: trendAnalysis,
        seasonality: seasonalityAnalysis
      },
      forecast: {
        period: forecastPeriod,
        predictions: forecast,
        confidenceIntervals
      },
      summary: {
        totalHistoricalRevenue: historicalRevenue.reduce((sum, day) => sum + day.revenue, 0),
        forecastedRevenue: forecast.reduce((sum, day) => sum + day.predictedRevenue, 0),
        growthRate: trendAnalysis.growthRate
      },
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Revenue forecasting error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, '売上予測中にエラーが発生しました。');
  }
}

/**
 * データエクスポート
 */
async function handleDataExport(event) {
  try {
    const exportRequest = JSON.parse(event.body || '{}');
    
    const {
      exportType,
      format = 'json',
      startDate,
      endDate,
      filters = {},
      includeFields = []
    } = exportRequest;
    
    let exportData;
    
    switch (exportType) {
      case 'bookings':
        exportData = await exportBookingsData(startDate, endDate, filters, includeFields);
        break;
      case 'users':
        exportData = await exportUsersData(filters, includeFields);
        break;
      case 'revenue':
        exportData = await exportRevenueData(startDate, endDate, filters);
        break;
      case 'analytics':
        exportData = await exportAnalyticsData(startDate, endDate, filters);
        break;
      default:
        return createErrorResponse(400, ERROR_CODES.INVALID_PARAMETERS, '無効なエクスポートタイプです。');
    }
    
    // フォーマット変換
    const formattedData = formatExportData(exportData, format);
    
    return createSuccessResponse(200, {
      exportType,
      format,
      period: startDate && endDate ? { startDate, endDate } : null,
      recordCount: Array.isArray(exportData) ? exportData.length : Object.keys(exportData).length,
      data: formattedData,
      exportedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Data export error:', error);
    return createErrorResponse(500, ERROR_CODES.SERVER_ERROR, 'データエクスポート中にエラーが発生しました。');
  }
}

// ===== ヘルパー関数 =====

/**
 * GSI2を使用したステータス別検索
 */
async function searchByStatus(status, criteria) {
  const params = {
    TableName: TABLES.BOOKINGS,
    IndexName: 'StatusBookingsIndex',
    KeyConditionExpression: 'GSI2PK = :statusKey',
    ExpressionAttributeValues: {
      ':statusKey': `STATUS#${status}`
    }
  };
  
  // 日付範囲フィルタ追加
  if (criteria.startDate && criteria.endDate) {
    params.FilterExpression = 'startTime BETWEEN :startDate AND :endDate';
    params.ExpressionAttributeValues[':startDate'] = criteria.startDate;
    params.ExpressionAttributeValues[':endDate'] = criteria.endDate + 'T23:59:59Z';
  }
  
  const result = await dynamoDB.query(params).promise();
  return result.Items || [];
}

/**
 * GSI3を使用した日付範囲検索
 */
async function searchByDateRange(startDate, endDate, criteria) {
  const bookings = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);
  
  const dateQueries = [];
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
    
    dateQueries.push(dynamoDB.query(params).promise());
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  const results = await Promise.all(dateQueries);
  results.forEach(result => {
    if (result.Items) {
      bookings.push(...result.Items);
    }
  });
  
  return bookings;
}

/**
 * GSI1を使用したユーザー別検索
 */
async function searchByUser(userId, criteria) {
  const params = {
    TableName: TABLES.BOOKINGS,
    IndexName: 'UserBookingsIndex',
    KeyConditionExpression: 'GSI1PK = :userKey',
    ExpressionAttributeValues: {
      ':userKey': `USER#${userId}`
    }
  };
  
  const result = await dynamoDB.query(params).promise();
  return result.Items || [];
}

/**
 * 全件検索（制限付き）
 */
async function searchAll(criteria) {
  const params = {
    TableName: TABLES.BOOKINGS,
    Limit: 1000 // 最大1000件
  };
  
  const result = await dynamoDB.scan(params).promise();
  return result.Items || [];
}

/**
 * 追加フィルタリング適用
 */
function applyAdditionalFilters(results, criteria) {
  let filtered = results;
  
  if (criteria.bookingType) {
    filtered = filtered.filter(booking => booking.bookingType === criteria.bookingType);
  }
  
  if (criteria.plan) {
    filtered = filtered.filter(booking => booking.plan === criteria.plan);
  }
  
  if (criteria.minRevenue || criteria.maxRevenue) {
    filtered = filtered.filter(booking => {
      const revenue = calculateBookingRevenue(booking);
      if (criteria.minRevenue && revenue < criteria.minRevenue) return false;
      if (criteria.maxRevenue && revenue > criteria.maxRevenue) return false;
      return true;
    });
  }
  
  return filtered;
}

/**
 * 結果のソート
 */
function sortResults(results, sortBy, sortOrder) {
  return results.sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];
    
    // 特殊処理
    if (sortBy === 'revenue') {
      aValue = calculateBookingRevenue(a);
      bValue = calculateBookingRevenue(b);
    }
    
    if (sortOrder === 'desc') {
      return bValue > aValue ? 1 : -1;
    } else {
      return aValue > bValue ? 1 : -1;
    }
  });
}

/**
 * 検索統計計算
 */
function calculateSearchStatistics(results) {
  const stats = {
    totalCount: results.length,
    statusDistribution: {},
    typeDistribution: {},
    totalRevenue: 0,
    averageRevenue: 0
  };
  
  const statusCounts = {};
  const typeCounts = {};
  let totalRevenue = 0;
  
  results.forEach(booking => {
    // ステータス分布
    statusCounts[booking.status] = (statusCounts[booking.status] || 0) + 1;
    
    // タイプ分布
    typeCounts[booking.bookingType] = (typeCounts[booking.bookingType] || 0) + 1;
    
    // 売上計算
    if (booking.status === BOOKING_STATUS.APPROVED) {
      totalRevenue += calculateBookingRevenue(booking);
    }
  });
  
  stats.statusDistribution = statusCounts;
  stats.typeDistribution = typeCounts;
  stats.totalRevenue = totalRevenue;
  stats.averageRevenue = results.length > 0 ? totalRevenue / results.length : 0;
  
  return stats;
}

/**
 * 期間計算
 */
function calculateDateRange(period, endDate) {
  const end = new Date(endDate);
  let start = new Date(end);
  
  switch (period) {
    case 'week':
      start.setDate(end.getDate() - 7);
      break;
    case 'month':
      start.setMonth(end.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(end.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(end.getFullYear() - 1);
      break;
    default:
      start.setMonth(end.getMonth() - 1);
  }
  
  return {
    startDate: start.toISOString().split('T')[0],
    endDate
  };
}

/**
 * 最適化された日付範囲クエリ
 */
async function getBookingsByDateRangeOptimized(startDate, endDate) {
  const bookings = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);
  
  // 並列処理で高速化
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
  
  const results = await Promise.all(datePromises);
  results.forEach(result => {
    if (result.Items) {
      bookings.push(...result.Items);
    }
  });
  
  return bookings;
}

// その他のヘルパー関数（簡略化のためモックまたは基本実装）
function groupBookingsByHour(bookings, metric) { return {}; }
function groupBookingsByDay(bookings, metric) { return {}; }
function groupBookingsByWeek(bookings, metric) { return {}; }
function groupBookingsByMonth(bookings, metric) { return {}; }
function analyzeTrends(trendData) { return {}; }
function generateSimpleForecast(trendData, periods) { return []; }
async function analyzeUserSegments(startDate, endDate) { return {}; }
async function analyzeConversionFunnel(startDate, endDate) { return {}; }
async function analyzeLoyalty(startDate, endDate) { return {}; }
function analyzeBehaviorPatterns(bookings) { return {}; }
function analyzeRetention(bookings) { return {}; }
function analyzeUserLifecycle(bookings) { return {}; }
async function analyzeCapacityUtilization(startDate, endDate, timeSlotSize) { return {}; }
function analyzePeakTimes(capacityData) { return {}; }
function analyzeUtilization(capacityData) { return {}; }
function generateOptimizationSuggestions(capacityData, peakAnalysis) { return []; }
async function getHistoricalRevenue(startDate, endDate) { return []; }
function analyzeSeasonality(historicalRevenue) { return {}; }
function analyzeTrendPattern(historicalRevenue) { return {}; }
function generateRevenueForecast(historical, trend, seasonality, periods) { return []; }
function calculateConfidenceIntervals(forecast, historical) { return {}; }
async function exportBookingsData(startDate, endDate, filters, includeFields) { return []; }
async function exportUsersData(filters, includeFields) { return []; }
async function exportRevenueData(startDate, endDate, filters) { return []; }
async function exportAnalyticsData(startDate, endDate, filters) { return []; }
function formatExportData(data, format) { return data; }

function calculateBookingRevenue(booking) {
  let revenue = 0;
  
  if (booking.startTime && booking.endTime) {
    const duration = (new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60 * 60);
    revenue += duration * 5500;
  }
  
  if (booking.options && Array.isArray(booking.options)) {
    booking.options.forEach(option => {
      revenue += (option.taxIncludedPrice || option.price || 0) * (option.quantity || 1);
    });
  }
  
  if (booking.insurance && booking.insurance.selected) {
    revenue += booking.insurance.taxIncludedPrice || booking.insurance.price || 0;
  }
  
  return revenue;
}

function getUserIdFromEvent(event) {
  const requestContext = event.requestContext || {};
  const authorizer = requestContext.authorizer || {};
  return authorizer.userId;
}

function getIsAdminFromEvent(event) {
  const requestContext = event.requestContext || {};
  const authorizer = requestContext.authorizer || {};
  return authorizer.isAdmin === 'true' || authorizer.isAdmin === true;
}

function createSuccessResponse(statusCode, data) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify(data)
  };
}

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
