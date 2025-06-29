const AWS = require('aws-sdk');
const tokenService = require('./lib/tokenService');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = process.env.USERS_TABLE || 'studio-booking-users';

/**
 * トークン更新Lambda関数
 */
exports.handler = async (event) => {
  try {
    console.log('Refresh event received:', JSON.stringify(event, null, 2));
    
    // リクエストボディの解析
    const requestBody = JSON.parse(event.body);
    const { refreshToken } = requestBody;
    
    // 入力検証
    if (!refreshToken) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          code: 'INVALID_PARAMETERS',
          message: 'リフレッシュトークンが必要です。' 
        })
      };
    }
    
    // リフレッシュトークンの検証
    const tokenValidation = await tokenService.validateRefreshToken(refreshToken);
    if (!tokenValidation.valid) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          code: tokenValidation.error,
          message: tokenValidation.error === 'TOKEN_EXPIRED' 
            ? 'リフレッシュトークンの期限が切れています。再ログインが必要です。'
            : '無効なリフレッシュトークンです。'
        })
      };
    }
    
    // ユーザー情報の取得
    const userId = tokenValidation.userId;
    const user = await getUserById(userId);
    
    if (!user) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません。再ログインが必要です。'
        })
      };
    }
    
    // クライアント情報
    const clientInfo = {
      ip: event.requestContext?.identity?.sourceIp || 'unknown',
      userAgent: event.requestContext?.identity?.userAgent || 'unknown'
    };
    
    // 既存のトークンを無効化
    await tokenService.revokeRefreshToken(refreshToken);
    
    // 新しいトークンペアを生成
    const userForToken = {
      userId,
      email: user.email,
      fullName: user.fullName,
      isAdmin: user.isAdmin
    };
    
    const tokens = await tokenService.generateTokens(userForToken, clientInfo);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(tokens)
    };
    
  } catch (error) {
    console.error('Token refresh error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 'SERVER_ERROR',
        message: 'トークン更新中にエラーが発生しました。'
      })
    };
  }
};

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
