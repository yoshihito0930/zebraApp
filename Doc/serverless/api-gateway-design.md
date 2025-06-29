# API Gateway設定設計

## 1. はじめに

本ドキュメントでは、撮影スタジオ予約管理アプリケーションのAmazon API Gateway設定設計について定義します。API Gatewayは、サーバレスアーキテクチャにおけるフロントエンドとLambda関数間の橋渡しとなる重要なコンポーネントです。

### 1.1 目的

API Gateway設計の主要な目的は以下の通りです：

1. **セキュアなAPI公開**: クライアントアプリケーションへの安全なAPIインターフェース提供
2. **トラフィック管理**: リクエスト制限と流量制御
3. **認証・認可**: リクエスト検証と権限管理
4. **柔軟なルーティング**: HTTPメソッドとリソースパスの適切なマッピング
5. **可用性向上**: サービス全体の安定性と応答性の確保
6. **開発効率**: API仕様とドキュメントの一元管理

### 1.2 スコープ

本設計は以下の要素を対象とします：

- API Gatewayエンドポイント設計
- リソースとメソッドの構成
- 認証と認可の仕組み
- リクエスト/レスポンス変換
- スロットリングとクォータ
- API キーとステージ管理
- カスタムドメイン設定
- ログとモニタリング

## 2. API設計ガイドライン

### 2.1 REST API設計原則

本アプリケーションでは、RESTful APIの原則に従ってAPIを設計します：

1. **リソース指向**: 主要なエンティティ（予約、ユーザー、通知など）をURIのリソースとして表現
2. **HTTP動詞の適切な使用**: GET/POST/PUT/DELETE等
3. **HATEOAS**: 適切な場合にAPIレスポンス内にリンク情報を含む
4. **ステートレス**: リクエスト間で状態を保持しない
5. **冪等性**: PUT/DELETEなどの操作は何度実行しても同じ結果になる

### 2.2 リソース命名規則

APIリソースの命名規則は以下に準拠します：

1. **複数形名詞**: リソースコレクション用（例: `/bookings`）
2. **ID付きパス**: 特定リソース用（例: `/bookings/{id}`）
3. **ネストリソース**: 親子関係が明確な場合（例: `/users/{id}/bookings`）
4. **動詞の使用**: 例外的な操作のみ（例: `/bookings/{id}/confirm`）

## 3. API Gateway構成

### 3.1 エンドポイントタイプ

**選定**: リージョナルエンドポイント

**理由**:
- 対象ユーザーが日本国内に限定されている
- レイテンシ最適化とコスト効率
- CloudFrontと組み合わせた場合の柔軟性

**将来の拡張性**:
- 国際展開時にはエッジ最適化エンドポイントへの変更を検討
- 複数リージョンへのデプロイとグローバルロードバランシング

### 3.2 ステージ設計

以下のステージを設定します：

| ステージ名 | 用途 | 特性 |
|----------|------|------|
| `dev` | 開発環境 | - 自動デプロイ<br>- キャッシング無効<br>- より詳細なロギング |
| `stage` | テスト・QA環境 | - 手動承認付きデプロイ<br>- 本番同等設定<br>- テスト用スロットリング |
| `prod` | 本番環境 | - 厳格なデプロイ管理<br>- キャッシング有効<br>- 本番向けスロットリング |

### 3.3 リソース階層

APIリソース階層は以下のように構成します：

```
/
├── auth
│   ├── register
│   ├── login
│   ├── refresh
│   ├── logout
│   └── password
│       └── reset
│
├── users
│   ├── me
│   └── {id}
│
├── bookings
│   ├── {id}
│   │   ├── confirm
│   │   ├── approve
│   │   └── reject
│   └── pending
│
├── calendar
│   ├── available-slots
│   ├── month
│   ├── week
│   └── day
│
├── options
│   └── {id}
│
└── notifications
    └── {id}
        └── read
```

## 4. 認証と認可

### 4.1 認証方式

以下の認証メカニズムを実装します：

