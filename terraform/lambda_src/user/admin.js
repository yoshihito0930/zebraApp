const AWS = require('aws-sdk');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = process.env.USERS_TABLE || 'studio-booking-users';

/**
 * 管理者用ユーザー管理Lambda関数
 * ユーザー一覧取得、ユーザー情報取得、権限設定などの機能を提供
 */
exports.handler = async (event) => {
  try {
    console.log('Admin user management event received:', JSON.stringify(event, null, 2));
    
    // API Gateway オーソライザーから渡されるコンテキスト情報
    const requestContext = event.requestContext || {};
    const authorizer = requestContext.authorizer || {};
    const isAdmin = authorizer.isAdmin === 'true';
    
    // 管理者権限チェック
    if (!isAdmin) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          code: 'FORBIDDEN',
          message: '管理者権限が必要です。' 
        })
      };
    }
    
    // リソースパスとHTTPメソッドに基づいて処理を分岐
    const path = event.resource;
    const method = event.httpMethod;
    
    if (path === '/api/admin/users' && method === 'GET') {
      return await handleListUsers(event);
    } else if (path === '/api/admin/users/{userId}' && method === 'GET') {
      return await handleGetUser(event);
    } else if (path === '/api/admin/users/{userId}' && method === 'PUT') {
      return await handleUpdateUser(event);
    } else if (path === '/api/admin/users/{userId}/toggle-admin' && method === 'POST') {
      return await handleToggleAdminStatus(event);
    } else {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          code: 'NOT_FOUND',
          message: '指定されたリソースが見つかりません。' 
        })
      };
    }
    
  } catch (error) {
    console.error('Admin user management error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 'SERVER_ERROR',
        message: 'ユーザー管理処理中にエラーが発生しました。'
      })
    };
  }
};

/**
 * ユーザー一覧取得
 */
async function handleListUsers(event) {
  // クエリパラメータ
  const queryParams = event.queryStringParameters || {};
  const limit = parseInt(queryParams.limit) || 50;
  const lastEvaluatedKey = queryParams.lastEvaluatedKey ? JSON.parse(decodeURIComponent(queryParams.lastEvaluatedKey)) : undefined;
  
  // DynamoDB検索パラメータ
  const params = {
    TableName: USERS_TABLE,
    Limit: limit
  };
  
  // 継続トークンがある場合
  if (lastEvaluatedKey) {
    params.ExclusiveStartKey = lastEvaluatedKey;
  }
  
  // スキャン実行
  const result = await dynamoDB.scan(params).promise();
  
  // パスワードハッシュなど機密情報を除外
  const users = result.Items.map(user => {
    // PKからユーザーIDを抽出
    const userId = user.PK.replace('USER#', '');
    
    // 機密情報を除外し、IDを追加
    const { hashedPassword, PK, ...userData } = user;
    userData.userId = userId;
    
    return userData;
  });
  
  // レスポンス作成
  const response = {
    users,
    count: users.length,
    scannedCount: result.ScannedCount
  };
  
  // 継続トークンがある場合は追加
  if (result.LastEvaluatedKey) {
    response.lastEvaluatedKey = encodeURIComponent(JSON.stringify(result.LastEvaluatedKey));
  }
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(response)
  };
}

/**
 * 特定ユーザー情報取得
 */
async function handleGetUser(event) {
  // パスパラメータからユーザーID取得
  const userId = event.pathParameters.userId;
  
  // ユーザー情報取得
  const user = await getUserById(userId);
  
  if (!user) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        code: 'USER_NOT_FOUND',
        message: 'ユーザーが見つかりません。' 
      })
    };
  }
  
  // パスワードハッシュなどの機密情報を除外
  const { hashedPassword, ...userProfile } = user;
  
  // ユーザーIDをPK形式から通常の形式に変換
  userProfile.userId = userId;
  delete userProfile.PK;
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(userProfile)
  };
}

/**
 * ユーザー情報更新（管理者用）
 */
async function handleUpdateUser(event) {
  // パスパラメータからユーザーID取得
  const userId = event.pathParameters.userId;
  
  // リクエストボディの解析
  const requestBody = JSON.parse(event.body);
  const { fullName, address, phone, isActive } = requestBody;
  
  // ユーザー情報取得
  const user = await getUserById(userId);
  
  if (!user) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        code: 'USER_NOT_FOUND',
        message: 'ユーザーが見つかりません。' 
      })
    };
  }
  
  // 更新パラメータの準備
  let updateExpression = 'SET updatedAt = :updatedAt';
  const expressionAttributeValues = {
    ':updatedAt': new Date().toISOString()
  };
  
  // 氏名の更新
  if (fullName !== undefined) {
    updateExpression += ', fullName = :fullName';
    expressionAttributeValues[':fullName'] = fullName;
  }
  
  // 住所の更新
  if (address !== undefined) {
    updateExpression += ', address = :address';
    expressionAttributeValues[':address'] = address;
  }
  
  // 電話番号の更新
  if (phone !== undefined) {
    updateExpression += ', phone = :phone';
    expressionAttributeValues[':phone'] = phone;
  }
  
  // アクティブステータスの更新
  if (isActive !== undefined) {
    updateExpression += ', isActive = :isActive';
    expressionAttributeValues[':isActive'] = isActive;
  }
  
  // ユーザー情報更新
  const params = {
    TableName: USERS_TABLE,
    Key: {
      PK: `USER#${userId}`
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  };
  
  const result = await dynamoDB.update(params).promise();
  const updatedUser = result.Attributes;
  
  // パスワードハッシュなどの機密情報を除外
  const { hashedPassword, ...userProfile } = updatedUser;
  
  // ユーザーIDをPK形式から通常の形式に変換
  userProfile.userId = userId;
  delete userProfile.PK;
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      message: 'ユーザー情報を更新しました。',
      user: userProfile
    })
  };
}

/**
 * 管理者ステータスの切り替え
 */
async function handleToggleAdminStatus(event) {
  // パスパラメータからユーザーID取得
  const userId = event.pathParameters.userId;
  
  // リクエストボディの解析
  const requestBody = JSON.parse(event.body);
  const { isAdmin } = requestBody;
  
  // 入力検証
  if (isAdmin === undefined) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        code: 'INVALID_PARAMETERS',
        message: '管理者ステータス（isAdmin）が必要です。' 
      })
    };
  }
  
  // ユーザー情報取得
  const user = await getUserById(userId);
  
  if (!user) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        code: 'USER_NOT_FOUND',
        message: 'ユーザーが見つかりません。' 
      })
    };
  }
  
  // 管理者権限更新
  const params = {
    TableName: USERS_TABLE,
    Key: {
      PK: `USER#${userId}`
    },
    UpdateExpression: 'SET isAdmin = :isAdmin, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':isAdmin': isAdmin,
      ':updatedAt': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  };
  
  const result = await dynamoDB.update(params).promise();
  const updatedUser = result.Attributes;
  
  // パスワードハッシュなどの機密情報を除外
  const { hashedPassword, ...userProfile } = updatedUser;
  
  // ユーザーIDをPK形式から通常の形式に変換
  userProfile.userId = userId;
  delete userProfile.PK;
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      message: `管理者権限を${isAdmin ? '付与' : '解除'}しました。`,
      user: userProfile
    })
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
