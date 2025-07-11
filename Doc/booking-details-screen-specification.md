# 予約詳細表示画面 詳細仕様書

## 1. 概要

予約詳細表示画面は、カレンダー上の予約をクリックした際に表示されるモーダル画面です。ユーザーの権限（自分の予約か他人の予約か）に応じて表示内容を動的に制御し、プライバシー保護を実現します。

## 2. 機能要件

### 2.1 基本機能

1. **予約詳細情報の表示**
   - 予約時間、日付
   - 予約種別（仮予約/本予約）
   - 予約ステータス
   - 予約者情報（権限に応じて）

2. **プライバシー保護機能**
   - 自分の予約: 全詳細情報表示
   - 他人の予約: 最小限情報のみ表示

3. **アクション機能**
   - キャンセル申請
   - 変更申請
   - 詳細編集（管理者のみ）

### 2.2 表示制御ロジック

#### 2.2.1 権限判定
```typescript
interface BookingDetailsResponse {
  booking: PrivateBookingDetails | PublicBookingInfo;
  isOwnBooking: boolean;
  canModify: boolean;
  canCancel: boolean;
}
```

#### 2.2.2 表示内容分類

**パブリック情報（誰でも閲覧可能）**:
- 予約日時
- 予約種別（仮予約/本予約）
- 占有状態

**プライベート情報（予約者のみ閲覧可能）**:
- 予約者詳細情報（氏名、連絡先）
- 料金詳細
- 選択オプション
- 利用目的
- 予約履歴
- アクションボタン

## 3. UI/UX仕様

### 3.1 レイアウト構成

```
┌─────────────────────────────────────┐
│ ヘッダー（タイトル + 閉じるボタン） │
├─────────────────────────────────────┤
│                                     │
│ メインコンテンツエリア              │
│ - PublicBookingDetailsScreen または │
│ - PrivateBookingDetailsScreen       │
│                                     │
├─────────────────────────────────────┤
│ フッター（必要に応じて）            │
└─────────────────────────────────────┘
```

### 3.2 PublicBookingDetailsScreen

**表示項目**:
- 予約時間帯
- 予約種別
- プライバシー保護メッセージ

**UI例**:
```jsx
<PublicBookingDetailsScreen>
  <BookingTimeDisplay>
    <Date>{formatDate(booking.date)}</Date>
    <TimeRange>{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</TimeRange>
  </BookingTimeDisplay>
  
  <BookingType type={booking.type}>
    {booking.type === 'temporary' ? '仮予約' : '本予約'}
  </BookingType>
  
  <PrivacyNotice>
    この時間帯は予約済みです。詳細情報は予約者のみ確認できます。
  </PrivacyNotice>
</PublicBookingDetailsScreen>
```

### 3.3 PrivateBookingDetailsScreen

**表示セクション**:

1. **基本情報セクション**
   - 予約ID
   - 予約日時
   - 予約種別
   - ステータス

2. **予約者情報セクション**
   - 氏名
   - メールアドレス
   - 電話番号
   - 住所

3. **料金情報セクション**
   - 基本料金
   - オプション料金
   - 合計金額

4. **オプション詳細セクション**
   - 選択オプション一覧
   - 各オプションの料金

5. **予約履歴セクション**
   - 申請日時
   - ステータス変更履歴
   - 変更・キャンセル履歴

6. **キャンセルポリシーセクション**
   - 日数別キャンセル料率
   - 現在のキャンセル料計算結果

7. **アクションセクション**
   - キャンセル申請ボタン
   - 変更申請ボタン

## 4. データ構造

### 4.1 API レスポンス型

```typescript
// メインレスポンス
interface BookingDetailsResponse {
  booking: PrivateBookingDetails | PublicBookingInfo;
  isOwnBooking: boolean;
  canModify: boolean;
  canCancel: boolean;
}

// パブリック情報（他人の予約）
interface PublicBookingInfo {
  bookingId: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'temporary' | 'confirmed';
  status: 'approved' | 'pending' | 'rejected' | 'cancelled';
}

// プライベート情報（自分の予約）
interface PrivateBookingDetails extends PublicBookingInfo {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress?: string;
  purpose: string;
  participants: number;
  selectedOptions: BookingOption[];
  basePrice: number;
  optionsPrice: number;
  totalPrice: number;
  cancellationFee: number;
  history: BookingHistoryEntry[];
  notes?: string;
  adminNotes?: string;
}

// 予約履歴エントリー
interface BookingHistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  status: string;
  performedBy: string;
  notes?: string;
}

// 予約オプション
interface BookingOption {
  id: string;
  name: string;
  price: number;
  quantity?: number;
}
```