1. **JWT認証**: API認証の主要手段
   - Lambda Authorizer（カスタムオーソライザー）による実装
   - JWTトークン検証と権限抽出
   - キャッシング設定（デフォルト: 5分間）

2. **API Key認証**: バックエンド間通信および管理用API向け
   - 管理ダッシュボード用API Key
   - 統計・分析バッチ処理用API Key

### 4.2 Lambda Authorizer実装

カスタムオーソライザーは以下の設定で実装します：

```yaml
AuthorizerLambda:
  Type: AWS::Serverless::Function
  Properties:
    Handler: src/auth/authorizer.handler
    Runtime: nodejs14.x
    Timeout: 5
    Policies:
      - AWSLambdaBasicExecutionRole
    Environment:
      Variables:
        JWT_PUBLIC_KEY: ${self:custom.jwtPublicKey}
```

**実装ポイント**:
- JWT検証とクレーム検証
- 効率的なポリシードキュメント生成
- エラーレスポンスの標準化

### 4.3 スコープベースの権限制御

APIパスごとに必要なスコープ（権限）を定義：

| API パス | HTTP メソッド | 必要スコープ | 説明 |
|---------|------------|------------|------|
| `/bookings` | GET | `booking:list` | 自身の予約一覧取得 |
| `/bookings` | POST | `booking:create` | 予約作成 |
| `/bookings/{id}` | GET | `booking:read` | 予約詳細取得 |
| `/bookings/{id}` | PUT | `booking:update` | 予約内容更新 |
| `/bookings/{id}` | DELETE | `booking:delete` | 予約キャンセル |
| `/bookings/pending` | GET | `booking:admin` | 承認待ち予約一覧（管理者用） |
| `/bookings/{id}/approve` | POST | `booking:admin` | 予約承認（管理者用） |

## 5. リクエスト/レスポンス処理

### 5.1 リクエストバリデーション

API Gatewayでのリクエスト検証：

1. **JSONスキーマ検証**:
   - 必須フィールドのチェック
   - データ型と形式の検証
   - Swagger/OpenAPIスキーマを活用

2. **URLパス・クエリパラメータ検証**:
   - パスパラメータの形式検証（UUIDなど）
   - クエリパラメータの許容範囲チェック

**実装例** (OpenAPI):
```yaml
/bookings:
  post:
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - startTime
              - endTime
              - bookingType
              - purpose
            properties:
              startTime:
                type: string
                format: date-time
              endTime:
                type: string
                format: date-time
              bookingType:
                type: string
                enum: [temporary, confirmed]
              purpose:
                type: string
                minLength: 1
                maxLength: 200
```

### 5.2 レスポンス統合

標準化されたレスポンス形式を採用します：

1. **成功レスポンス**:
   ```json
   {
     "data": {
       // リソース固有のデータ
     },
     "meta": {
       "pagination": {
         "total": 100,
         "page": 1,
         "limit": 20
       }
     }
   }
   ```

2. **エラーレスポンス**:
   ```json
   {
     "code": "ERROR_CODE",
     "message": "ユーザーに表示するエラーメッセージ",
     "requestId": "request-uuid",
     "details": {
       // エラー詳細情報（該当する場合）
     }
   }
   ```

### 5.3 JSONのマッピングテンプレート

Lambda統合用にマッピングテンプレートを定義：

**リクエストマッピング**:
```velocity
#set($inputRoot = $input.path('$'))

{
  "body" : $input.json('$'),
  "pathParameters": {
    #foreach($param in $input.params().path.keySet())
    "$param": "$util.escapeJavaScript($input.params().path.get($param))"
    #if($foreach.hasNext),#end
    #end
  },
  "queryStringParameters": {
    #foreach($param in $input.params().querystring.keySet())
    "$param": "$util.escapeJavaScript($input.params().querystring.get($param))"
    #if($foreach.hasNext),#end
    #end
  },
  "headers": {
    #foreach($param in $input.params().header.keySet())
    "$param": "$util.escapeJavaScript($input.params().header.get($param))"
    #if($foreach.hasNext),#end
    #end
  }
}
```

