# UI/UXデザインガイドライン - サーバレスアプリケーション

## 1. はじめに

本ドキュメントは、撮影スタジオ予約管理アプリケーションのサーバレスアーキテクチャを考慮したUI/UXデザインガイドラインを定義します。Apple Human Interface Guidelines (HIG)に準拠しつつ、サーバレス環境の特性を活かしたユーザー体験を提供することを目指します。

### 1.1 ガイドラインの目的

- サーバレス環境に最適化されたUI/UX設計指針の提供
- 一貫性のあるユーザー体験の確保
- 開発チーム間の共通認識の形成
- デザイン決定の根拠となる基準の提示
- アクセシビリティと使いやすさの向上

### 1.2 設計哲学

1. **ユーザー中心設計**
   - ユーザーのニーズと行動を最優先に考える
   - ユーザーの文脈と目標を理解する

2. **シンプルさと明瞭さ**
   - 不必要な複雑さを排除
   - 直感的に理解できるインターフェース

3. **一貫性**
   - アプリケーション全体で一貫したデザイン言語
   - Apple HIGとの整合性

4. **フィードバックとガイダンス**
   - ユーザーアクションに対する明確なフィードバック
   - 適切なガイダンスとヘルプの提供

5. **パフォーマンスとリアクティビティ**
   - サーバレスの特性を活かした応答性の高いUI
   - ネットワーク遅延を考慮した適切なフィードバック

## 2. サーバレスアプリケーションのUI/UX特性

### 2.1 サーバレスアーキテクチャを考慮したUI/UX

1. **非同期処理の視覚化**
   - バックグラウンドで実行される処理の進行状況を視覚化
   - 完了通知とエラー通知の適切な表示

2. **オフライン対応と状態管理**
   - オフライン状態の明示的な表示
   - データ同期状態のフィードバック
   - ローカルキャッシュとの相互作用の透明性

3. **応答性の最適化**
   - コールドスタート遅延を考慮したUX設計
   - プログレッシブロードとプリロード戦略
   - スケルトンスクリーンとプレースホルダーの活用

4. **マイクロインタラクションの設計**
   - Lambda関数実行時間に適した待機インジケーター
   - データ保存確認のマイクロフィードバック
   - サービス間遷移のなめらかなアニメーション

### 2.2 サーバレス固有のUXパターン

1. **段階的データロード**
   - 重要なデータを先に表示
   - 詳細情報を徐々に読み込む
   - 予測ロードで待ち時間を短縮

2. **状態変更のオプティミスティックUI**
   - ユーザー操作に対して即時フィードバック
   - バックグラウンド同期
   - エラー発生時の適切なリカバリー

3. **API Gateway制限の考慮**
   - レート制限に対するユーザーフィードバック
   - スロットリング時のグレースフル対応
   - バースト処理のモニタリングと通知

4. **イベント駆動型インタラクション**
   - リアルタイム通知の統合
   - イベントベースのUI更新
   - ステータス変更の適切な視覚化

## 3. UIコンポーネントとガイドライン

### 3.1 基本コンポーネント

#### 3.1.0 予約詳細表示コンポーネント

**プライバシー保護原則**:
- 自分の予約: 全ての詳細情報を表示
- 他人の予約: 最小限の情報のみ表示（時間帯、予約種別のみ）
- ユーザー認証状態に基づく動的表示制御

**実装パターン**:
```jsx
// メインコンポーネント
<BookingDetailsModal
  isOpen={isOpen}
  bookingId={bookingId}
  onClose={onClose}
  onCancel={onCancel}
  onModify={onModify}
/>

// プライベート予約詳細（自分の予約）
<PrivateBookingDetailsScreen
  booking={booking}
  onClose={onClose}
  onCancel={onCancel}
  onModify={onModify}
  isLoading={isLoading}
/>

// パブリック予約詳細（他人の予約）
<PublicBookingDetailsScreen
  booking={booking}
  onClose={onClose}
  isLoading={isLoading}
/>
```

**表示内容の分類**:

1. **パブリック情報（他人の予約で表示）**:
   - 予約時間帯
   - 予約種別（仮予約/本予約）
   - 占有状態のみ

