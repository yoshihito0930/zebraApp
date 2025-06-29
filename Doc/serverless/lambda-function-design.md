# Lambda関数の分割方針

## 1. はじめに

本ドキュメントでは、撮影スタジオ予約管理アプリケーションのLambda関数分割方針を定義します。適切な関数分割はサーバレスアプリケーションの保守性、スケーラビリティ、柔軟性を大きく向上させます。

### 1.1 目的

Lambda関数分割方針の主な目的は以下の通りです：

1. **保守性向上**: 関数の責務を明確化し、シンプルな実装を維持
2. **柔軟なスケーリング**: 異なるワークロードに対して最適なリソース配分を実現
3. **デプロイ効率化**: 変更の影響範囲を最小限に抑え、デプロイを高速化
4. **コスト最適化**: 実行頻度や処理内容に基づくリソース割り当て
5. **開発効率**: チーム間の並行開発とテストの容易さを確保

### 1.2 スコープ

本方針は以下のLambda関数カテゴリを対象とします：

- API Gateway統合関数
- DynamoDBストリーム処理関数
- EventBridgeスケジュールイベント処理関数
- SQS/SNSメッセージ処理関数
- 共通ライブラリとレイヤー

## 2. 分割の基本原則

### 2.1 単一責任の原則

各Lambda関数は単一の責任を持つべきです：

- **良い例**: `createBooking`, `getBookingDetails`, `cancelBooking`
- **悪い例**: `manageBookings` (複数の操作を1つの関数に詰め込む)

### 2.2 ビジネスドメインによる分割

関数はビジネスドメインとアクション/操作に基づいて命名・分割します：

```
<service>-<resource>-<action>
```

例：
- `booking-reservation-create`
- `booking-reservation-cancel`
- `user-profile-update`
- `notification-email-send`

### 2.3 トランザクション境界の考慮

1つのビジネストランザクションが複数のリソース更新を含む場合は、整合性を確保するために1つの関数内で処理します：

- **例**: 予約作成時に、Bookingsテーブル更新 + Calendarテーブル更新 + 通知送信準備を1つの関数で処理

### 2.4 実行コンテキストの分離

異なる実行パターン・トリガーは別々の関数に分離します：

- **同期呼び出し**: API Gateway経由のユーザーリクエスト
- **非同期処理**: イベント駆動処理、バッチ処理
- **スケジュール実行**: 定期的なメンテナンス処理

## 3. 関数分割パターン

### 3.1 API Gateway統合パターン

API Gateway用のLambda関数は、RESTfulなエンドポイント設計に沿って分割します：

#### 3.1.1 リソースごとの単一メソッド関数

各リソース×HTTPメソッドの組み合わせに対して個別の関数を作成：

```
GET /bookings       → booking-list-get
POST /bookings      → booking-create
GET /bookings/{id}  → booking-get
PUT /bookings/{id}  → booking-update
DELETE /bookings/{id} → booking-delete
```

**利点**:
- 個別スケーリングと監視が可能
- 関数ごとのエラー分離
- 最小限のIAM権限設定

**コード例 (booking-create)**:
```go
package main

import (
    "context"
    "encoding/json"
    
    "github.com/aws/aws-lambda-go/events"
    "github.com/aws/aws-lambda-go/lambda"
)

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
    var bookingRequest CreateBookingRequest
    if err := json.Unmarshal([]byte(request.Body), &bookingRequest); err != nil {
        return createErrorResponse(400, "Invalid request body"), nil
    }
    
    // 入力バリデーション
    if err := validateBookingRequest(bookingRequest); err != nil {
        return createErrorResponse(400, err.Error()), nil
    }
    
    // 予約作成ビジネスロジック
    booking, err := bookingService.CreateBooking(ctx, bookingRequest)
    if err != nil {
        return handleServiceError(err), nil
    }
    
    // レスポンス返却
    responseBody, _ := json.Marshal(booking)
    return events.APIGatewayProxyResponse{
        StatusCode: 201,
        Headers: map[string]string{
            "Content-Type": "application/json",
        },
        Body: string(responseBody),
    }, nil
}

func main() {
    lambda.Start(handler)
}
```

