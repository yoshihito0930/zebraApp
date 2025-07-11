const AWS = require('aws-sdk');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = process.env.USERS_TABLE || 'studio-booking-users';

/**
 * ユーザー管理Lambda関数（API仕様準拠）
 * /users エンドポイントのための統合ユーザー管理機能
 */
exports.handler = async (event) => {
  try {
    console.log('User management event received:', JSON.stringify(event, null, 2));
    
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
    
    // パスとメソッドに基づいて処理を分岐
    const path = event.path || event.resource || '';
    const method = event.httpMethod;
    
    if (path === '/users' && method === 'GET') {
      return await handleListUsers(event);
    } else if (path.includes('/users/') && method === 'GET') {
      return await handleGetUser(event);
    } else if (path.includes('/users/statistics') && method === 'GET') {
      return await handleUserStatistics(event);
    } else {
      return createErrorResponse(404, 'NOT_FOUND', '指定されたエンドポイントが見つかりません。');
    }
    
  } catch (error) {
    console.error('User management error:', error);
    return createErrorResponse(500, 'SERVER_ERROR', 'ユーザー管理処理中にエラーが発生しました。');
  }
};

/**
 * ユーザー一覧取得（管理者用）
 */
async function handleListUsers(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    
    // パラメータ解析
    const {
      search,
      isActive,
      isAdmin,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryParams;
    
    // 入力値検証
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    
    // ユーザー一覧取得
    const result = await getUsersList({
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      isAdmin: isAdmin !== undefined ? isAdmin === 'true' : undefined,
      fromDate,
      toDate,
      page: pageNum,
      limit: limitNum,
      sortBy,
      sortOrder
    });
    
    // 統計情報の取得
    const statistics = await getUserStatisticsSummary();
    
    const response = {
      data: result.users,
      pagination: {
        total: result.totalCount,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(result.totalCount / limitNum),
        hasNext: pageNum * limitNum < result.totalCount,
        hasPrev: pageNum > 1
      },
      filters: {
        search,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        isAdmin: isAdmin !== undefined ? isAdmin === 'true' : undefined,
        fromDate,
        toDate
      },
      statistics,
      generatedAt: new Date().toISOString()
    };
    
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Get users list error:', error);
    return createErrorResponse(500, 'SERVER_ERROR', 'ユーザー一覧の取得中にエラーが発生しました。');
  }
}

/**
 * 特定ユーザー情報取得
 */
async function handleGetUser(event) {
  try {
    // パスパラメータからユーザーID取得
    const pathParts = event.path.split('/');
    const targetUserId = pathParts[pathParts.length - 1];
    
    if (!targetUserId) {
      return createErrorResponse(400, 'INVALID_PARAMETER', 'ユーザーIDが必要です。');
    }
    
    // ユーザー情報取得
    const user = await getUserById(targetUserId);
    
    if (!user) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'ユーザーが見つかりません。');
    }
    
    // ユーザーの予約統計を取得
    const bookingStats = await getUserBookingStatistics(targetUserId);
    
    // パスワードハッシュなどの機密情報を除外
    const { hashedPassword, PK, ...userProfile } = user;
    
    // ユーザーIDをPK形式から通常の形式に変換
    userProfile.id = targetUserId;
    
    // 予約統計を追加
    userProfile.bookingStatistics = bookingStats;
    
    return createSuccessResponse(200, userProfile);
    
  } catch (error) {
    console.error('Get user error:', error);
    return createErrorResponse(500, 'SERVER_ERROR', 'ユーザー情報の取得中にエラーが発生しました。');
  }
}

/**
 * ユーザー統計情報取得
 */
async function handleUserStatistics(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const { period = 'month' } = queryParams;
    
    const statistics = await getDetailedUserStatistics(period);
    
    const response = {
      period,
      ...statistics,
      generatedAt: new Date().toISOString()
    };
    
    return createSuccessResponse(200, response);
    
  } catch (error) {
    console.error('Get user statistics error:', error);
    return createErrorResponse(500, 'SERVER_ERROR', 'ユーザー統計の取得中にエラーが発生しました。');
  }
}