2. **プライベート情報（自分の予約のみ表示）**:
   - 予約ステータス詳細
   - 予約者情報
   - 連絡先情報
   - 選択オプション詳細
   - 料金情報
   - 予約履歴
   - アクションボタン（キャンセル・変更）

**アクション機能の実装**:
```jsx
// キャンセル申請
const handleBookingCancel = async (bookingId) => {
  // 権限チェック
  if (!isOwnBooking) return;
  
  // キャンセルポリシー確認
  const cancellationFee = calculateCancellationFee(booking);
  const confirmed = await showCancellationConfirmation(cancellationFee);
  
  if (confirmed) {
    await submitCancellationRequest(bookingId);
  }
};

// 変更申請
const handleBookingModify = async (bookingId) => {
  // 権限チェック
  if (!isOwnBooking) return;
  
  // 変更可能期間チェック
  if (!isModifiable(booking)) {
    showModificationNotAllowed();
    return;
  }
  
  openModificationForm(bookingId);
};
```

**エラーハンドリングパターン**:

1. **認証エラー**:
   - ログイン画面へのリダイレクト促進
   - セッション期限切れの明示

2. **権限エラー**:
   - アクセス権限なしの明示
   - 適切なエラーメッセージ表示

3. **ネットワークエラー**:
   - リトライボタンの提供
   - オフライン状態の明示

4. **APIエラー**:
   - エラー種別に応じたメッセージ表示
   - ヘルプリンクの提供

**キャンセルポリシー表示**:
```jsx
<CancellationPolicySection>
  <PolicyTitle>キャンセルポリシー</PolicyTitle>
  <PolicyRates>
    <Rate period="6-4日前">50%</Rate>
    <Rate period="3-1日前">80%</Rate>
    <Rate period="当日">100%</Rate>
  </PolicyRates>
  <PolicyCalculation>
    現在のキャンセル料: {calculateCurrentFee(booking)}円
  </PolicyCalculation>
</CancellationPolicySection>
```

#### 3.1.1 カレンダー表示

**推奨事項**:
- Apple Calendarに準拠したデザイン
- 月/週/日表示の切り替えをセグメントコントロールで実現
- 色分けによる予約状態表示（空き、仮予約、本予約）
- タッチターゲットは最小44×44ptに設定

**詳細なカレンダー表示機能**:

1. **表示モード**
   - 月間表示: 日別統計と予約概要表示
   - 週間表示: 時間枠詳細と日別詳細情報
   - 日間表示: 10分単位の詳細時間枠管理

2. **色分けシステム**
   ```jsx
   const statusColorMap = {
     // 空き状況
     available: '#FFFFFF',           // 白 - 空き時間
     
     // 仮予約状態
     temporary_pending: '#F59E0B',   // アンバー - 承認待ち仮予約
     temporary_approved: '#10B981',  // エメラルド - 承認済み仮予約
     
     // 本予約状態
     confirmed_pending: '#F59E0B',   // アンバー - 承認待ち本予約
     confirmed: '#3B82F6',           // ブルー - 確定本予約
     
     // その他状態
     cancelled: '#9CA3AF',           // グレー - キャンセル済み
     rejected: '#EF4444',            // レッド - 拒否済み
     occupied: '#6B7280'             // ダークグレー - その他占有
   };
   ```

3. **FullCalendar.js互換実装**
   ```jsx
   // カレンダーイベント形式での表示
   <FullCalendar
     plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
     initialView='dayGridMonth'
     headerToolbar={{
       left: 'prev,next today',
       center: 'title',
       right: 'dayGridMonth,timeGridWeek,timeGridDay'
     }}
     events={calendarEvents}
     eventDidMount={(info) => {
       // 予約タイプに応じたスタイリング
       info.el.style.backgroundColor = info.event.backgroundColor;
       info.el.style.borderColor = info.event.borderColor;
       info.el.style.color = info.event.textColor;
     }}
     eventClick={handleEventClick}
     dateClick={handleDateClick}
     loading={handleLoading}
     eventDisplay='block'
     displayEventTime={true}
     eventTimeFormat={{
       hour: '2-digit',
       minute: '2-digit',
       hour12: false
     }}
   />
   ```

