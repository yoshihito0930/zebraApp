# スタジオゼブラ 予約管理システム API設計書

## 1. API概要

このAPIは、スタジオゼブラ予約管理システムのバックエンドとフロントエンド間の通信を管理します。RESTfulな設計原則に従い、JSON形式でデータをやり取りします。

### 1.1 ベースURL
```
開発環境: https://api-dev.studiozebra.jp/v1
本番環境: https://api.studiozebra.jp/v1
```

### 1.2 認証方式
- JWT (JSON Web Token)ベースの認証
- アクセストークン（短期）とリフレッシュトークン（長期）の組み合わせ
- すべての認証済みエンドポイントには、リクエストヘッダーに`Authorization: Bearer {token}`が必要

### 1.3 レスポンス形式
すべてのAPIレスポンスは次の基本構造に従います：

```json
{
  "success": true,
  "data": {}, // リクエスト成功時のデータ
  "error": null, // エラー時のみ値が入る
  "meta": {
    "timestamp": "2025-06-13T14:00:00Z",
    "version": "1.0.0"
  }
}
```

エラー時のレスポンス例：
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "RESERVATION_CONFLICT",
    "message": "指定した時間帯は既に予約されています",
    "details": {
      "conflicting_time": "2025-07-01T10:00:00Z - 2025-07-01T12:00:00Z"
    }
  },
  "meta": {
    "timestamp": "2025-06-13T14:00:00Z",
    "version": "1.0.0"
  }
}
```

## 2. APIエンドポイント一覧

### 2.1 認証系API

#### 2.1.1 ユーザー登録
- **エンドポイント**: POST /auth/register
- **説明**: 新規ユーザーを登録する
- **リクエスト**:
  ```json
  {
    "email": "user@example.com",
    "password": "securePassword123",
    "firstName": "太郎",
    "lastName": "山田",
    "phoneNumber": "090-1234-5678"
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "verificationSent": true
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.1.2 メール確認
- **エンドポイント**: GET /auth/verify-email
- **説明**: ユーザー登録後のメール確認
- **クエリパラメータ**: token=xyz
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "verified": true
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.1.3 ログイン
- **エンドポイント**: POST /auth/login
- **説明**: ユーザーログイン
- **リクエスト**:
  ```json
  {
    "email": "user@example.com",
    "password": "securePassword123"
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
      "expiresIn": 3600,
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "user@example.com",
        "role": "user",
        "firstName": "太郎",
        "lastName": "山田"
      }
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.1.4 トークンリフレッシュ
- **エンドポイント**: POST /auth/refresh
- **説明**: アクセストークンを更新する
- **リクエスト**:
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
      "expiresIn": 3600
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.1.5 ログアウト
- **エンドポイント**: POST /auth/logout
- **説明**: ユーザーログアウト（リフレッシュトークンの無効化）
- **認証**: 必要
- **リクエスト**: なし
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "loggedOut": true
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.1.6 パスワードリセット要求
- **エンドポイント**: POST /auth/forgot-password
- **説明**: パスワードリセット用のメールを送信
- **リクエスト**:
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "resetEmailSent": true
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.1.7 パスワードリセット実行
- **エンドポイント**: POST /auth/reset-password
- **説明**: 新しいパスワードを設定
- **リクエスト**:
  ```json
  {
    "token": "reset-token-from-email",
    "newPassword": "newSecurePassword123"
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "passwordReset": true
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

### 2.2 ユーザープロフィール系API

#### 2.2.1 プロフィール取得
- **エンドポイント**: GET /users/profile
- **説明**: ログインユーザーのプロフィール情報を取得
- **認証**: 必要
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "太郎",
      "lastName": "山田",
      "phoneNumber": "090-1234-5678",
      "address": "東京都新宿区西新宿1-1-1",
      "companyName": "株式会社サンプル",
      "notificationPreference": "email"
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.2.2 プロフィール更新
- **エンドポイント**: PATCH /users/profile
- **説明**: ユーザープロフィールを更新
- **認証**: 必要
- **リクエスト**:
  ```json
  {
    "firstName": "太郎",
    "lastName": "山田",
    "phoneNumber": "090-1234-5678",
    "address": "東京都新宿区西新宿1-1-1",
    "companyName": "株式会社サンプル",
    "notificationPreference": "email"
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "updated": true,
      "profile": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "firstName": "太郎",
        "lastName": "山田",
        "phoneNumber": "090-1234-5678",
        "address": "東京都新宿区西新宿1-1-1",
        "companyName": "株式会社サンプル",
        "notificationPreference": "email"
      }
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.2.3 パスワード変更
- **エンドポイント**: POST /users/change-password
- **説明**: ログインユーザーのパスワードを変更
- **認証**: 必要
- **リクエスト**:
  ```json
  {
    "currentPassword": "currentSecurePassword123",
    "newPassword": "newSecurePassword456"
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "passwordChanged": true
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

### 2.3 予約系API

#### 2.3.1 空き状況取得
- **エンドポイント**: GET /reservations/availability
- **説明**: 指定期間の予約空き状況を取得
- **認証**: オプション（認証なしでも閲覧可能）
- **クエリパラメータ**:
  - startDate: 開始日（YYYY-MM-DD）
  - endDate: 終了日（YYYY-MM-DD）
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "availability": [
        {
          "date": "2025-07-01",
          "timeSlots": [
            {
              "start": "09:00",
              "end": "12:00",
              "available": true
            },
            {
              "start": "12:00",
              "end": "15:00",
              "available": false,
              "reservationType": "temporary"
            },
            {
              "start": "15:00",
              "end": "18:00",
              "available": false,
              "reservationType": "confirmed"
            },
            {
              "start": "18:00",
              "end": "21:00",
              "available": true
            }
          ]
        },
        // 他の日付も同様に
      ]
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.3.2 仮予約作成
- **エンドポイント**: POST /reservations/temporary
- **説明**: 仮予約を作成する
- **認証**: 必要
- **リクエスト**:
  ```json
  {
    "startTime": "2025-07-01T10:00:00+09:00",
    "endTime": "2025-07-01T12:00:00+09:00",
    "peopleCount": 5,
    "purpose": "ポートレート撮影",
    "specialRequests": "壁側に撮影機材を設置したい",
    "options": [
      {
        "optionId": "550e8400-e29b-41d4-a716-446655440001",
        "quantity": 1
      },
      {
        "optionId": "550e8400-e29b-41d4-a716-446655440002",
        "quantity": 2
      }
    ]
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "reservationId": "550e8400-e29b-41d4-a716-446655440010",
      "status": "temporary",
      "startTime": "2025-07-01T10:00:00+09:00",
      "endTime": "2025-07-01T12:00:00+09:00",
      "expiresAt": "2025-06-24T00:00:00+09:00",
      "totalPrice": 10000.00,
      "createdAt": "2025-06-13T14:00:00Z"
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.3.3 本予約作成
- **エンドポイント**: POST /reservations/confirmed
- **説明**: 本予約を作成する
- **認証**: 必要
- **リクエスト**:
  ```json
  {
    "startTime": "2025-07-01T10:00:00+09:00",
    "endTime": "2025-07-01T12:00:00+09:00",
    "peopleCount": 5,
    "purpose": "ポートレート撮影",
    "specialRequests": "壁側に撮影機材を設置したい",
    "options": [
      {
        "optionId": "550e8400-e29b-41d4-a716-446655440001",
        "quantity": 1
      },
      {
        "optionId": "550e8400-e29b-41d4-a716-446655440002",
        "quantity": 2
      }
    ],
    "termsAccepted": true
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "reservationId": "550e8400-e29b-41d4-a716-446655440011",
      "status": "pending_confirmation",
      "startTime": "2025-07-01T10:00:00+09:00",
      "endTime": "2025-07-01T12:00:00+09:00",
      "totalPrice": 10000.00,
      "createdAt": "2025-06-13T14:00:00Z"
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.3.4 予約一覧取得（ユーザー）
- **エンドポイント**: GET /reservations
- **説明**: ログインユーザーの予約一覧を取得
- **認証**: 必要
- **クエリパラメータ**:
  - status: 予約ステータスでフィルタリング（オプション）
  - page: ページ番号（デフォルト: 1）
  - limit: 1ページあたりのアイテム数（デフォルト: 10）
  - sort: 並び替え（例: "startTime:asc"）
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "reservations": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440010",
          "startTime": "2025-07-01T10:00:00+09:00",
          "endTime": "2025-07-01T12:00:00+09:00",
          "status": "temporary",
          "peopleCount": 5,
          "purpose": "ポートレート撮影",
          "totalPrice": 10000.00,
          "createdAt": "2025-06-13T14:00:00Z",
          "options": [
            {
              "name": "背景紙",
              "quantity": 1,
              "priceAtSelection": 1000.00
            },
            {
              "name": "LEDライト",
              "quantity": 2,
              "priceAtSelection": 2000.00
            }
          ]
        },
        // 他の予約も同様に
      ],
      "pagination": {
        "total": 25,
        "page": 1,
        "limit": 10,
        "totalPages": 3
      }
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.3.5 予約詳細取得
- **エンドポイント**: GET /reservations/{reservationId}
- **説明**: 特定の予約の詳細情報を取得
- **認証**: 必要（自分の予約のみアクセス可能）
- **パスパラメータ**: reservationId
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "startTime": "2025-07-01T10:00:00+09:00",
      "endTime": "2025-07-01T12:00:00+09:00",
      "status": "temporary",
      "peopleCount": 5,
      "purpose": "ポートレート撮影",
      "specialRequests": "壁側に撮影機材を設置したい",
      "totalPrice": 10000.00,
      "createdAt": "2025-06-13T14:00:00Z",
      "expiresAt": "2025-06-24T00:00:00+09:00",
      "options": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440001",
          "name": "背景紙",
          "quantity": 1,
          "priceAtSelection": 1000.00
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440002",
          "name": "LEDライト",
          "quantity": 2,
          "priceAtSelection": 2000.00
        }
      ]
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.3.6 予約変更リクエスト
- **エンドポイント**: POST /reservations/{reservationId}/change-request
- **説明**: 予約変更のリクエストを送信
- **認証**: 必要（自分の予約のみ変更可能）
- **パスパラメータ**: reservationId
- **リクエスト**:
  ```json
  {
    "startTime": "2025-07-01T13:00:00+09:00",
    "endTime": "2025-07-01T15:00:00+09:00",
    "peopleCount": 6,
    "purpose": "ポートレート撮影",
    "specialRequests": "壁側に撮影機材を設置したい",
    "options": [
      {
        "optionId": "550e8400-e29b-41d4-a716-446655440001",
        "quantity": 2
      }
    ],
    "changeReason": "撮影時間を延長したいため"
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "changeRequestId": "550e8400-e29b-41d4-a716-446655440020",
      "status": "pending_change",
      "originalReservation": {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "startTime": "2025-07-01T10:00:00+09:00",
        "endTime": "2025-07-01T12:00:00+09:00"
      },
      "requestedChanges": {
        "startTime": "2025-07-01T13:00:00+09:00",
        "endTime": "2025-07-01T15:00:00+09:00",
        "peopleCount": 6
      },
      "createdAt": "2025-06-13T14:00:00Z"
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.3.7 予約キャンセルリクエスト
- **エンドポイント**: POST /reservations/{reservationId}/cancel-request
- **説明**: 予約キャンセルのリクエストを送信
- **認証**: 必要（自分の予約のみ）
- **パスパラメータ**: reservationId
- **リクエスト**:
  ```json
  {
    "reason": "予定が変更になったため",
    "details": "仕事の都合で参加できなくなりました"
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "cancelRequestId": "550e8400-e29b-41d4-a716-446655440021",
      "status": "pending_cancel",
      "reservationId": "550e8400-e29b-41d4-a716-446655440010",
      "potentialCancellationFee": 5000.00,
      "createdAt": "2025-06-13T14:00:00Z"
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:00:00Z",
      "version": "1.0.0"
    }
  }
  ```

### 2.4 管理者系API

#### 2.4.1 全予約一覧取得（管理者用）
- **エンドポイント**: GET /admin/reservations
- **説明**: 全予約の一覧を取得
- **認証**: 必要（管理者のみ）
- **クエリパラメータ**:
  - status: 予約ステータスでフィルタリング
  - startDate: 開始日でフィルタリング
  - endDate: 終了日でフィルタリング
  - userId: 特定ユーザーの予約でフィルタリング
  - page: ページ番号（デフォルト: 1）
  - limit: 1ページあたりのアイテム数（デフォルト: 20）
  - sort: 並び替え
- **レスポンス**: ユーザー予約一覧と同様だが、管理情報を含む

#### 2.4.2 予約承認/拒否（管理者用）
- **エンドポイント**: POST /admin/reservations/{reservationId}/approve
- **説明**: 予約を承認または拒否
- **認証**: 必要（管理者のみ）
- **パスパラメータ**: reservationId
- **リクエスト**:
  ```json
  {
    "approved": true,
    "notes": "承認します。利用をお待ちしております",
    "notifyUser": true
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "reservationId": "550e8400-e29b-41d4-a716-446655440010",
      "status": "confirmed",
      "updatedAt": "2025-06-13T14:10:00Z",
      "notificationSent": true
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:10:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.4.3 予約変更リクエスト承認/拒否（管理者用）
- **エンドポイント**: POST /admin/change-requests/{requestId}/approve
- **説明**: 予約変更リクエストを承認または拒否
- **認証**: 必要（管理者のみ）
- **パスパラメータ**: requestId
- **リクエスト**:
  ```json
  {
    "approved": true,
    "notes": "変更を承認します",
    "notifyUser": true
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "requestId": "550e8400-e29b-41d4-a716-446655440020",
      "reservationId": "550e8400-e29b-41d4-a716-446655440010",
      "status": "confirmed",
      "updatedAt": "2025-06-13T14:15:00Z",
      "notificationSent": true
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:15:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.4.4 予約キャンセルリクエスト承認/拒否（管理者用）
- **エンドポイント**: POST /admin/cancel-requests/{requestId}/approve
- **説明**: 予約キャンセルリクエストを承認または拒否
- **認証**: 必要（管理者のみ）
- **パスパラメータ**: requestId
- **リクエスト**:
  ```json
  {
    "approved": true,
    "cancellationFee": 5000.00,
    "notes": "キャンセル料金が発生します",
    "notifyUser": true
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "requestId": "550e8400-e29b-41d4-a716-446655440021",
      "reservationId": "550e8400-e29b-41d4-a716-446655440010",
      "status": "cancelled",
      "cancellationFee": 5000.00,
      "updatedAt": "2025-06-13T14:20:00Z",
      "notificationSent": true
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:20:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.4.5 予約カレンダーブロック（管理者用）
- **エンドポイント**: POST /admin/calendar/block
- **説明**: 予約不可の時間帯を設定
- **認証**: 必要（管理者のみ）
- **リクエスト**:
  ```json
  {
    "startTime": "2025-07-05T00:00:00+09:00",
    "endTime": "2025-07-05T23:59:59+09:00",
    "reason": "設備メンテナンス",
    "notes": "定期点検のため終日予約不可"
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "blockId": "550e8400-e29b-41d4-a716-446655440030",
      "startTime": "2025-07-05T00:00:00+09:00",
      "endTime": "2025-07-05T23:59:59+09:00",
      "reason": "設備メンテナンス",
      "createdAt": "2025-06-13T14:25:00Z"
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:25:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.4.6 オプション管理（管理者用）
- **エンドポイント**: GET /admin/options
- **説明**: 予約オプション一覧を取得
- **認証**: 必要（管理者のみ）
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "options": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440001",
          "name": "背景紙",
          "description": "撮影用背景紙（白/黒/グレー）",
          "price": 1000.00,
          "isActive": true
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440002",
          "name": "LEDライト",
          "description": "調光可能なLEDライト",
          "price": 2000.00,
          "isActive": true
        }
        // その他のオプション
      ]
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:30:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.4.7 オプション追加/編集（管理者用）
- **エンドポイント**: POST /admin/options
- **説明**: 新規オプションの追加
- **認証**: 必要（管理者のみ）
- **リクエスト**:
  ```json
  {
    "name": "養生シート",
    "description": "床保護用の養生シート",
    "price": 1500.00
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "option": {
        "id": "550e8400-e29b-41d4-a716-446655440003",
        "name": "養生シート",
        "description": "床保護用の養生シート",
        "price": 1500.00,
        "isActive": true,
        "createdAt": "2025-06-13T14:35:00Z"
      }
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:35:00Z",
      "version": "1.0.0"
    }
  }
  ```

### 2.5 その他のAPI

#### 2.5.1 オプション一覧取得
- **エンドポイント**: GET /options
- **説明**: 有効なオプション一覧を取得
- **認証**: オプション（認証なしでも閲覧可能）
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "options": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440001",
          "name": "背景紙",
          "description": "撮影用背景紙（白/黒/グレー）",
          "price": 1000.00
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440002",
          "name": "LEDライト",
          "description": "調光可能なLEDライト",
          "price": 2000.00
        }
        // その他のオプション
      ]
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:40:00Z",
      "version": "1.0.0"
    }
  }
  ```

#### 2.5.2 料金計算
- **エンドポイント**: POST /calculator
- **説明**: 予約の料金を計算
- **認証**: オプション（認証なしでも利用可能）
- **リクエスト**:
  ```json
  {
    "startTime": "2025-07-01T10:00:00+09:00",
    "endTime": "2025-07-01T15:00:00+09:00",
    "peopleCount": 8,
    "options": [
      {
        "optionId": "550e8400-e29b-41d4-a716-446655440001",
        "quantity": 1
      },
      {
        "optionId": "550e8400-e29b-41d4-a716-446655440002",
        "quantity": 2
      }
    ]
  }
  ```
- **レスポンス**:
  ```json
  {
    "success": true,
    "data": {
      "basePrice": 15000.00,
      "optionsPrice": 5000.00,
      "totalPrice": 20000.00,
      "hours": 5,
      "breakdown": {
        "hourlyRate": 3000.00,
        "options": [
          {
            "name": "背景紙",
            "unitPrice": 1000.00,
            "quantity": 1,
            "subtotal": 1000.00
          },
          {
            "name": "LEDライト",
            "unitPrice": 2000.00,
            "quantity": 2,
            "subtotal": 4000.00
          }
        ]
      }
    },
    "error": null,
    "meta": {
      "timestamp": "2025-06-13T14:45:00Z",
      "version": "1.0.0"
    }
  }
  ```

## 3. エラーコード一覧

| エラーコード | 説明 |
|------------|------|
| AUTH_INVALID_CREDENTIALS | 認証情報が無効 |
| AUTH_TOKEN_EXPIRED | トークンの期限切れ |
| AUTH_INSUFFICIENT_PERMISSIONS | 権限不足 |
| RESERVATION_CONFLICT | 予約時間の重複 |
| RESERVATION_INVALID_TIME | 無効な予約時間（営業時間外、最低利用時間未満など） |
| RESERVATION_NOT_FOUND | 予約が見つからない |
| USER_NOT_FOUND | ユーザーが見つからない |
| OPTION_NOT_FOUND | オプションが見つからない |
| VALIDATION_ERROR | リクエストデータのバリデーションエラー |
| SYSTEM_ERROR | システムエラー |

## 4. セキュリティ考慮事項

### 4.1 認証・認可
- JWT認証の実装
- アクセストークンの有効期限を1時間に設定
- リフレッシュトークンの有効期限を30日に設定
- ロール（user, admin）に基づくアクセス制御

### 4.2 データ保護
- HTTPSの使用必須
- センシティブデータの暗号化
- JWTの署名検証

### 4.3 レート制限
- APIリクエスト制限: 1分間に60リクエストまで
- ログイン試行制限: 10分間に5回まで

### 4.4 ログとモニタリング
- APIリクエストのログ記録
- 異常なアクセスパターンの検出と通知

## 5. 開発ガイドライン

### 5.1 バージョン管理
- URLにバージョン番号を含める（例: `/v1/resource`）
- 互換性のない変更には新しいバージョン番号を使用

### 5.2 ドキュメント
- OpenAPI (Swagger) 形式でAPI仕様書を管理
- 各エンドポイントの実装時にドキュメントを更新

### 5.3 テスト
- 単体テストと統合テストの両方を実装
- テスト環境での完全なエンドツーエンドテスト

### 5.4 デプロイ
- CI/CDパイプラインによる自動デプロイ
- Blue/Greenデプロイメント戦略
