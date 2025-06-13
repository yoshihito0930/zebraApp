# スタジオゼブラ 予約管理システム データベース設計

## 1. エンティティ関連図 (ER図)

```
+-------------+       +--------------+       +----------------+
|    Users    |<------| Reservations |------>| ReservationLog |
+-------------+       +--------------+       +----------------+
      |                     |
      |                     |
      v                     v
+-------------+       +--------------+
|   Profiles  |       |   Options    |
+-------------+       +--------------+
                            |
                            |
                            v
                      +--------------+
                      |OptionSelections|
                      +--------------+
```

## 2. テーブル定義

### 2.1 Users テーブル
ユーザー情報を管理するテーブル

| フィールド名 | データ型 | 制約 | 説明 |
|------------|---------|------|------|
| id | UUID | PK | ユーザーID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | メールアドレス |
| password_hash | VARCHAR(255) | NOT NULL | ハッシュ化されたパスワード |
| role | ENUM | NOT NULL | 'user', 'admin' |
| email_verified | BOOLEAN | DEFAULT FALSE | メール認証済みフラグ |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |
| last_login_at | TIMESTAMP | NULL | 最終ログイン日時 |
| status | ENUM | NOT NULL | 'active', 'inactive', 'suspended' |

### 2.2 Profiles テーブル
ユーザーのプロフィール情報

| フィールド名 | データ型 | 制約 | 説明 |
|------------|---------|------|------|
| id | UUID | PK | プロフィールID |
| user_id | UUID | FK, NOT NULL | Users.id への参照 |
| first_name | VARCHAR(100) | NOT NULL | 名 |
| last_name | VARCHAR(100) | NOT NULL | 姓 |
| phone_number | VARCHAR(20) | NOT NULL | 電話番号 |
| address | TEXT | NULL | 住所 |
| company_name | VARCHAR(255) | NULL | 会社/団体名 |
| notification_preference | ENUM | NOT NULL | 'email', 'sms', 'both' |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

### 2.3 Reservations テーブル
予約情報

| フィールド名 | データ型 | 制約 | 説明 |
|------------|---------|------|------|
| id | UUID | PK | 予約ID |
| user_id | UUID | FK, NOT NULL | Users.id への参照 |
| start_time | TIMESTAMP | NOT NULL | 利用開始時間 |
| end_time | TIMESTAMP | NOT NULL | 利用終了時間 |
| status | ENUM | NOT NULL | 'temporary', 'confirmed', 'cancelled', 'pending_change', 'pending_cancel' |
| people_count | INTEGER | NOT NULL | 利用人数 |
| purpose | TEXT | NULL | 利用目的 |
| special_requests | TEXT | NULL | 特別リクエスト |
| admin_notes | TEXT | NULL | 管理者メモ（内部用） |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |
| confirmed_at | TIMESTAMP | NULL | 確定日時 |
| google_calendar_event_id | VARCHAR(255) | NULL | Google Calendar連携ID |
| total_price | DECIMAL(10,2) | NULL | 合計金額 |
| cancellation_fee | DECIMAL(10,2) | NULL | キャンセル料 |

### 2.4 ReservationLog テーブル
予約の変更履歴

| フィールド名 | データ型 | 制約 | 説明 |
|------------|---------|------|------|
| id | UUID | PK | ログID |
| reservation_id | UUID | FK, NOT NULL | Reservations.id への参照 |
| action | ENUM | NOT NULL | 'created', 'updated', 'status_changed', 'cancelled' |
| performed_by | UUID | FK, NOT NULL | 操作したユーザーID (Users.id) |
| previous_data | JSON | NULL | 変更前のデータ（JSON形式） |
| new_data | JSON | NULL | 変更後のデータ（JSON形式） |
| notes | TEXT | NULL | 変更に関するメモ |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### 2.5 Options テーブル
オプション項目マスタ

| フィールド名 | データ型 | 制約 | 説明 |
|------------|---------|------|------|
| id | UUID | PK | オプションID |
| name | VARCHAR(255) | NOT NULL | オプション名 |
| description | TEXT | NULL | 説明 |
| price | DECIMAL(10,2) | NOT NULL | 料金 |
| is_active | BOOLEAN | NOT NULL DEFAULT TRUE | 有効フラグ |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

### 2.6 OptionSelections テーブル
予約に対するオプション選択