#### 3.1.2 パスベース分割方針

URL構造に基づいて関数を分割する代替アプローチ：

```
/bookings/**         → booking-api
/users/**            → user-api
/notifications/**    → notification-api
```

**利点**:
- デプロイ数の削減
- コールドスタート発生回数の削減
- 関連機能のグループ化

**使用例**:
- 更新頻度の低いAPI
- トラフィックが少ないエンドポイント
- 密接に関連した複数の操作

### 3.2 イベント処理パターン

#### 3.2.1 DynamoDBストリーム処理

DynamoDBストリームイベントを処理する関数は、テーブルとイベントタイプに基づいて分割：

```
bookings-stream-processor
users-stream-processor
```

**コード例**:
```go
func handler(ctx context.Context, event events.DynamoDBEvent) error {
    for _, record := range event.Records {
        // イベントタイプによる処理分岐
        switch record.EventName {
        case "INSERT":
            handleInsert(ctx, record)
        case "MODIFY":
            handleModify(ctx, record)
        case "REMOVE":
            handleRemove(ctx, record)
        }
    }
    return nil
}
```

#### 3.2.2 スケジュールイベント処理

EventBridgeスケジュールで実行される関数：

```
booking-temporary-cleanup       // 仮予約の自動キャンセル
booking-reminder-sender         // リマインダー通知送信
report-daily-generator          // 日次レポート生成
```

**スケジュール処理の原則**:
- 1つのスケジュールタスクに1つの関数
- タイムアウト設定を適切に (長時間実行タスク用)
- 冪等性の確保 (再実行しても安全な実装)

### 3.3 メッセージキュー処理パターン

SQS/SNSを使用した非同期処理パターン：

```
notification-email-processor    // メール通知処理
booking-confirmation-processor  // 予約確認処理
```

**メッセージ処理の原則**:
- バッチサイズの最適化 (10〜100メッセージ)
- 部分的バッチ処理の許容 (一部失敗時も他は処理)
- デッドレターキューの設定

## 4. コード共有と再利用

### 4.1 Lambda Layers

共通コードはLambda Layersとして分離：

```
common-utils-layer        // 汎用ユーティリティ
dynamodb-access-layer     // DynamoDBアクセス共通コード
auth-validation-layer     // 認証・認可処理
validation-layer          // 入力バリデーション
```

**Layerの利点**:
- コードの重複排除
- バージョン管理と共有の簡素化
- デプロイパッケージサイズの削減

### 4.2 共通コードパターン

関数間で共有すべきロジックの例：

1. **リポジトリ層**: データアクセスコード
2. **サービス層**: ビジネスロジック
3. **バリデーション**: 入力検証
4. **エラーハンドリング**: 標準化されたエラー処理
5. **認証/認可**: トークン検証、権限チェック

## 5. パフォーマンス最適化

### 5.1 コールドスタート対策

#### 5.1.1 関数サイズ最適化

- 依存関係を最小限に保つ
- 使用しないライブラリを削除
- 条件付きインポートの活用

#### 5.1.2 メモリ設定の最適化

| 処理内容 | 推奨メモリ | 理由 |
|--------|----------|------|
| シンプルなAPI | 128-256MB | 低コスト重視 |
| 標準API処理 | 512-1024MB | バランス重視 |
| 画像処理/データ集計 | 1024-2048MB | CPU能力重視 |
| ML/複雑な計算 | 2048MB以上 | 処理速度重視 |

#### 5.1.3 Provisioned Concurrency

以下の関数にはProvisioned Concurrencyの設定を検討：

- ユーザー体験に直結する重要なAPI
- 予約作成などの重要なビジネストランザクション
- コールドスタート許容度の低いAPI

### 5.2 実行時間最適化

1. **非同期処理の活用**:
   - 長時間処理はSQS/ステップ関数に分割
   - バックグラウンド処理で結果通知

2. **データアクセス最適化**:
   - バッチ操作の活用
   - 必要なデータのみ取得
   - インデックス設計の最適化