4. **API連携パターン**
   ```jsx
   // 月間カレンダーデータ取得
   const useMonthlyCalendar = (year, month) => {
     return useQuery(
       ['calendar', 'month', year, month],
       () => fetchMonthlyCalendar(year, month),
       {
         staleTime: 5 * 60 * 1000,
         cacheTime: 30 * 60 * 1000,
         onError: handleCalendarError
       }
     );
   };

   // 週間カレンダーデータ取得
   const useWeeklyCalendar = (year, week) => {
     return useQuery(
       ['calendar', 'week', year, week],
       () => fetchWeeklyCalendar(year, week),
       {
         staleTime: 2 * 60 * 1000,
         cacheTime: 15 * 60 * 1000
       }
     );
   };

   // 日間カレンダーデータ取得
   const useDailyCalendar = (year, month, day) => {
     return useQuery(
       ['calendar', 'day', year, month, day],
       () => fetchDailyCalendar(year, month, day),
       {
         staleTime: 1 * 60 * 1000,
         cacheTime: 10 * 60 * 1000,
         refetchInterval: 30 * 1000 // 30秒ごとに更新
       }
     );
   };

   // FullCalendar.js形式のイベントデータ取得
   const useCalendarEvents = (startDate, endDate) => {
     return useQuery(
       ['calendar', 'events', startDate, endDate],
       () => fetchCalendarEvents(startDate, endDate),
       {
         staleTime: 2 * 60 * 1000,
         select: (data) => data.events // イベント配列のみ抽出
       }
     );
   };
   ```

5. **レスポンシブ対応**
   ```jsx
   // モバイル向けカレンダー実装
   const MobileCalendarView = () => {
     const [view, setView] = useState('dayGridMonth');
     
     return (
       <div className="mobile-calendar">
         <ViewSwitcher
           options={[
             { value: 'dayGridMonth', label: '月' },
             { value: 'timeGridWeek', label: '週' },
             { value: 'timeGridDay', label: '日' }
           ]}
           value={view}
           onChange={setView}
         />
         <FullCalendar
           plugins={[dayGridPlugin, timeGridPlugin]}
           initialView={view}
           height="auto"
           contentHeight="auto"
           aspectRatio={0.8}
           headerToolbar={{
             left: 'prev,next',
             center: 'title',
             right: ''
           }}
           events={events}
           eventDisplay="block"
           dayMaxEvents={3}
           moreLinkClick="popover"
         />
       </div>
     );
   };
   ```

**実装ガイドライン**:
```jsx
// 統合カレンダーコンポーネント例
<Calendar
  view="month"
  year={2025}
  month={1}
  onDateSelect={handleDateSelect}
  onEventClick={handleEventClick}
  bookings={bookings}
  statusColorMap={statusColorMap}
  loadingPlaceholder={<CalendarSkeleton />}
  errorFallback={<CalendarError onRetry={handleRetry} />}
  apiEndpoints={{
    monthly: '/api/calendar/month/{year}/{month}',
    weekly: '/api/calendar/week/{year}/{week}',
    daily: '/api/calendar/day/{year}/{month}/{day}',
    events: '/api/calendar/events'
  }}
  permissions={{
    canViewAll: isAdmin,
    canEdit: canEditBookings,
    canCreate: canCreateBookings
  }}
/>
```

**サーバレス最適化**:
- カレンダーデータを日付範囲で分割取得（Lambda負荷分散）
- 表示期間外のデータはバックグラウンド事前読み込み
- 更新が頻繁なデータは部分的更新を実装
- GSI（DateBookingsIndex）を活用した効率的なデータ取得
- 10分単位時間枠の動的生成とキャッシュ活用
- イベント駆動による予約状態のリアルタイム更新

#### 3.1.2 予約フォーム

**推奨事項**:
- ステップバイステップの予約プロセス
- フォームの入力状態をプログレスインジケーターで可視化
- 入力の即時バリデーション
- 時間選択は視覚的な時間枠セレクターを使用

**実装ガイドライン**:
```jsx
<BookingForm
  steps={['日時選択', '予約タイプ', 'オプション', '確認']}
  currentStep={currentStep}
  onStepChange={handleStepChange}
  onSubmit={handleSubmit}
  submitFeedback={{
    pending: <LoadingSpinner text="予約を処理中..." />,
    success: <SuccessMessage text="予約申請が完了しました" />,
    error: <ErrorMessage text="申し訳ありません、エラーが発生しました" />
  }}
/>
```