**レスポンスマッピング**:
```velocity
#set($inputRoot = $input.path('$'))

{
  "data": $input.json('$.body'),
  "meta": {
    #if($inputRoot.pagination)
    "pagination": $input.json('$.pagination')
    #end
  }
}
```

## 6. スロットリングとクォータ

### 6.1 レート制限設計

以下のレベルでレート制限を設定します：

1. **アカウントレベル制限**:
   - 開発環境: 50 RPS (リクエスト/秒)
   - 本番環境: 500 RPS

2. **APIキーごとの制限**:
   - 標準ユーザー: 10 RPS
   - 管理者: 20 RPS
   - バックエンドシステム: 50 RPS

3. **IPアドレスごとの制限**:
   - WAFと連携: 同一IPから30秒間に100リクエスト以上でブロック

### 6.2 使用量プラン

以下の使用量プランを定義します：

| プラン名 | 対象者 | リクエスト制限 | バースト制限 | クォータ |
|---------|-------|--------------|------------|---------|
| `basic` | 一般ユーザー | 10 RPS | 20 | 日間1,000リクエスト |
| `admin` | 管理者 | 20 RPS | 50 | 日間10,000リクエスト |
| `system` | システム間連携 | 50 RPS | 100 | 無制限 |

### 6.3 スロットリング対応

クライアント側では以下のスロットリング対応を実装：

1. **再試行メカニズム**:
   - 指数バックオフと適切なジッター
   - 最大再試行回数の設定

2. **レート制限ヘッダーの活用**:
   - `X-RateLimit-Limit`
   - `X-RateLimit-Remaining`
   - `X-RateLimit-Reset`

3. **ユーザー体験最適化**:
   - リクエスト間隔の調整
   - バッチ処理の活用

## 7. ログとモニタリング

### 7.1 アクセスログ設定

すべてのステージで以下のログ設定を有効化：

```yaml
AccessLogSettings:
  DestinationArn: !GetAtt ApiGatewayAccessLogGroup.Arn
  Format: >-
    {
      "requestId": "$context.requestId",
      "ip": "$context.identity.sourceIp",
      "requestTime": "$context.requestTime",
      "httpMethod": "$context.httpMethod",
      "path": "$context.path",
      "routeKey": "$context.routeKey",
      "status": "$context.status",
      "protocol": "$context.protocol",
      "responseLength": "$context.responseLength",
      "responseLatency": "$context.responseLatency",
      "userAgent": "$context.identity.userAgent",
      "cognitoIdentityId": "$context.identity.cognitoIdentityId",
      "apiKey": "$context.identity.apiKey",
      "authorizer": {
        "principalId": "$context.authorizer.principalId",
        "claims": {
          "sub": "$context.authorizer.claims.sub",
          "email": "$context.authorizer.claims.email"
        }
      }
    }
```

### 7.2 詳細メトリクス

以下のAPI Gatewayメトリクスを監視：

1. **リクエストメトリクス**:
   - Count
   - Latency (p50, p90, p99)
   - 4XXError と 5XXError

2. **統合メトリクス**:
   - IntegrationLatency
   - CacheHitCount と CacheMissCount

3. **カスタムメトリクス**:
   - リソース別のリクエスト数
   - HTTP ステータスコード別のカウント
   - ビジネストランザクション成功率

### 7.3 CloudWatch Dashboards

専用ダッシュボードを作成し、主要なメトリクスを可視化：

1. **APIヘルスダッシュボード**:
   - 全体的なリクエスト量とレイテンシ
   - エラー率と種類
   - スロットリングイベント

2. **運用ダッシュボード**:
   - エンドポイント別の利用状況
   - 時間帯別のトラフィックパターン
   - クライアントIP分布

## 8. API Gatewayのパフォーマンス最適化

### 8.1 キャッシュ戦略

本番環境では以下のキャッシュ設定を適用：