// ===== ヘルパー関数 =====

/**
 * ユーザー一覧取得（フィルター・ソート・ページネーション対応）
 */
async function getUsersList(options = {}) {
  const { search, isActive, isAdmin, fromDate, toDate, page, limit, sortBy, sortOrder } = options;
  
  // DynamoDB検索パラメータ
  const params = {
    TableName: USERS_TABLE
  };
  
  // 全ユーザーをスキャン（実際の本番環境では、GSIを使用することを推奨）
  const result = await dynamoDB.scan(params).promise();
  let users = result.Items || [];
  
  // PK形式のユーザーのみを抽出
  users = users.filter(user => user.PK && user.PK.startsWith('USER#'));
  
  // フィルタリング
  if (search) {
    const searchLower = search.toLowerCase();
    users = users.filter(user => 
      (user.fullName && user.fullName.toLowerCase().includes(searchLower)) ||
      (user.email && user.email.toLowerCase().includes(searchLower))
    );
  }
  
  if (isActive !== undefined) {
    users = users.filter(user => user.isActive === isActive);
  }
  
  if (isAdmin !== undefined) {
    users = users.filter(user => user.isAdmin === isAdmin);
  }
  
  if (fromDate) {
    users = users.filter(user => user.createdAt >= fromDate);
  }
  
  if (toDate) {
    users = users.filter(user => user.createdAt <= toDate + 'T23:59:59.999Z');
  }
  
  // ソート
  users = sortUsers(users, sortBy, sortOrder);
  
  // パスワードハッシュなど機密情報を除外し、IDを追加
  const cleanedUsers = users.map(user => {
    const { hashedPassword, PK, ...userData } = user;
    userData.id = user.PK.replace('USER#', '');
    return userData;
  });
  
  // ページネーション
  const startIndex = ((page || 1) - 1) * (limit || 20);
  const paginatedUsers = cleanedUsers.slice(startIndex, startIndex + (limit || 20));
  
  return {
    users: paginatedUsers,
    totalCount: cleanedUsers.length
  };
}

/**
 * ユーザーIDからユーザー情報を取得
 */
async function getUserById(userId) {
  const params = {
    TableName: USERS_TABLE,
    Key: {
      PK: `USER#${userId}`
    }
  };
  
  const result = await dynamoDB.get(params).promise();
  return result.Item;
}

/**
 * ユーザーの予約統計を取得
 */