**サーバレス最適化**:
- フォーム送信は冗長化とリトライ機能を実装
- 予約データはローカルに一時保存（送信失敗時のリカバリー）
- 日時選択時のリアルタイム空き枠確認

#### 3.1.3 通知コンポーネント

**推奨事項**:
- Apple通知センターの設計原則に従った整理された通知表示
- 優先度による通知のグループ化
- アクション可能な通知（承認、拒否などのインラインアクション）
- バッジとサウンドの一貫したプログラミング

**実装ガイドライン**:
```jsx
<NotificationCenter
  notifications={notifications}
  onNotificationRead={markAsRead}
  onActionPerformed={handleAction}
  groupBy="type"
  filter={notificationFilter}
  emptyState={<EmptyNotifications />}
/>
```

**サーバレス最適化**:
- プッシュ通知とポーリングの適切なバランス
- SSEまたはWebSocketを使用したリアルタイム通知
- 重要度に基づく通知の優先順位付け

#### 3.1.4 ダッシュボード

**推奨事項**:
- 重要情報を上位に配置
- カード形式の統計表示
- グラフと数値の適切な組み合わせ
- カスタマイズ可能なダッシュボードレイアウト

**実装ガイドライン**:
```jsx
<Dashboard
  widgets={[
    {type: 'upcoming', title: '今後の予約', data: upcomingBookings},
    {type: 'stats', title: '利用統計', data: userStats},
    {type: 'notifications', title: '未読通知', data: unreadNotifications}
  ]}
  layout="grid"
  onRefresh={refreshDashboard}
  lastUpdated={lastUpdatedTimestamp}
/>
```

**サーバレス最適化**:
- ウィジェット単位の個別データロード
- 重要度に基づくデータ更新頻度の調整
- イベント駆動によるリアルタイム更新

### 3.2 モバイルとデスクトップの最適化

#### 3.2.1 モバイル最適化

**推奨事項**:
- コンテンツ優先のレイアウト
- 主要アクションを親指の届く位置に配置
- 下部ナビゲーションバーの活用
- プルダウンリフレッシュとスワイプアクション

**モバイル特有のパターン**:
- カレンダーは週単位または日単位表示を優先
- 予約フォームは複数ステップに分割
- 通知はポップアップと通知センターの併用

#### 3.2.2 デスクトップ最適化

**推奨事項**:
- マルチペイン構造の活用
- カレンダーと詳細表示の並列配置
- キーボードショートカットの実装
- 高度な管理機能の表示

**デスクトップ特有のパターン**:
- サイドバーナビゲーションの活用
- ドラッグ＆ドロップによる予約管理
- データテーブルの高度なフィルタリングと並べ替え

## 4. データ状態とローディングパターン

### 4.1 ローディング状態

**基本原則**:
- ローディング状態は常に視覚化する
- 3秒以上かかる処理には進行状況を表示
- スケルトンスクリーンでレイアウトを先行表示

**実装パターン**:
```jsx
const BookingList = () => {
  const { data, isLoading, error } = useBookings();
  
  if (isLoading) return <BookingListSkeleton />;
  if (error) return <ErrorDisplay error={error} />;
  
  return <BookingListDisplay bookings={data} />;
};
```

**サーバレス最適化**:
- Lambda関数の実行時間に合わせたローディングインジケーター
- 初回読み込みと更新の異なる視覚化
- バックグラウンド更新と楽観的UI更新の組み合わせ

### 4.2 エラー状態

**基本原則**:
- エラーメッセージは具体的かつ行動可能に
- ユーザーにリカバリー方法を提示
- システムエラーとユーザーエラーの区別

**実装パターン**:
```jsx
const ErrorDisplay = ({ error, onRetry }) => {
  const isNetworkError = error.code === 'NETWORK_ERROR';
  
  return (
    <ErrorCard>
      <ErrorIcon type={isNetworkError ? 'network' : 'system'} />
      <ErrorTitle>{getErrorTitle(error)}</ErrorTitle>
      <ErrorMessage>{getErrorMessage(error)}</ErrorMessage>
      {isNetworkError && (
        <RetryButton onClick={onRetry}>再試行</RetryButton>
      )}
      <HelpLink href="/help">ヘルプを表示</HelpLink>
    </ErrorCard>
  );
};
```

