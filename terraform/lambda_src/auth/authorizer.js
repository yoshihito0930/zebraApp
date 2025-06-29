const tokenService = require('./lib/tokenService');

/**
 * Lambda Authorizer
 * API Gateway用のオーソライザー関数
 */
exports.handler = async (event) => {
  console.log('Authorizer event received:', JSON.stringify(event, null, 2));
  
  try {
    // トークンの取得
    const token = extractToken(event);
    if (!token) {
      console.log('トークンが見つかりません');
      return generatePolicy('user', 'Deny', event.methodArn);
    }
    
    // トークンの検証
    const validation = await tokenService.validateAccessToken(token);
    if (!validation.valid) {
      console.log(`トークン検証失敗: ${validation.error}`);
      return generatePolicy('user', 'Deny', event.methodArn);
    }
    
    const claims = validation.decoded;
    const userId = claims.sub;
    const isAdmin = claims.isAdmin || false;
    
    // 管理者権限のチェック（必要に応じて）
    if (checkForAdminEndpoint(event.methodArn) && !isAdmin) {
      console.log('管理者権限が必要なエンドポイントへの非管理者アクセスをブロック');
      return generatePolicy(userId, 'Deny', event.methodArn);
    }
    
    // アクセス許可
    const policy = generatePolicy(userId, 'Allow', event.methodArn);
    
    // コンテキストに追加情報を含める（API Gatewayから統合バックエンドに渡される）
    policy.context = {
      userId: userId,
      email: claims.email,
      name: claims.name,
      isAdmin: isAdmin ? 'true' : 'false'
    };
    
    return policy;
  } catch (error) {
    console.error('認証エラー:', error);
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

/**
 * イベントからトークンを抽出
 */
function extractToken(event) {
  // API Gateway Custom Authorizerの場合
  if (event.type === 'TOKEN') {
    const authHeader = event.authorizationToken;
    if (!authHeader) return null;
    
    const match = authHeader.match(/^Bearer (.*)$/);
    if (!match || match.length < 2) return null;
    
    return match[1];
  }
  
  // API Gateway RequestAuthorizerの場合
  if (event.type === 'REQUEST') {
    const headers = event.headers || {};
    const authHeader = headers.Authorization || headers.authorization;
    if (!authHeader) return null;
    
    const match = authHeader.match(/^Bearer (.*)$/);
    if (!match || match.length < 2) return null;
    
    return match[1];
  }
  
  return null;
}

/**
 * IAMポリシードキュメントの生成
 */
function generatePolicy(principalId, effect, resource) {
  const authResponse = {
    principalId: principalId
  };
  
  if (effect && resource) {
    const policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    };
    authResponse.policyDocument = policyDocument;
  }
  
  return authResponse;
}

/**
 * 管理者専用エンドポイントかどうかを判断
 */
function checkForAdminEndpoint(methodArn) {
  // methodArnの形式: arn:aws:execute-api:{regionId}:{accountId}:{apiId}/{stage}/{httpVerb}/{resource}/{child}
  // 例: arn:aws:execute-api:ap-northeast-1:123456789012:abcdef123/prod/GET/admin/users
  
  // /admin/ パスを含むエンドポイントは管理者専用とする
  return methodArn.includes('/admin/');
}
