const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const REFRESH_TOKENS_TABLE = process.env.REFRESH_TOKENS_TABLE || 'studio-booking-refresh-tokens';

// 本番環境では、これらの設定はSecretsManagerなどから取得すべき
const ACCESS_TOKEN_TTL = parseInt(process.env.ACCESS_TOKEN_TTL || 3600); // 1時間
const REFRESH_TOKEN_TTL = parseInt(process.env.REFRESH_TOKEN_TTL || 2592000); // 30日
const TOKEN_ISSUER = process.env.TOKEN_ISSUER || 'api.studio-booking.example.com';

// AWS KMSからキーを取得するコードは本番実装で追加する
// ここでは開発用のダミーキーを使用
const PRIVATE_KEY = process.env.JWT_PRIVATE_KEY || 'development-private-key';
const PUBLIC_KEY = process.env.JWT_PUBLIC_KEY || 'development-public-key';

/**
 * アクセストークンの生成
 */
async function generateAccessToken(user) {
  const now = Math.floor(Date.now() / 1000);
  
  const claims = {
    iss: TOKEN_ISSUER,
    sub: user.userId,
    email: user.email,
    name: user.fullName,
    isAdmin: user.isAdmin,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL,
    nbf: now - 2, // 2秒の猶予
    jti: uuidv4()
  };
  
  // 本番環境ではRS256アルゴリズムを使用
  // 開発環境ではHS256を使用
  const algorithm = process.env.NODE_ENV === 'production' ? 'RS256' : 'HS256';
  
  return jwt.sign(claims, PRIVATE_KEY, { algorithm });
}

/**
 * リフレッシュトークンの生成と保存
 */
async function generateRefreshToken(user, clientInfo) {
  try {
    const refreshToken = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL * 1000);
    
    // トークン情報の作成
    const tokenData = {
      tokenId: refreshToken,
      userId: user.userId,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isRevoked: false,
      clientInfo: clientInfo || {}
    };
    
    // DynamoDBに保存
    await dynamoDB.put({
      TableName: REFRESH_TOKENS_TABLE,
      Item: tokenData
    }).promise();
    
    return refreshToken;
  } catch (error) {
    console.error('リフレッシュトークン生成エラー:', error);
    throw error;
  }
}

/**
 * アクセストークンの検証
 */
async function validateAccessToken(tokenString) {
  try {
    // 本番環境ではRS256アルゴリズムでPUBLIC_KEYを使用
    // 開発環境ではHS256でPRIVATE_KEYを使用
    const algorithm = process.env.NODE_ENV === 'production' ? 'RS256' : 'HS256';
    const verifyKey = algorithm === 'RS256' ? PUBLIC_KEY : PRIVATE_KEY;
    
    const decoded = jwt.verify(tokenString, verifyKey, {
      algorithms: [algorithm],
      issuer: TOKEN_ISSUER
    });
    
    return {
      valid: true,
      decoded
    };
  } catch (error) {
    console.error('トークン検証エラー:', error);
    
    return {
      valid: false,
      error: error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    };
  }
}

/**
 * リフレッシュトークンの検証
 */
async function validateRefreshToken(tokenString) {
  try {
    // リフレッシュトークンをDynamoDBから検索
    const params = {
      TableName: REFRESH_TOKENS_TABLE,
      Key: {
        tokenId: tokenString
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    const token = result.Item;
    
    // トークンが存在しない、または無効化されている場合
    if (!token || token.isRevoked) {
      return {
        valid: false,
        error: 'INVALID_TOKEN'
      };
    }
    
    // 期限切れの場合
    const expiresAt = new Date(token.expiresAt);
    if (expiresAt < new Date()) {
      return {
        valid: false,
        error: 'TOKEN_EXPIRED'
      };
    }
    
    return {
      valid: true,
      userId: token.userId,
      tokenId: token.tokenId
    };
  } catch (error) {
    console.error('リフレッシュトークン検証エラー:', error);
    
    return {
      valid: false,
      error: 'SERVER_ERROR'
    };
  }
}

/**
 * リフレッシュトークンの無効化
 */
async function revokeRefreshToken(tokenId) {
  try {
    const params = {
      TableName: REFRESH_TOKENS_TABLE,
      Key: {
        tokenId
      },
      UpdateExpression: 'SET isRevoked = :revoked',
      ExpressionAttributeValues: {
        ':revoked': true
      },
      ReturnValues: 'UPDATED_NEW'
    };
    
    await dynamoDB.update(params).promise();
    return true;
  } catch (error) {
    console.error('リフレッシュトークン無効化エラー:', error);
    return false;
  }
}

/**
 * すべてのトークンを生成
 */
async function generateTokens(user, clientInfo) {
  const accessToken = await generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user, clientInfo);
  
  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  validateAccessToken,
  validateRefreshToken,
  revokeRefreshToken,
  generateTokens
};