**サーバレス特有のエラーハンドリング**:
- API Gatewayのタイムアウトエラー専用UI
- Lambda関数のコールドスタート遅延対応
- DynamoDBスロットリングエラー時の段階的バックオフ

### 4.3 空の状態

**基本原則**:
- 空の状態は単なる「データなし」ではなく機会に
- 次のアクションを促す明確なCTA
- 視覚的に魅力的なイラストでコンテンツの可能性を示唆

**実装パターン**:
```jsx
const EmptyBookings = () => (
  <EmptyState
    icon={<CalendarIcon />}
    title="予約はまだありません"
    description="最初の予約を作成して、スタジオ利用を開始しましょう。"
    action={<CreateBookingButton />}
  />
);
```

## 5. アクセシビリティとインクルーシブデザイン

### 5.1 アクセシビリティ基準

- **色コントラスト**: WCAG 2.1 AA基準（コントラスト比4.5:1以上）
- **フォントサイズ**: 最小16pxを基準、動的サイズ対応
- **フォーカス可視化**: キーボード操作時の明確なフォーカス表示
- **代替テキスト**: すべての意味のある画像に代替テキスト提供
- **スクリーンリーダー**: ARIA属性の適切な使用

### 5.2 インクルーシブデザインの実践

- **言語**: 明確でシンプルな言語表現
- **色覚多様性**: 色だけでなく形状やラベルも使用
- **動き**: アニメーションの削減オプション提供
- **タッチターゲット**: 最小44×44ptのタッチ領域確保
- **フィードバック**: 複数の感覚（視覚・聴覚など）でのフィードバック

## 6. API通信とデータ取得のUXパターン

### 6.1 データ取得戦略

**基本原則**:
- 必要なデータのみを取得（オーバーフェッチング回避）
- データ取得の優先順位付け
- キャッシュと再検証の適切な組み合わせ

**実装パターン**:
```jsx
// React Query を使った実装例
const useBookingsData = (dateRange) => {
  return useQuery(
    ['bookings', dateRange],
    () => fetchBookings(dateRange),
    {
      staleTime: 5 * 60 * 1000, // 5分間はキャッシュ有効
      cacheTime: 30 * 60 * 1000, // 30分間はキャッシュ保持
      refetchOnWindowFocus: true, // ウィンドウフォーカス時に再検証
      onError: handleError
    }
  );
};
```

### 6.2 サーバレス特有のデータ取得最適化

1. **分散データ取得**
   - 大きなデータセットを複数のLambda呼び出しに分割
   - ページネーションとインフィニットスクロールの活用
   - データの重要度に基づく段階的読み込み

2. **コールドスタート対策**
   - 初回読み込み時の特別なローディング状態
   - バックグラウンドでのウォームアップリクエスト
   - 最初に最小限のデータを取得し、詳細は後から取得

3. **イベント駆動型UI更新**
   - WebSocketやSSEを使用したリアルタイム更新
   - 予約状態変更などの重要イベントをプッシュ通知
   - ポーリングとリアルタイム更新の併用

## 7. フォーム設計とバリデーション

### 7.1 フォーム設計原則

1. **単一の責任**
   - 各フォームは単一の目的に集中
   - 複雑なフォームは論理的なセクションに分割

2. **インラインバリデーション**
   - リアルタイムのフィールドバリデーション
   - エラーメッセージはフィールド近くに表示
   - 肯定的なバリデーションフィードバック

3. **コンテキストヘルプ**
   - 入力フィールド近くにヘルプテキスト
   - 例示による入力ガイダンス
   - ツールチップとポップオーバーの活用

### 7.2 フォーム最適化戦略

1. **段階的フォーム**
   - 複雑なフォームを複数ステップに分割
   - 各ステップのデータを一時保存
   - 進行状況の視覚化

2. **条件付きフィールド**
   - 必要なフィールドのみを表示
   - 選択に基づいて関連フィールドを表示/非表示
   - コンテキストに応じた入力オプション

3. **送信最適化**
   - 送信前の入力データ検証
   - バックグラウンド送信とリトライロジック
   - 成功/失敗のフィードバック表示