## 6. 実際の関数分割例

### 6.1 認証/アカウント管理

```
auth-register              // ユーザー登録
auth-login                 // ログイン処理
auth-refresh-token         // トークンリフレッシュ
auth-password-reset        // パスワードリセット
```

### 6.2 予約管理

```
booking-create             // 予約作成
booking-get                // 予約詳細取得
booking-update             // 予約更新
booking-cancel             // 予約キャンセル
booking-list               // 予約一覧取得
booking-confirm            // 予約確定（仮予約→本予約）
booking-approve            // 予約承認（管理者用）
booking-reject             // 予約拒否（管理者用）
```

### 6.3 カレンダー管理

```
calendar-slots-get         // 空き枠取得
calendar-month-view        // 月間カレンダー表示データ取得
calendar-week-view         // 週間カレンダー表示データ取得
calendar-day-view          // 日間カレンダー表示データ取得
```

### 6.4 通知

```
notification-list          // 通知一覧取得
notification-mark-read     // 通知既読設定
notification-preferences   // 通知設定管理
```

### 6.5 バックグラウンド処理

```
booking-expiry-checker     // 仮予約期限チェック
reminder-sender            // リマインダー通知送信
notification-dispatcher    // 通知配信処理
report-generator           // レポート生成
```

## 7. デプロイ戦略

### 7.1 関数グループ化

関連する関数をスタックでグループ化：

```yaml
# serverless.yml または SAM template
Resources:
  # 認証関連関数グループ
  AuthStack:
    Type: AWS::Serverless::Application
    Properties:
      Location: ./auth/template.yaml
      
  # 予約関連関数グループ
  BookingStack:
    Type: AWS::Serverless::Application
    Properties:
      Location: ./booking/template.yaml
```

### 7.2 環境変数管理

機能グループごとに共通の環境変数を定義：

```yaml
Globals:
  Function:
    Environment:
      Variables:
        DYNAMODB_TABLE_BOOKINGS: !Ref BookingsTable
        DYNAMODB_TABLE_USERS: !Ref UsersTable
        SQS_NOTIFICATION_QUEUE: !Ref NotificationQueue
        LOG_LEVEL: INFO
```

### 7.3 タグ付け

各Lambda関数に一貫したタグを設定：

```yaml
Tags:
  Service: studio-booking
  Feature: booking-management
  Environment: production
  Owner: booking-team
```

## 8. モニタリングと運用

### 8.1 関数別メトリクス監視

各関数で監視すべき主要メトリクス：

- **Invocations**: 呼び出し回数
- **Duration**: 実行時間
- **Errors**: エラー数
- **Throttles**: スロットリング発生数
- **ConcurrentExecutions**: 同時実行数

### 8.2 アラート設定

関数グループごとにアラート設定：

- **エラー率**：5分間で5%以上のエラー発生時
- **レイテンシ**：p95レイテンシが閾値を超えた場合
- **スロットリング**：スロットリング発生時
- **高並行実行数**：同時実行数が上限の80%到達時

## 9. 最適な分割の判断基準

関数を分割すべきサインと結合すべきサイン：

### 9.1 関数分割のサイン

- 異なるトリガーによる実行
- 異なるリソースアクセス権限が必要
- 実行時間や頻度が大きく異なる
- 異なるチームによる開発・保守

### 9.2 関数結合のサイン

- 常に一緒に呼び出される関数
- 共通のデータ構造や状態に強く依存
- 分割によるオーバーヘッドが大きい
- 全体のフローが複雑化する場合

## 10. 将来の拡張性考慮

拡張性を考慮した設計のためのガイドライン：

1. **段階的な詳細度**: 初期は大きめの関数で、必要に応じて分割
2. **イベント駆動アーキテクチャ**: 疎結合設計で将来の変更に対応
3. **設定駆動**: 環境変数やパラメータ化で柔軟性を確保
4. **ドキュメント化**: 各関数の責務と関連性を明確に記録

以上のLambda関数分割方針に従うことで、保守性が高く、スケーラブルで効率的なサーバレスアプリケーションを実現できます。
