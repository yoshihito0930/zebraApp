const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = process.env.USERS_TABLE || 'studio-booking-users';
const SALT_ROUNDS = 12;

/**
 * ユーザープロフィール管理Lambda関数
 * プロフィール取得と更新機能を提供
 */
exports.handler = async (event) => {
  try {
    console.log('Profile event received:', JSON.stringify(event, null, 2));
    
    // HTTP メソッドに基づいて処理を分岐
    switch (event.httpMethod) {
      case 'GET':
        return await handleGetProfile(event);
      case 'PUT':
        return await handleUpdateProfile(event);
      default:
        return {
          statusCode: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT'
          },
          body: JSON.stringify({ 
            code: 'METHOD_NOT_ALLOWED',
            message: 'サポートされていないHTTPメソッドです。' 
          })
        };
    }
  } catch (error) {
    console.error('Profile error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 'SERVER_ERROR',
        message: 'プロフィール処理中にエラーが発生しました。'
      })
    };
  }
};

/**
 * プロフィール取得
 */
async function handleGetProfile(event) {
  // API Gateway オーソライザーから渡されるコンテキスト情報
  const requestContext = event.requestContext || {};
  const authorizer = requestContext.authorizer || {};
  const userId = authorizer.userId;
  
  if (!userId) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        code: 'UNAUTHORIZED',
        message: '認証が必要です。' 
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
 * プロフィール更新
 */
async function handleUpdateProfile(event) {
  // API Gateway オーソライザーから渡されるコンテキスト情報
  const requestContext = event.requestContext || {};
  const authorizer = requestContext.authorizer || {};
  const userId = authorizer.userId;
  
  if (!userId) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        code: 'UNAUTHORIZED',
        message: '認証が必要です。' 
      })
    };
  }
  
  // リクエストボディの解析
  const requestBody = JSON.parse(event.body);
  const { fullName, address, phone, currentPassword, newPassword } = requestBody;
  
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
  
  // パスワード変更の処理
  if (newPassword) {
    // 現在のパスワードが必要
    if (!currentPassword) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          code: 'CURRENT_PASSWORD_REQUIRED',
          message: '現在のパスワードが必要です。' 
        })
      };
    }
    
    // 現在のパスワード検証
    const isPasswordValid = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!isPasswordValid) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          code: 'INVALID_PASSWORD',
          message: '現在のパスワードが正しくありません。' 
        })
      };
    }
    
    // パスワードの強度チェック（簡易的な実装）
    if (newPassword.length < 8) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          code: 'WEAK_PASSWORD',
          message: 'パスワードは8文字以上である必要があります。' 
        })
      };
    }
    
    // 新しいパスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    updateExpression += ', hashedPassword = :hashedPassword';
    expressionAttributeValues[':hashedPassword'] = hashedPassword;
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
      message: 'プロフィールを更新しました。',
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