**実装ガイドライン**:
```jsx
<FormProvider>
  <Form onSubmit={handleSubmit}>
    <FormSection title="基本情報">
      <TextField
        name="name"
        label="お名前"
        validation={{
          required: '名前を入力してください',
          minLength: {
            value: 2,
            message: '2文字以上入力してください'
          }
        }}
        helpText="予約者のフルネームを入力してください"
      />
      
      <EmailField
        name="email"
        label="メールアドレス"
        validation={{
          required: 'メールアドレスを入力してください',
          pattern: {
            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
            message: '有効なメールアドレスを入力してください'
          }
        }}
      />
    </FormSection>
    
    <FormButtons>
      <Button type="submit" variant="primary">
        予約を確定
      </Button>
      <Button type="button" variant="secondary" onClick={handleCancel}>
        キャンセル
      </Button>
    </FormButtons>
  </Form>
</FormProvider>
```

## 8. レスポンシブデザイン戦略

### 8.1 ブレイクポイント設計

**基本ブレイクポイント**:
- モバイル: 〜767px
- タブレット: 768px〜1023px
- デスクトップ: 1024px〜1439px
- ワイドスクリーン: 1440px〜

**実装方法**:
```css
/* Tailwind CSSの設定例 */
module.exports = {
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1440px',
    },
  }
}
```

### 8.2 レスポンシブレイアウトパターン

1. **モバイルファースト設計**
   - モバイル向けの基本スタイルから開始
   - ブレイクポイントでレイアウトを拡張
   - 最小限のCSSを使用

2. **アダプティブレイアウト**
   - 各デバイスクラス向けの最適化
   - コンポーネント配置の再構成
   - コンテンツの優先順位付け

3. **柔軟なグリッドシステム**
   - 割合ベースのレイアウト
   - CSS Gridとフレックスボックスの活用
   - ビューポートに基づく動的サイジング

### 8.3 コンテンツ適応戦略

1. **コンテンツ優先度**
   - 小さい画面では重要なコンテンツを優先表示
   - 二次的な情報は非表示または折りたたみ
   - タップ/クリックで詳細表示

2. **ナビゲーション変換**
   - デスクトップ: 水平ナビゲーション
   - タブレット: コンパクトナビゲーション
   - モバイル: ハンバーガーメニューと下部タブバー

3. **画像・メディア最適化**
   - レスポンシブ画像
   - デバイス解像度に応じた画質
   - 帯域幅を考慮した遅延読み込み

## 9. 管理画面のUI/UX設計

### 9.1 管理者ダッシュボード

**推奨事項**:
- データ中心の設計
- カスタマイズ可能なダッシュボード
- フィルタリングと検索の充実
- 高度なソート機能

**実装ガイドライン**:
```jsx
<AdminDashboard>
  <DashboardHeader>
    <Title>管理者ダッシュボード</Title>
    <DateRangePicker onChange={handleDateChange} />
    <RefreshButton onClick={refreshData} />
  </DashboardHeader>
  
  <DashboardGrid>
    <StatCard title="今日の予約数" value={todayBookings} trend={trend} />
    <StatCard title="承認待ち予約" value={pendingBookings} />
    <StatCard title="現在の利用者数" value={currentUsers} />
    <BookingChart data={bookingData} period="weekly" />
  </DashboardGrid>
  
  <PendingBookingsTable
    bookings={pendingBookings}
    onApprove={handleApprove}
    onReject={handleReject}
    sortable
    filterable
  />
</AdminDashboard>
```

### 9.2 データ管理インターフェース

**推奨事項**:
- 効率的なバルク操作
- インラインエディティング
- 高度なフィルタリングとソート
- データエクスポート機能

**実装ガイドライン**:
```jsx
<DataTable
  data={usersData}
  columns={[
    { field: 'name', header: '氏名', sortable: true, filterable: true },
    { field: 'email', header: 'メール', sortable: true, filterable: true },
    { field: 'bookingCount', header: '予約数', sortable: true },
    { field: 'lastActive', header: '最終利用日', sortable: true, 
      render: (date) => formatDate(date) }
  ]}
  pagination={{
    pageSize: 25,
    pageSizeOptions: [10, 25, 50, 100]
  }}
  bulkActions={[
    { label: 'メール送信', action: sendEmailToSelected },
    { label: '無効化', action: deactivateSelected }
  ]}
  exportOptions={['csv', 'excel']}
/>
```

