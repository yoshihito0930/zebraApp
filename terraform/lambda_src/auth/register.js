const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const tokenService = require('./lib/tokenService');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = process.env.USERS_TABLE || 'studio-booking-users';
const SALT_ROUNDS = 12;

/**
 * ユーザー登録Lambda関数
 */
exports.handler = async (event) => {
  try {
    console.log('Register event received:', JSON.stringify(event, null, 2));
    
    // リクエストボディの解析
    const requestBody = JSON.parse(event.body);
    const { email, password, fullName, address, phone } = requestBody;
    
    // 入力検証
    if (!email || !password || !fullName) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          code: 'INVALID_PARAMETERS',
          message: 'メールアドレス、パスワード、氏名は必須です。' 
        })
      };
    }
    
    // メールアドレスの重複チェック
    const existingUser = await checkExistingUser(email);
    if (existingUser) {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          code: 'EMAIL_EXISTS',
          message: 'このメールアドレスは既に登録されています。' 
        })
      };
    }
    
    // パスワードハッシュ化
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    // ユーザーID生成
    const userId = uuidv4();
    
    // 現在時刻
    const now = new Date().toISOString();
    
    // ユーザーデータ作成
    const userData = {
      PK: `USER#${userId}`,
      email,
      hashedPassword,
      fullName,
      address: address || '',
      phone: phone || '',
      isAdmin: false,
      totalUsageMinutes: 0,
      bookingCount: 0,
      createdAt: now,
      updatedAt: now
    };
    
    // DynamoDBに保存
    await dynamoDB.put({
      TableName: USERS_TABLE,
      Item: userData
    }).promise();
    
    // JWTトークン生成
    const tokens = await tokenService.generateTokens({
      userId,
      email,
      fullName,
      isAdmin: false
    });
    
    // レスポンス作成（パスワードを除く）
    const responseUser = {
      userId,
      email,
      fullName,
      address: userData.address,
      phone: userData.phone,
      isAdmin: userData.isAdmin,
      createdAt: userData.createdAt
    };
    
    return {
      statusCode: 201,
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
    console.error('Registration error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 'SERVER_ERROR',
        message: 'ユーザー登録中にエラーが発生しました。'
      })
    };
  }
};

/**
 * メールアドレスの重複チェック
 */
async function checkExistingUser(email) {
  const params = {
    TableName: USERS_TABLE,
    IndexName: 'EmailIndex',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: {
      ':email': email
    }
  };
  
  const result = await dynamoDB.query(params).promise();
  return result.Items && result.Items.length > 0;
}
