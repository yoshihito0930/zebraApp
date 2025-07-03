# 撮影スタジオ予約管理アプリケーション 基本設計書

## 1. システム概要

### 1.1 システムの目的
撮影スタジオの予約管理を効率化し、利用者と管理者の双方にとって使いやすいアプリケーションを提供する。予約の申請、承認、通知、統計といった一連の機能を実装することで、スタジオ運営の負担軽減と顧客サービス向上を図る。

### 1.2 システムの全体像
本システムは、Web アプリケーションとして実装される。利用者は予約申請、変更、キャンセルを行い、管理者は予約の承認、拒否、管理を行う。通知システムにより自動通知を行い、カレンダー機能により予約状況を可視化する。

## 2. システムアーキテクチャ

### 2.1 全体アーキテクチャ
- クライアント・サーバー型アーキテクチャ
- フロントエンドとバックエンドの分離（SPA + API）
- サーバレスアーキテクチャ（コスト効率と自動スケーリング）

### 2.2 コンポーネント構成

#### 2.2.1 フロントエンド
- SPA（Single Page Application）
- レスポンシブデザイン
- コンポーネントベース設計

#### 2.2.2 バックエンド
- RESTful API（API Gateway + Lambda）
- サーバレス関数モデル
  - 認証Lambda
  - 予約Lambda
  - カレンダーLambda
  - 通知Lambda
  - 管理Lambda
  - ユーザーLambda

#### 2.2.3 データ層
- DynamoDBによる非リレーショナルデータストア
- アクセスパターン最適化設計

#### 2.2.4 外部サービス連携
- SES（Eメールサービス）
- S3（クラウドストレージ）
- EventBridge（スケジュールタスク）
- 決済サービス（将来拡張）

## 3. 技術スタック

### 3.1 フロントエンド
- **言語**: TypeScript
- **フレームワーク**: React + Next.js
- **状態管理**: Redux Toolkit または Zustand
- **UI**: Tailwind CSS + Headless UI または MUI
- **カレンダー**: FullCalendar
- **フォーム**: React Hook Form + Zod
- **HTTP クライアント**: Axios

### 3.2 バックエンド
- **言語**: Golang
- **実行環境**: AWS Lambda
- **API管理**: API Gateway
- **ランタイム**: Lambda用Goランタイム
- **イベント処理**: EventBridge, SQS

### 3.3 データベース
- **主データベース**: DynamoDB
- **インデックス**: GSI, LSI

### 3.4 インフラ
- **コンピュート**: AWS Lambda
- **データベース**: DynamoDB
- **ストレージ**: S3
- **CDN**: CloudFront
- **CI/CD**: CodePipeline + CodeBuild
- **APIゲートウェイ**: Amazon API Gateway
- **イベント処理**: EventBridge, SQS, SNS

### 3.5 開発環境/ツール
- **バージョン管理**: Git + GitHub
- **ローカル開発**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **IaC**: Terraform または AWS SAM / Serverless Framework
- **モニタリング**: CloudWatch, X-Ray
- **API テスト**: Postman, Jest
- **E2E テスト**: Cypress

## 4. データモデル設計

### 4.1 DynamoDBテーブル設計概要
主要テーブル: Users、Bookings、Calendar、Notifications、TermsOfService、UserAgreements

### 4.2 データモデル詳細

#### 4.2.1 Users テーブル
- PK: `USER#<userId>` (String)
- 属性:
  - email: String (GSIでインデックス化)
  - hashedPassword: String
  - fullName: String
  - address: String
  - phone: String
  - totalUsageMinutes: Number
  - bookingCount: Number
  - isAdmin: Boolean
  - createdAt: String (ISO日時形式)
  - updatedAt: String (ISO日時形式)

#### 4.2.2 Bookings テーブル（キープシステム対応）
- PK: `BOOKING#<bookingId>` (String)
- SK: `USER#<userId>` (String)
- GSI1-PK: `USER#<userId>` (String)
- GSI1-SK: `BOOKING#<createdAt>` (String)
- GSI2-PK: `STATUS#<status>` (String)
- GSI2-SK: `<startTime>` (String)
- 属性:
  - startTime: String (ISO日時形式)
  - endTime: String (ISO日時形式)
  - status: String ('pending', 'approved', 'rejected', 'cancelled')
  - bookingType: String ('temporary', 'confirmed')
  - purpose: String
  - peopleCount: Number
  - keepOrder: Number (キープ順序: 1=第一予約, 2=第二キープ, 3=第三キープ)
  - isKeep: Boolean (キープ予約かどうか)
  - confirmationDeadline: String (ISO日時形式)
  - automaticCancellation: Boolean
  - cancellationFeePercent: Number
  - approvedBy: String (ユーザーID)
  - approvedAt: String (ISO日時形式)
  - options: List (オプション情報を非正規化)
    - [
      - { id: String, name: String, quantity: Number, price: Number },
      - ...
    ]
  - createdAt: String (ISO日時形式)
  - updatedAt: String (ISO日時形式)