| フィールド名 | データ型 | 制約 | 説明 |
|------------|---------|------|------|
| id | UUID | PK | 選択ID |
| reservation_id | UUID | FK, NOT NULL | Reservations.id への参照 |
| option_id | UUID | FK, NOT NULL | Options.id への参照 |
| quantity | INTEGER | NOT NULL DEFAULT 1 | 数量 |
| price_at_selection | DECIMAL(10,2) | NOT NULL | 選択時の価格 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

### 2.7 Notifications テーブル (MVPフェーズ後)
通知管理

| フィールド名 | データ型 | 制約 | 説明 |
|------------|---------|------|------|
| id | UUID | PK | 通知ID |
| user_id | UUID | FK, NOT NULL | Users.id への参照 |
| reservation_id | UUID | FK, NULL | Reservations.id への参照（予約関連の通知の場合） |
| type | ENUM | NOT NULL | 'reservation_reminder', 'temp_reservation_expiry', 'status_change', 'system' |
| title | VARCHAR(255) | NOT NULL | 通知タイトル |
| message | TEXT | NOT NULL | 通知メッセージ |
| is_read | BOOLEAN | NOT NULL DEFAULT FALSE | 既読フラグ |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| scheduled_for | TIMESTAMP | NULL | 配信予定日時（将来の通知の場合） |
| sent_at | TIMESTAMP | NULL | 送信日時 |

### 2.8 Settings テーブル
システム設定

| フィールド名 | データ型 | 制約 | 説明 |
|------------|---------|------|------|
| key | VARCHAR(255) | PK | 設定キー |
| value | TEXT | NOT NULL | 設定値 |
| description | TEXT | NULL | 説明 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |
| updated_by | UUID | FK, NULL | 更新したユーザーID (Users.id) |

## 3. インデックス定義

### 3.1 Users テーブル
- email (UNIQUE)
- role, status (複合インデックス)

### 3.2 Profiles テーブル
- user_id (UNIQUE)

### 3.3 Reservations テーブル
- user_id
- start_time, end_time (複合インデックス)
- status
- created_at

### 3.4 ReservationLog テーブル
- reservation_id
- performed_by
- created_at

### 3.5 OptionSelections テーブル
- reservation_id
- option_id

### 3.6 Notifications テーブル
- user_id
- reservation_id
- type
- is_read
- scheduled_for

## 4. 外部キー制約

### 4.1 Profiles テーブル
```
ALTER TABLE Profiles
ADD CONSTRAINT fk_profiles_user_id
FOREIGN KEY (user_id) REFERENCES Users(id)
ON DELETE CASCADE;
```

### 4.2 Reservations テーブル
```
ALTER TABLE Reservations
ADD CONSTRAINT fk_reservations_user_id
FOREIGN KEY (user_id) REFERENCES Users(id)
ON DELETE CASCADE;
```

### 4.3 ReservationLog テーブル
```
ALTER TABLE ReservationLog
ADD CONSTRAINT fk_reservation_log_reservation_id
FOREIGN KEY (reservation_id) REFERENCES Reservations(id)
ON DELETE CASCADE;

ALTER TABLE ReservationLog
ADD CONSTRAINT fk_reservation_log_performed_by
FOREIGN KEY (performed_by) REFERENCES Users(id)
ON DELETE NO ACTION;
```

### 4.4 OptionSelections テーブル
```
ALTER TABLE OptionSelections
ADD CONSTRAINT fk_option_selections_reservation_id
FOREIGN KEY (reservation_id) REFERENCES Reservations(id)
ON DELETE CASCADE;

ALTER TABLE OptionSelections
ADD CONSTRAINT fk_option_selections_option_id
FOREIGN KEY (option_id) REFERENCES Options(id)
ON DELETE NO ACTION;
```

## 5. データベースセキュリティ考慮事項

### 5.1 データ暗号化
- パスワードはハッシュ化して保存（bcryptなど）
- 個人情報（メールアドレス、住所など）は適切に暗号化

### 5.2 アクセス制御
- データベースへのアクセスは特定のIPからのみ許可
- 最小権限原則に基づいたデータベースユーザー設定

### 5.3 監査ログ
- 重要なデータ変更（特に予約ステータスの変更）はReservationLogテーブルに記録

## 6. マイグレーション戦略
- 段階的なマイグレーションプラン
- ダウンタイム最小化のための手順
- ロールバック計画

## 7. 拡張性考慮事項
- シャーディング可能な設計
- 将来のデータ増加に対応するための水平スケーリング対応
- 長期保存データと短期アクセスデータの分離戦略