1. **キャッシュ有効化**:
   - キャッシュサイズ: 0.5GB
   - TTL: 300秒（デフォルト）

2. **キャッシュキー設計**:
   - パラメータベース: リクエストパラメータでキャッシュキー生成
   - ヘッダーベース: 特定のヘッダー値を含む

3. **条件付きキャッシュ**:
   - GETメソッドのみキャッシュ
   - 認証済みリクエストはキャッシュしない

### 8.2 レスポンス圧縮

圧縮を有効化して帯域幅を節約：

```yaml
MinimumCompressionSize: 1024  # 1KB以上のレスポンスを圧縮
```

### 8.3 バイナリサポート

メディアコンテンツ配信用のバイナリメディアタイプをサポート：

```yaml
BinaryMediaTypes:
  - 'image/jpeg'
  - 'image/png'
  - 'application/pdf'
  - 'application/octet-stream'
```

## 9. デプロイ戦略

### 9.1 継続的デプロイメント

CI/CDパイプラインと連携したデプロイ戦略：

1. **ステージごとのパイプライン**:
   - 開発: コミット時に自動デプロイ
   - ステージング: PRマージ時にデプロイ
   - 本番: 手動承認後にデプロイ

2. **CanaryリリースとBlue/Greenデプロイメント**:
   - 本番環境へのデプロイ時はCanaryを採用
   - トラフィックの10%を新バージョンに段階的に移行

3. **ロールバック戦略**:
   - 自動検出: エラー率が閾値を超えた場合
   - 手動トリガー: 管理者による判断

### 9.2 APIバージョニング

APIの互換性維持のためのバージョン管理戦略：

1. **URIベースバージョニング**:
   ```
   https://api.example.com/v1/bookings
   https://api.example.com/v2/bookings
   ```

2. **変更管理ポリシー**:
   - メジャーバージョン (v1, v2): 互換性を破る変更
   - マイナーバージョン: 後方互換性のある変更

3. **サンセットポリシー**:
   - 古いバージョンの廃止通知: 最低6ヶ月前
   - Deprecationヘッダーでの警告

## 10. カスタムドメインとTLS設定

### 10.1 カスタムドメイン

プロダクション用のカスタムドメインを設定：

```yaml
DomainName: api.studio-booking.example.com
CertificateArn: !Ref ApiCertificate
EndpointConfiguration:
  Types:
    - REGIONAL
```

### 10.2 TLS設定

セキュアな通信のためのTLS設定：

1. **最小TLSバージョン**: TLS 1.2
2. **推奨暗号スイート**: 強力な暗号化のみ許可
3. **HTTP→HTTPS自動リダイレクト**

### 10.3 CORS設定

クロスオリジンリクエストへの対応：

```yaml
Cors:
  AllowMethods: "'GET,POST,PUT,DELETE,OPTIONS'"
  AllowHeaders: "'Content-Type,Authorization,X-Amz-Date,X-Api-Key'"
  AllowOrigin: "'https://studio-booking.example.com'"
  MaxAge: "'600'"
  AllowCredentials: true
```

## 11. 将来の拡張性

### 11.1 WebSocketサポート

将来的なリアルタイム機能のためのWebSocket API設計：

1. **ユースケース**:
   - リアルタイム通知
   - 予約状況の即時更新
   - 管理者ダッシュボード

2. **ルート設計**:
   - `$connect`: 接続確立
   - `$disconnect`: 接続終了
   - `notify`: 通知送信
   - `status-update`: 状態更新

### 11.2 REST API から HTTP API への移行計画

コスト最適化とパフォーマンス向上のためのHTTP API検討：

1. **移行基準**:
   - 使用頻度の高いエンドポイント
   - カスタム認可が不要なパス

2. **段階的移行**:
   - 新機能はHTTP APIで実装
   - 既存機能は使用頻度と複雑さに応じて順次移行

以上のAPI Gateway設計に基づくことで、スケーラブルで安全、かつパフォーマンスの高いAPIインフラストラクチャを構築できます。