#### 4.2.3 Calendar テーブル（キープシステム対応）
- PK: `DATE#<YYYY-MM-DD>` (String)
- SK: `TIME#<startTime>#<endTime>#<bookingId>` (String)
- 属性:
  - bookingId: String
  - userId: String
  - status: String
  - bookingType: String
  - keepOrder: Number (キープ順序)
  - isKeep: Boolean (キープ予約かどうか)

#### 4.2.4 Options テーブル
- PK: `OPTION#<optionId>` (String)
- 属性:
  - name: String
  - description: String
  - unitPrice: Number
  - unit: String
  - isActive: Boolean

#### 4.2.5 Notifications テーブル
- PK: `USER#<userId>` (String)
- SK: `NOTIFICATION#<timestamp>` (String)
- 属性:
  - title: String
  - content: String
  - type: String ('booking', 'reminder', 'system', 'admin')
  - isRead: Boolean
  - relatedEntityId: String
  - createdAt: String (ISO日時形式)
  - readAt: String (ISO日時形式)

#### 4.2.6 TermsOfService テーブル
- PK: `TERMS#<version>` (String)
- 属性:
  - content: String
  - version: Number
  - effectiveDate: String (ISO日時形式)

#### 4.2.7 UserAgreements テーブル
- PK: `USER#<userId>` (String)
- SK: `TERMS#<version>` (String)
- 属性:
  - agreedAt: String (ISO日時形式)

### 4.3 主要アクセスパターン