## 5. ビジネスロジック

### 5.1 権限チェック

```typescript
const checkBookingPermissions = (booking: BookingDetails, currentUser: User) => {
  const isOwnBooking = booking.customerId === currentUser.userId;
  const isAdmin = currentUser.isAdmin;
  
  return {
    canView: isOwnBooking || isAdmin,
    canModify: isOwnBooking && booking.status !== 'cancelled',
    canCancel: isOwnBooking && booking.status !== 'cancelled',
    canViewPrivateInfo: isOwnBooking || isAdmin
  };
};
```

### 5.2 キャンセル料計算

```typescript
const calculateCancellationFee = (booking: PrivateBookingDetails): number => {
  const now = new Date();
  const bookingDate = new Date(booking.date);
  const daysUntilBooking = Math.ceil((bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  let rate = 0;
  if (daysUntilBooking <= 0) {
    rate = 1.0; // 当日: 100%
  } else if (daysUntilBooking <= 3) {
    rate = 0.8; // 3-1日前: 80%
  } else if (daysUntilBooking <= 6) {
    rate = 0.5; // 6-4日前: 50%
  }
  // 7日前以前はキャンセル料なし
  
  return Math.floor(booking.totalPrice * rate);
};
```

### 5.3 変更可能期間チェック

```typescript
const isModifiable = (booking: PrivateBookingDetails): boolean => {
  const now = new Date();
  const bookingDate = new Date(booking.date);
  const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  // 利用開始24時間前まで変更可能
  return hoursUntilBooking > 24 && booking.status !== 'cancelled';
};
```

## 6. エラーハンドリング

### 6.1 エラー分類

1. **認証エラー（401）**
   - セッション期限切れ
   - 無効なトークン

2. **権限エラー（403）**
   - アクセス権限なし
   - 操作権限なし

3. **ネットワークエラー**
   - 接続タイムアウト
   - サーバー無応答

4. **APIエラー（4xx, 5xx）**
   - 予約が見つからない（404）
   - サーバー内部エラー（500）

### 6.2 エラー対応

```typescript
const handleBookingDetailsError = (error: ApiError) => {
  switch (error.status) {
    case 401:
      // 認証エラー - ログイン画面にリダイレクト
      redirectToLogin();
      break;
    case 403:
      // 権限エラー - アクセス権限なしメッセージ
      showAccessDeniedMessage();
      break;
    case 404:
      // 予約が見つからない
      showBookingNotFoundMessage();
      break;
    case 500:
      // サーバーエラー - リトライ可能
      showServerErrorMessage(true);
      break;
    default:
      // その他のエラー
      showGenericErrorMessage();
  }
};
```

## 7. アクセシビリティ

### 7.1 キーボード操作

- Tab キー: フォーカス移動
- Enter キー: ボタン実行
- Escape キー: モーダル閉じる

### 7.2 スクリーンリーダー対応

- セマンティックHTML要素の使用
- ARIA属性の適切な設定
- 見出しレベルの階層化

### 7.3 色覚対応

- 色だけでなく形状・ラベルでも情報伝達
- 十分なコントラスト比の確保

## 8. パフォーマンス考慮事項

### 8.1 データ取得最適化

- 必要最小限のデータのみ取得
- キャッシュの活用
- 遅延読み込みの実装

### 8.2 レンダリング最適化

- 仮想化の活用（長いリスト）
- メモ化による再描画防止
- 段階的レンダリング

## 9. セキュリティ考慮事項

### 9.1 データ保護

- 個人情報の適切な暗号化
- アクセス権限の厳格な制御
- ログの適切な管理

### 9.2 入力検証

- XSS攻撃対策
- SQLインジェクション対策
- 入力データの検証とサニタイゼーション

## 10. テスト要件

### 10.1 単体テスト

- コンポーネントレンダリングテスト
- ビジネスロジックテスト
- エラーハンドリングテスト

### 10.2 統合テスト

- API連携テスト
- 権限制御テスト
- ワークフローテスト

### 10.3 E2Eテスト

- ユーザーシナリオテスト
- クロスブラウザテスト
- アクセシビリティテスト
