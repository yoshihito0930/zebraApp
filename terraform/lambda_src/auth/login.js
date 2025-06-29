const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const tokenService = require('./lib/tokenService');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = process.env.USERS_TABLE || 'studio-booking-users';

/**
 * ログインLambda関数
 */
exports.handler = async (event) => {
  try {
    console.log('Login event received:', JSON.stringify(event, null, 2));
    
    // リクエストボディの解析
    const requestBody = JSON.parse(event.body);
    const { email, password } = requestBody;
    
    // 入力検証
    if (!email || !password) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          code: 'INVALID_PARAMETERS',
          message: 'メールアドレスとパスワードが必要です。' 
        })
      };
    }
    
    // ユーザーの検索
    const user = await findUserByEmail(email);
    if (!user) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          code: 'INVALID_CREDENTIALS',
          message: 'メールアドレスまたはパスワードが正しくありません。' 
        })
      };
    }
    
    // パスワード検証
    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isPasswordValid) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          code: 'INVALID_CREDENTIALS',
          message: 'メールアドレスまたはパスワードが正しくありません。' 
        })
      };
    }
    
    // クライアント情報の取得
    const clientInfo = {
      ip: event.requestContext?.identity?.sourceIp || 'unknown',
      userAgent: event.requestContext?.identity?.userAgent || 'unknown'
    };
    
    // JWTトークン生成
    const userForToken = {
      userId: user.PK.replace('USER#', ''),
      email: user.email,
      fullName: user.fullName,
      isAdmin: user.isAdmin
    };
    
    const tokens = await tokenService.generateTokens(userForToken, clientInfo);
    
    // レスポンス作成（パスワードを除く）
    const responseUser = {
      userId: userForToken.userId,
      email: user.email,
      fullName: user.fullName,
      address: user.address,
      phone: user.phone,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        user: responseUser,
        tokens
      })
    };
    
  } catch (error) {
    console.error('Login error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 'SERVER_ERROR',
        message: 'ログイン処理中にエラーが発生しました。'
      })
    };
  }
};

/**
 * メールアドレスからユーザーを検索
 */
async function findUserByEmail(email) {
  const params = {
    TableName: USERS_TABLE,
    IndexName: 'EmailIndex',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: {
      ':email': email
    }
  };
  
  const result = await dynamoDB.query(params).promise();
  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}
