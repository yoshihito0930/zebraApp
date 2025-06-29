const tokenService = require('./lib/tokenService');

/**
 * ログアウトLambda関数
 */
exports.handler = async (event) => {
  try {
    console.log('Logout event received:', JSON.stringify(event, null, 2));
    
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
    
    // リフレッシュトークンの無効化
    await tokenService.revokeRefreshToken(refreshToken);
    
    return {
      statusCode: 204, // ボディなしで成功
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    };
    
  } catch (error) {
    console.error('Logout error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 'SERVER_ERROR',
        message: 'ログアウト処理中にエラーが発生しました。'
      })
    };
  }
};