1. ユーザー情報取得: Users テーブルから GetItem (PK = USER#userId)
2. ユーザー予約一覧取得: Bookings テーブルの GSI1 から Query (PK = USER#userId)
3. 日付別予約取得: Calendar テーブルから Query (PK = DATE#YYYY-MM-DD)
4. 承認待ち予約一覧取得: Bookings テーブルの GSI2 から Query (PK = STATUS#pending)
5. ユーザー通知取得: Notifications テーブルから Query (PK = USER#userId)

## 5. API設計

### 5.1 API構成
RESTful APIとして以下のエンドポイントを実装する。各エンドポイントは対応するLambda関数にマッピングされる。

### 5.2 認証API
- POST /api/auth/register - ユーザー登録 (認証Lambda)
- POST /api/auth/login - ログイン (認証Lambda)
- POST /api/auth/logout - ログアウト (認証Lambda)
- POST /api/auth/refresh - トークン更新 (認証Lambda)
- POST /api/auth/password/reset - パスワードリセット (認証Lambda)

### 5.3 ユーザーAPI
- GET /api/users/me - 自分のプロフィール取得 (ユーザーLambda)
- PUT /api/users/me - 自分のプロフィール更新 (ユーザーLambda)
- GET /api/users/:id (管理者向け) - ユーザー情報取得 (ユーザーLambda)
- GET /api/users (管理者向け) - ユーザー一覧取得 (ユーザーLambda)

### 5.4 予約API（キープシステム対応）
- GET /api/bookings - 予約一覧取得 (予約Lambda)
- POST /api/bookings - 新規予約申請 (予約Lambda)
- GET /api/bookings/:id - 予約詳細取得 (予約Lambda)
- PUT /api/bookings/:id - 予約更新 (予約Lambda)
- DELETE /api/bookings/:id - 予約キャンセル (予約Lambda)
- GET /api/bookings/keep-status - キープ状況確認 (予約Lambda)
- POST /api/bookings/:id/confirm - 仮予約から本予約へ変更 (予約Lambda)
- POST /api/bookings/:id/approve (管理者向け) - 予約承認 (予約Lambda)
- POST /api/bookings/:id/reject (管理者向け) - 予約拒否 (予約Lambda)

### 5.5 カレンダーAPI
- GET /api/calendar - 予約カレンダーデータ取得 (カレンダーLambda)
- GET /api/calendar/available-slots - 空き枠取得 (カレンダーLambda)

### 5.6 オプションAPI
- GET /api/options - オプション一覧取得 (予約Lambda)
- GET /api/options/:id - オプション詳細取得 (予約Lambda)

### 5.7 通知API
- GET /api/notifications - 通知一覧取得 (通知Lambda)
- PUT /api/notifications/:id/read - 通知既読設定 (通知Lambda)
- POST /api/notifications (管理者向け) - 通知送信 (通知Lambda)

### 5.8 管理API (管理者向け)
- GET /api/admin/dashboard - ダッシュボードデータ取得 (管理Lambda)
- GET /api/admin/stats - 統計データ取得 (管理Lambda)
- GET /api/admin/bookings/pending - 承認待ち予約取得 (管理Lambda)

### 5.9 利用規約API
- GET /api/terms - 最新の利用規約取得 (ユーザーLambda)
- POST /api/terms/agree - 利用規約同意 (ユーザーLambda)
- POST /api/terms (管理者向け) - 利用規約更新 (管理Lambda)

## 6. 画面設計概要

### 6.1 共通レイアウト
- ヘッダー（ロゴ、ナビゲーション、ユーザーメニュー）
- フッター（著作権情報、リンク）
- サイドバー/ナビゲーションメニュー

### 6.2 画面一覧

#### 6.2.1 共通画面
- ログイン画面
- アカウント登録画面
- パスワードリセット画面
- プロフィール編集画面

#### 6.2.2 利用者向け画面
- ダッシュボード画面
- 予約カレンダー画面
- 予約申請フォーム画面
- 予約確認画面
- 予約詳細画面
- 予約履歴一覧画面
- 通知一覧画面

#### 6.2.3 管理者向け画面
- 管理者ダッシュボード画面
- 予約管理画面
- 承認待ち予約一覧画面
- ユーザー管理画面
- 統計レポート画面
- 利用規約管理画面
- 通知管理画面

## 7. 主要機能のフロー設計

### 7.1 予約申請フロー（キープシステム対応）
1. ユーザーがカレンダーから空き日時を選択
2. キープ状況確認API で予約可能性をチェック
3. 予約タイプ（仮予約/本予約）選択
4. 利用目的、人数、オプションを入力
5. 予約間隔ルール（1時間または30分）のバリデーション
6. 利用規約確認と同意
7. 予約申請送信 → 予約Lambda実行
8. キープ順序の決定（第一予約〜第三キープ）
9. DynamoDB更新（BookingsとCalendarテーブル）とSNS通知発行
10. 管理者へ通知（キープ情報含む）
11. 管理者が予約を承認/拒否 → 管理Lambda実行
12. 利用者へSNS通知（キープ順序情報含む）

### 7.2 仮予約から本予約への変更フロー
1. EventBridgeトリガーによる仮予約期限通知（10日前と8日前）
2. ユーザーが本予約への変更リクエスト → 予約Lambda実行
3. DynamoDB更新とSNS通知発行
4. 管理者へ通知
5. 本予約確定通知

### 7.3 予約キャンセルフロー（キープ繰り上がり対応）
1. ユーザーがキャンセルリクエスト → 予約Lambda実行
2. キャンセル料率計算処理
   - 仮予約: 0%
   - 本予約かつ利用6日前〜4日前: 50%
   - 本予約かつ利用3日前〜前日: 80%
   - 本予約かつ利用当日: 100%
3. ユーザーがキャンセル確定
4. キャンセルされた予約のキープ順序を確認
5. 後続のキープ予約を自動繰り上がり処理
6. DynamoDB一括更新（BookingsとCalendarテーブル）
7. 繰り上がり対象ユーザーへSNS通知発行
8. 管理者へキャンセル・繰り上がり通知

### 7.4 仮予約自動キャンセルフロー
1. EventBridgeによる定期実行（毎日）
2. Lambda関数起動
3. 確定期限（利用7日前18:00）を過ぎた仮予約を抽出
4. 該当予約をキャンセル処理
5. DynamoDB更新とSNS通知発行

### 7.5 キープシステム管理フロー
1. 同一時間帯の予約申請受付 → 予約Lambda実行
2. 既存予約のキープ状況確認（最大第三キープまで）
3. キープ順序の自動決定（先着順）
4. キープ情報を含む予約データ保存
5. キープ状況をユーザーに通知

### 7.6 業務ルール詳細
#### 予約時間制限
- 最小予約時間: 2時間
- 最大予約時間: 制限なし

#### キープシステム
- 同一時間帯で最大3件まで予約受付（第一予約、第二キープ、第三キープ）
- 先着順でキープ順序を決定
- 上位キープのキャンセル時は自動繰り上がり

#### 予約間隔
- デフォルト: 1時間間隔
- 最小: 30分間隔（設定可能）

#### キャンセルポリシー
- 本予約確定時点からキャンセル料発生
- 仮予約: キャンセル料なし

## 8. 非機能要件実現方針

### 8.1 パフォーマンス対策
- クライアント側キャッシュ
- DynamoDBの最適なプロビジョニング設定
- Lambda関数のサイズとメモリ最適化
- 画像最適化
- バンドルサイズ最適化
- DynamoDBインデックス最適化

### 8.2 セキュリティ対策
- HTTPS 通信
- JWTによる認証
- CSRF対策トークン
- 入力検証（バリデーション）
- パスワードハッシュ化
- API Gateway レート制限
- DynamoDB暗号化

### 8.3 可用性対策
- Lambdaの自動スケーリング
- DynamoDBのオンデマンドキャパシティ
- マルチAZ対応
- 定期バックアップ
- CloudWatchアラーム設定
- ヘルスチェック

### 8.4 保守性対策
- コーディング規約
- ドキュメント整備
- 自動テスト
- CI/CD パイプライン
- CloudWatch Logsによるログ管理・分析

## 9. インフラ構成とプロビジョニング

### 9.1 インフラ構成
本システムのインフラは、AWSのサーバレスサービスを中心に構築されます。主要なコンポーネントは以下の通りです。

- **API Gateway**: APIエンドポイント管理
- **Lambda**: ビジネスロジック実行
- **DynamoDB**: データ永続化
- **S3 + CloudFront**: フロントエンド配信
- **S3**: ファイル保存
- **SES**: メール送信
- **SNS/SQS**: 非同期処理、通知
- **EventBridge**: スケジュールタスク
- **CloudWatch**: モニタリング、ロギング
- **X-Ray**: 分散トレーシング
- **WAF**: セキュリティ対策

### 9.2 インフラプロビジョニング（IaC）
上記すべてのAWSリソースは、**IaC（Infrastructure as Code）** を用いてコードとして定義され、自動的にプロビジョニングされます。これにより、環境の再現性、一貫性、および変更管理の容易性を確保します。

- **採用ツール**: Terraform または AWS CloudFormation (SAM/Serverless Framework)
- **管理対象**: VPC、IAMロール、S3バケット、DynamoDBテーブル、Lambda関数、API Gatewayなど、すべてのAWSリソース。
- **ワークフロー**: Gitリポジトリでインフラ定義コードを管理し、CI/CDパイプラインを通じて各環境（開発、ステージング、本番）へ自動的に適用します。

### 9.2 開発環境・本番環境分離
- 開発環境 (Development)
- テスト環境 (Staging)
- 本番環境 (Production)

## 10. 開発スケジュール

### 10.1 フェーズ1: MVP (12週間)
- 週1-2: 環境構築、DynamoDBテーブル設計
- 週3-5: Lambda関数の基本API実装
- 週6-8: フロントエンド基本機能実装
- 週9-10: 認証・予約コア機能開発
- 週11-12: 通知システム・管理機能実装、テスト

### 10.2 フェーズ2: フィードバック対応・改善（6週間）
- 週1-2: MVPテストフィードバック収集
- 週3-4: UI/UX改善
- 週5-6: パフォーマンス最適化

### 10.3 フェーズ3: 拡張機能（8週間）
- 週1-4: 詳細レポート機能
- 週5-8: オンライン決済機能

## 11. リスクと対策

### 11.1 技術的リスク
- **リスク**: DynamoDBでの複雑なクエリ対応
- **対策**: アクセスパターンを考慮した慎重なデータモデリング

### 11.2 運用リスク
- **リスク**: Lambdaのコールドスタート遅延
- **対策**: Provisioned Concurrencyの活用、関数の軽量化

### 11.3 ユーザー受容性リスク
- **リスク**: 新システムへの移行抵抗
- **対策**: 簡潔なUI、十分なヘルプ機能、段階的導入

### 11.4 コスト管理リスク
- **リスク**: サーバレス環境でのコスト予測の難しさ
- **対策**: 詳細なモニタリング、使用量に基づく予算設定、定期的な最適化レビュー