async function getUserBookingStatistics(userId) {
  // 簡略化実装（実際には予約テーブルからデータを取得）
  try {
    const BOOKINGS_TABLE = process.env.BOOKINGS_TABLE || 'studio-booking-bookings';
    
    const params = {
      TableName: BOOKINGS_TABLE,
      IndexName: 'UserBookingsIndex',
      KeyConditionExpression: 'GSI1PK = :userKey',
      ExpressionAttributeValues: {
        ':userKey': `USER#${userId}`
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    const bookings = result.Items || [];
    
    const stats = {
      totalBookings: bookings.length,
      pendingBookings: bookings.filter(b => b.status === 'pending').length,
      approvedBookings: bookings.filter(b => b.status === 'approved').length,
      cancelledBookings: bookings.filter(b => b.status === 'cancelled').length,
      temporaryBookings: bookings.filter(b => b.bookingType === 'temporary').length,
      confirmedBookings: bookings.filter(b => b.bookingType === 'confirmed').length,
      totalUsageMinutes: bookings
        .filter(b => b.status === 'approved')
        .reduce((total, booking) => {
          if (booking.startTime && booking.endTime) {
            const start = new Date(booking.startTime);
            const end = new Date(booking.endTime);
            const minutes = (end - start) / (1000 * 60);
            return total + minutes;
          }
          return total;
        }, 0)
    };
    
    return stats;
  } catch (error) {
    console.error('Error getting user booking statistics:', error);
    return {
      totalBookings: 0,
      pendingBookings: 0,
      approvedBookings: 0,
      cancelledBookings: 0,
      temporaryBookings: 0,
      confirmedBookings: 0,
      totalUsageMinutes: 0
    };
  }
}

/**
 * ユーザー統計概要取得
 */
async function getUserStatisticsSummary() {
  try {
    const params = {
      TableName: USERS_TABLE
    };
    
    const result = await dynamoDB.scan(params).promise();
    const users = result.Items.filter(item => item.PK && item.PK.startsWith('USER#'));
    
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    
    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter(user => user.isActive !== false).length,
      adminUsers: users.filter(user => user.isAdmin === true).length,
      newUsersThisMonth: users.filter(user => 
        user.createdAt && new Date(user.createdAt) >= lastMonth
      ).length,
      inactiveUsers: users.filter(user => user.isActive === false).length
    };
    
    return stats;
  } catch (error) {
    console.error('Error getting user statistics summary:', error);
    return {
      totalUsers: 0,
      activeUsers: 0,
      adminUsers: 0,
      newUsersThisMonth: 0,
      inactiveUsers: 0
    };
  }
}

/**
 * 詳細ユーザー統計取得
 */
async function getDetailedUserStatistics(period) {
  try {
    const params = {
      TableName: USERS_TABLE
    };
    
    const result = await dynamoDB.scan(params).promise();
    const users = result.Items.filter(item => item.PK && item.PK.startsWith('USER#'));
    
    const now = new Date();
    let periodStart;
    
    switch (period) {
      case 'week':
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        periodStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'year':
        periodStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        periodStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    }
    
    const stats = {
      summary: {
        totalUsers: users.length,
        activeUsers: users.filter(user => user.isActive !== false).length,
        adminUsers: users.filter(user => user.isAdmin === true).length,
        inactiveUsers: users.filter(user => user.isActive === false).length
      },
      periodAnalysis: {
        newUsers: users.filter(user => 
          user.createdAt && new Date(user.createdAt) >= periodStart
        ).length,
        periodStart: periodStart.toISOString(),
        periodEnd: now.toISOString()
      },
      breakdown: {
        byRegistrationDate: getRegistrationBreakdown(users, period),
        byActiveStatus: {
          active: users.filter(user => user.isActive !== false).length,
          inactive: users.filter(user => user.isActive === false).length
        },
        byAdminStatus: {
          admin: users.filter(user => user.isAdmin === true).length,
          regular: users.filter(user => user.isAdmin !== true).length
        }
      }
    };
    
    return stats;
  } catch (error) {
    console.error('Error getting detailed user statistics:', error);
    return {
      summary: { totalUsers: 0, activeUsers: 0, adminUsers: 0, inactiveUsers: 0 },
      periodAnalysis: { newUsers: 0, periodStart: '', periodEnd: '' },
      breakdown: {
        byRegistrationDate: [],
        byActiveStatus: { active: 0, inactive: 0 },
        byAdminStatus: { admin: 0, regular: 0 }
      }
    };
  }
}

/**
 * 登録日別の統計分析
 */
function getRegistrationBreakdown(users, period) {
  const breakdown = {};
  const now = new Date();
  
  users.forEach(user => {
    if (!user.createdAt) return;
    
    const createdDate = new Date(user.createdAt);
    let key;
    
    switch (period) {
      case 'week':
        key = createdDate.toISOString().split('T')[0]; // YYYY-MM-DD
        break;
      case 'month':
        key = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'year':
        key = createdDate.getFullYear().toString();
        break;
      default:
        key = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
    }
    
    breakdown[key] = (breakdown[key] || 0) + 1;
  });
  
  return Object.entries(breakdown)
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * ユーザーの並び替え
 */
function sortUsers(users, sortBy = 'createdAt', sortOrder = 'desc') {
  return users.sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];
    
    // 日付形式の場合
    if (sortBy.includes('At') || sortBy.includes('Time')) {
      aValue = new Date(aValue || 0);
      bValue = new Date(bValue || 0);
    }
    
    // 文字列の場合は小文字で比較
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    
    if (sortOrder === 'desc') {
      return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
    } else {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    }
  });
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
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify(data)
  };
}

/**
 * エラーレスポンスの作成
 */
function createErrorResponse(statusCode, code, message) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify({
      code,
      message
    })
  };
}