## 10. パフォーマンス最適化のUI/UXアプローチ

### 10.1 パフォーマンス測定指標

**Core Web Vitals**:
- LCP (Largest Contentful Paint): 2.5秒以内
- FID (First Input Delay): 100ミリ秒以内
- CLS (Cumulative Layout Shift): 0.1以下

**アプリケーション固有のメトリクス**:
- TTI (Time to Interactive): 3.5秒以内
- 予約フォーム送信～確認画面表示: 1秒以内
- カレンダー表示速度: 1.5秒以内

### 10.2 UI/UXパフォーマンス戦略

1. **知覚パフォーマンスの向上**
   - スケルトンスクリーンの活用
   - プログレッシブレンダリング
   - 予測アクションのプリロード

2. **インタラクション最適化**
   - イベントの間引き（デバウンス/スロットル）
   - 仮想リスト/テーブルの活用
   - 遅延読み込みと遅延レンダリング

3. **サーバレス最適化UXパターン**
   - Lambda関数実行時間に合わせた待機UI
   - バックグラウンド処理への移行
   - 楽観的UI更新とバックグラウンド同期

**実装ガイドライン**:
```jsx
// バーチャルリストの実装例
<VirtualizedList
  itemCount={bookings.length}
  itemSize={80}
  height={600}
  width="100%"
  overscanCount={5}
  renderItem={({ index, style }) => (
    <BookingListItem
      key={bookings[index].id}
      booking={bookings[index]}
      style={style}
    />
  )}
/>

// 楽観的UI更新の例
const approveBooking = async (bookingId) => {
  // 楽観的に状態を更新
  updateBookingState(bookingId, 'approved');
  
  try {
    // 実際のAPI呼び出し
    await approveBookingApi(bookingId);
  } catch (error) {
    // エラー時に元の状態に戻す
    updateBookingState(bookingId, 'pending');
    showErrorNotification('予約の承認に失敗しました');
  }
};
```

## 11. サーバレスアプリケーション特有の実装パターン

### 11.1 状態同期パターン

1. **楽観的UI更新**
   - ユーザーアクションに対する即時UI応答
   - バックグラウンドでAPI通信
   - 失敗時の適切なロールバック

2. **イベントソーシング**
   - ユーザーアクションをイベントとして記録
   - 状態の再構築は履歴から実行
   - オフライン操作のキューイング

3. **分散状態管理**
   - ローカルステートとサーバー状態の分離
   - サーバーステートの適切なキャッシュ管理
   - 競合解決戦略の実装

### 11.2 ネットワーク状態管理

1. **オフライン対応**
   - オフライン状態の明示的な視覚化
   - オフライン操作のキューイング
   - 再接続時の自動同期

2. **接続品質に応じた適応**
   - 低帯域幅検出と機能調整
   - 画像やメディア品質の動的調整
   - 重要操作の優先度付け

3. **リトライとエラーリカバリー**
   - 指数バックオフを使用した自動リトライ
   - 部分的な成功状態の保存
   - ユーザー主導のリカバリーオプション

**実装ガイドライン**:
```jsx
// オフライン検出と操作キューイングの例
const BookingAction = ({ booking, onApprove }) => {
  const { isOnline } = useNetwork();
  const { addToQueue } = useActionQueue();
  
  const handleApprove = () => {
    if (isOnline) {
      onApprove(booking.id);
    } else {
      addToQueue({
        type: 'APPROVE_BOOKING',
        payload: { bookingId: booking.id }
      });
      showNotification('ネットワーク接続時に予約が承認されます');
    }
  };
  
  return (
    <Button 
      onClick={handleApprove}
      icon={isOnline ? 'approve' : 'queue'}
    >
      承認
    </Button>
  );
};
```

### 11.3 キャッシュとデータ永続化

1. **多層キャッシュ戦略**
   - メモリキャッシュ：頻繁にアクセスするデータ
   - IndexedDB：大量データの永続化
   - LocalStorage：設定とUIステート

2. **キャッシュ鮮度管理**
   - TTLベースのキャッシュ管理
   - バックグラウンド再検証
   - ユー
