const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES({ region: process.env.AWS_REGION || 'ap-northeast-1' });

const USERS_TABLE = process.env.USERS_TABLE || 'studio-booking-users';
const PASSWORD_RESET_TABLE = process.env.PASSWORD_RESET_TABLE || 'studio-booking-password-reset';
const SALT_ROUNDS = 12;
const RESET_TOKEN_TTL = 24 * 60 * 60 * 1000; // 24時間（ミリ秒）
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@studio-booking.example.com';
const BASE_URL = process.env.BASE_URL || 'https://studio-booking.example.com';

/**
 * パスワードリセットLambda関数
 * 3つの機能を持つ：
 * 1. リセットリクエスト処理（トークン生成・メール送信）
 * 2. トークン検証
 * 3. パスワード更新
 */
exports.handler = async (event) => {
  try {
    console.log('Password reset event received:', JSON.stringify(event, null, 2));
    
    // リクエストボディの解析
    const requestBody = JSON.parse(event.body);
    const action = requestBody.action;
    
    switch (action) {
      case 'request':
        return await handleResetRequest(requestBody);
      case 'verify':
        return await handleTokenVerification(requestBody);
      case 'reset':
        return await handlePasswordUpdate(requestBody);
      default:
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            code: 'INVALID_ACTION',
            message: '無効なアクションです。' 
          })
        };
    }
    
  } catch (error) {
    console.error('Password reset error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 'SERVER_ERROR',
        message: 'パスワードリセット処理中にエラーが発生しました。'
      })
    };
  }
};

/**
 * パスワードリセットリクエスト処理
 */
async function handleResetRequest(requestBody) {
  const { email } = requestBody;
  
  // 入力検証
  if (!email) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        code: 'INVALID_PARAMETERS',
        message: 'メールアドレスは必須です。' 
      })
    };
  }
  
  // ユーザーの検索
  const user = await findUserByEmail(email);
  
  // ユーザーが見つからない場合でもセキュリティのために成功を返す
  if (!user) {
    console.log(`ユーザーが見つかりません: ${email}`);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        message: 'パスワードリセット手順をメールで送信しました。' 
      })
    };
  }
  
  // リセットトークンの生成
  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + RESET_TOKEN_TTL).toISOString();
  const userId = user.PK.replace('USER#', '');
  
  // トークンをDBに保存
  await saveResetToken(userId, resetToken, tokenExpiry);
  
  // メール送信
  await sendResetEmail(email, user.fullName, resetToken, userId);
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ 
      message: 'パスワードリセット手順をメールで送信しました。' 
    })
  };
}

/**
 * リセットトークン検証
 */
async function handleTokenVerification(requestBody) {
  const { token, userId } = requestBody;
  
  // 入力検証
  if (!token || !userId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        code: 'INVALID_PARAMETERS',
        message: 'トークンとユーザーIDは必須です。' 
      })
    };
  }
  
  // トークン検証
  const isValid = await verifyResetToken(userId, token);
  
  if (!isValid) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        code: 'INVALID_TOKEN',
        message: '無効または期限切れのリセットトークンです。' 
      })
    };
  }
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ 
      valid: true
    })
  };
}

/**
 * パスワード更新処理
 */
async function handlePasswordUpdate(requestBody) {
  const { token, userId, newPassword } = requestBody;
  
  // 入力検証
  if (!token || !userId || !newPassword) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        code: 'INVALID_PARAMETERS',
        message: 'トークン、ユーザーID、新しいパスワードは必須です。' 
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
  
  // トークン検証
  const isValid = await verifyResetToken(userId, token);
  
  if (!isValid) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        code: 'INVALID_TOKEN',
        message: '無効または期限切れのリセットトークンです。' 
      })
    };
  }
  
  // パスワードハッシュ化
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  // ユーザーパスワード更新
  await updateUserPassword(userId, hashedPassword);
  
  // リセットトークン削除
  await deleteResetToken(userId);
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ 
      message: 'パスワードが正常に更新されました。' 
    })
  };
}

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

/**
 * リセットトークンをDBに保存
 */
async function saveResetToken(userId, token, expiry) {
  const params = {
    TableName: PASSWORD_RESET_TABLE,
    Item: {
      userId,
      token,
      expiry,
      createdAt: new Date().toISOString()
    }
  };
  
  await dynamoDB.put(params).promise();
}

/**
 * リセットメールを送信
 */
async function sendResetEmail(email, fullName, token, userId) {
  const resetLink = `${BASE_URL}/reset-password?token=${token}&userId=${userId}`;
  
  const params = {
    Source: FROM_EMAIL,
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Subject: {
        Data: '【スタジオ予約システム】パスワードリセットのご案内',
        Charset: 'UTF-8'
      },
      Body: {
        Text: {
          Data: `${fullName} 様

スタジオ予約システムのパスワードリセットのリクエストを受け付けました。

以下のリンクをクリックして、新しいパスワードを設定してください：
${resetLink}

このリンクは24時間有効です。

このリクエストに心当たりがない場合は、このメールを無視してください。

よろしくお願いいたします。
スタジオ予約システム管理チーム`,
          Charset: 'UTF-8'
        },
        Html: {
          Data: `<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .container { width: 600px; margin: 0 auto; }
    .button { display: inline-block; padding: 10px 20px; background-color: #82C2A9; color: white; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>パスワードリセットのご案内</h2>
    <p>${fullName} 様</p>
    <p>スタジオ予約システムのパスワードリセットのリクエストを受け付けました。</p>
    <p>以下のボタンをクリックして、新しいパスワードを設定してください：</p>
    <p><a href="${resetLink}" class="button">パスワードをリセット</a></p>
    <p>または、以下のURLをブラウザに貼り付けてください：<br>${resetLink}</p>
    <p>このリンクは24時間有効です。</p>
    <p>このリクエストに心当たりがない場合は、このメールを無視してください。</p>
    <p>よろしくお願いいたします。<br>スタジオ予約システム管理チーム</p>
  </div>
</body>
</html>`,
          Charset: 'UTF-8'
        }
      }
    }
  };
  
  await ses.sendEmail(params).promise();
}

/**
 * リセットトークンの検証
 */
async function verifyResetToken(userId, token) {
  const params = {
    TableName: PASSWORD_RESET_TABLE,
    Key: {
      userId
    }
  };
  
  const result = await dynamoDB.get(params).promise();
  const resetData = result.Item;
  
  if (!resetData || resetData.token !== token) {
    return false;
  }
  
  // 期限切れチェック
  const expiryTime = new Date(resetData.expiry).getTime();
  const now = Date.now();
  
  return now < expiryTime;
}

/**
 * ユーザーパスワード更新
 */
async function updateUserPassword(userId, hashedPassword) {
  const params = {
    TableName: USERS_TABLE,
    Key: {
      PK: `USER#${userId}`
    },
    UpdateExpression: 'SET hashedPassword = :password, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':password': hashedPassword,
      ':updatedAt': new Date().toISOString()
    }
  };
  
  await dynamoDB.update(params).promise();
}

/**
 * リセットトークン削除
 */
async function deleteResetToken(userId) {
  const params = {
    TableName: PASSWORD_RESET_TABLE,
    Key: {
      userId
    }
  };
  
  await dynamoDB.delete(params).promise();
}
