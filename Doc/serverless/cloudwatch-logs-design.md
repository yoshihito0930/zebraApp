# CloudWatch Logs設計

## 1. はじめに

本ドキュメントでは、撮影スタジオ予約管理アプリケーションのCloudWatch Logsに関する設計を定義します。サーバレスアプリケーションでは、適切なログ戦略が運用と障害分析において極めて重要です。

### 1.1 目的

CloudWatch Logs設計の主な目的は以下の通りです：

1. **観測可能性の確保**: アプリケーションの動作の可視化と監視
2. **問題の迅速な特定**: エラーや異常の素早い検出と原因特定
3. **パフォーマンス分析**: システムのボトルネックや最適化ポイントの発見
4. **セキュリティ監視**: 不正アクセスや異常な活動の検出
5. **ビジネスインサイトの獲得**: ユーザー行動と利用パターンの分析
6. **コスト最適化**: ログ生成と保存の効率化

### 1.2 スコープ

本ログ設計は以下のコンポーネントを対象とします：

- すべてのLambda関数
- API Gateway
- DynamoDBストリーム
- EventBridgeスケジュールイベント
- Amazon SES通知
- カスタムメトリクス

## 2. ログレベルと使用方針

### 2.1 ログレベル定義

| レベル | 使用方針 | 例 |
|------|---------|-----|
| **ERROR** | システム障害やビジネスフロー中断を引き起こす重大な問題 | API呼び出し失敗、DynamoDB接続エラー、認証エラー |
| **WARN** | 直ちに対応が必要ではないが、注意を要する状況 | 再試行成功、パフォーマンス低下、使用量が閾値に近づいている |
| **INFO** | 通常の操作と主要なビジネスイベント | リクエスト開始/完了、予約作成、ユーザー登録 |
| **DEBUG** | トラブルシューティングに役立つ詳細情報（開発環境のみ） | 関数呼び出し、中間データ状態、処理ステップ |
| **TRACE** | 非常に詳細な診断情報（開発環境での特定問題解決時のみ） | 低レベル処理詳細、ループ内変数、HTTPヘッダー全内容 |

### 2.2 環境別ログレベル設定

| 環境 | デフォルトログレベル | 備考 |
|-----|-----------------|------|
| 開発 | DEBUG | 開発者の詳細なデバッグを支援 |
| テスト | INFO | テスト実行の基本的な流れを追跡 |
| ステージング | INFO | 本番と同じ設定で動作確認 |
| 本番 | INFO | 必要十分な情報を記録しつつコスト最適化 |

## 3. 構造化ログ形式

### 3.1 共通ログフィールド

すべてのログエントリに含める標準フィールド：

```json
{
  "timestamp": "2025-06-28T01:30:00.000Z",  // ISO 8601形式のUTC時間
  "level": "INFO",                          // ログレベル
  "service": "booking-service",             // サービス名
  "function": "createBookingHandler",       // 関数名
  "requestId": "c6af9ac6-7b61-11e6-9a41-...", // リクエストID
  "message": "予約リクエストを受信しました",      // 人間可読なメッセージ
  "userId": "user-123",                    // 認証されたユーザーID（該当する場合）
  "resourceType": "booking",               // 関連リソースタイプ（該当する場合）
  "resourceId": "booking-456",             // 関連リソースID（該当する場合）
  "duration": 45.2,                         // 処理時間（ミリ秒）
  "context": {}                             // コンテキスト固有の追加情報
}
```

### 3.2 コンテキスト別の追加フィールド

#### 3.2.1 APIリクエスト

```json
{
  "context": {
    "path": "/api/bookings",
    "method": "POST",
    "statusCode": 201,
    "clientIp": "192.168.1.1",
    "userAgent": "Mozilla/5.0 ...",
    "queryParams": {"date": "2025-07-01"},
    "responseTime": 120
  }
}
```

#### 3.2.2 DynamoDB操作

```json
{
  "context": {
    "operation": "PutItem",
    "table": "studio-booking-bookings",
    "itemCount": 1,
    "consumedCapacity": 1.5,
    "condition": "attribute_not_exists(PK)"
  }
}
```

#### 3.2.3 認証/認可

```json
{
  "context": {
    "authType": "JWT",
    "roles": ["user"],
    "requiredPermission": "booking:create",
    "authResult": "success"
  }
}
```

## 4. ログ実装パターン

### 4.1 Lambda関数でのログ実装

#### 4.1.1 Goでの実装例（zerolog使用）

```go
package main

import (
    "context"
    "os"
    "time"
    
    "github.com/aws/aws-lambda-go/events"
    "github.com/aws/aws-lambda-go/lambda"
    "github.com/aws/aws-lambda-go/lambdacontext"
    "github.com/rs/zerolog"
    "github.com/rs/zerolog/log"
)

func init() {
    // 環境変数からログレベルを設定
    logLevel := os.Getenv("LOG_LEVEL")
    level, err := zerolog.ParseLevel(logLevel)
    if err != nil {
        level = zerolog.InfoLevel // デフォルト
    }
    zerolog.SetGlobalLevel(level)
    
    // JSON形式ログの設定
    log.Logger = zerolog.New(os.Stdout).
        With().
        Timestamp().
        Str("service", "booking-service").
        Logger()
}

func handler(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
    start := time.Now()
    
    // リクエストIDの取得
    var requestID string
    if lc, ok := lambdacontext.FromContext(ctx); ok {
        requestID = lc.AwsRequestID
    }
    
    // リクエストログ
    logger := log.With().
        Str("function", "createBookingHandler").
        Str("requestId", requestID).
        Str("path", event.Path).
        Str("method", event.HTTPMethod).
        Interface("queryParams", event.QueryStringParameters).
        Logger()
    
    logger.Info().Msg("予約リクエストを受信しました")
    
    // ここに実際の処理コード
    
    // レスポンスログ
    duration := time.Since(start).Milliseconds()
    logger.Info().
        Int("statusCode", 201).
        Int64("duration", duration).
        Str("resourceId", "booking-456").
        Msg("予約が正常に作成されました")
    
    return events.APIGatewayProxyResponse{
        StatusCode: 201,
        Body:       `{"id": "booking-456"}`,
    }, nil
}

func main() {
    lambda.Start(handler)
}
```

#### 4.1.2 ログミドルウェアの活用

```go
func loggingMiddleware(next HandlerFunc) HandlerFunc {
    return func(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
        start := time.Now()
        
        // リクエストIDの取得
        var requestID string
        if lc, ok := lambdacontext.FromContext(ctx); ok {
            requestID = lc.AwsRequestID
        }
        
        // ユーザーIDの取得（認証済みの場合）
        userID := extractUserID(ctx)
        
        // リクエストログ
        logger := log.With().
            Str("requestId", requestID).
            Str("path", event.Path).
            Str("method", event.HTTPMethod)
            
        if userID != "" {
            logger = logger.Str("userId", userID)
        }
        
        logger.Info().Msg("リクエスト処理開始")
        
        // 次のハンドラーを呼び出し
        resp, err := next(ctx, event)
        
        // レスポンスログ
        duration := time.Since(start).Milliseconds()
        respLogger := logger.Int64("duration", duration)
        
        if err != nil {
            respLogger.Err(err).Msg("リクエスト処理エラー")
        } else {
            respLogger.Int("statusCode", resp.StatusCode).Msg("リクエスト処理完了")
        }
        
        return resp, err
    }
}
```

## 5. ログクエリとフィルタリングパターン

### 5.1 CloudWatch Logs Insightsク[ERROR] Failed to process response: The system encountered an unexpected error during processing. Try your request again.
