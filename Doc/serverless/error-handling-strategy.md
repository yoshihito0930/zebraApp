# エラーハンドリング戦略

## 1. はじめに

本ドキュメントは、撮影スタジオ予約管理アプリケーションのサーバレス環境におけるエラーハンドリング戦略を定義します。サーバレスアーキテクチャ特有の考慮事項を含め、一貫性のある堅牢なエラー処理の枠組みを提供します。

### 1.1 目的

エラーハンドリング戦略の主要な目的は以下の通りです：

1. **一貫性の確保**: アプリケーション全体で統一されたエラー処理アプローチを定義
2. **耐障害性の向上**: システムの回復力と信頼性の向上
3. **デバッグ容易性**: エラー発生時の迅速な問題特定と解決の促進
4. **ユーザー体験の向上**: エンドユーザーへの適切なフィードバックの提供
5. **運用効率**: エラー検出と対応プロセスの自動化

### 1.2 スコープ

本戦略は以下のコンポーネントを対象とします：

- AWS Lambda関数内のエラー処理
- API Gateway統合
- DynamoDBとの相互作用
- サービス間通信
- フロントエンドアプリケーションとのエラー連携
- SES/SNSを使用した通知システム
- EventBridgeによるスケジュールタスク

## 2. エラー分類体系

エラーは以下のカテゴリに分類し、それぞれに対する適切な処理戦略を定義します。

### 2.1 エラーカテゴリ

#### 2.1.1 技術的エラー

| カテゴリ | 説明 | 例 |
|--------|-----|-----|
| **基盤エラー** | AWSインフラストラクチャに関連するエラー | Lambda実行タイムアウト、メモリ不足 |
| **ネットワークエラー** | 接続の問題やサービス間通信の失敗 | DNS解決失敗、サービス間タイムアウト |
| **データストアエラー** | DB操作に関連するエラー | DynamoDBスロットリング、条件チェック失敗 |
| **統合エラー** | 外部サービスとの統合に関連するエラー | SES送信制限超過、API制限到達 |

#### 2.1.2 ビジネスロジックエラー

| カテゴリ | 説明 | 例 |
|--------|-----|-----|
| **検証エラー** | 入力データの検証に関連するエラー | 無効なメールフォーマット、不足している必須フィールド |
| **権限エラー** | 認証と承認に関連するエラー | 無効なトークン、不十分な権限 |
| **ビジネスルールエラー** | ビジネスロジックの制約違反 | 重複予約、キャンセル期限超過 |
| **状態エラー** | 予期しないまたは無効なリソース状態 | 既にキャンセル済みの予約を更新しようとする |

#### 2.1.3 運用エラー

| カテゴリ | 説明 | 例 |
|--------|-----|-----|
| **構成エラー** | システム設定に関連する問題 | 無効な環境変数、IAM権限不足 |
| **限界値エラー** | サービス制限やクォータに関連するエラー | Lambda同時実行数超過、DynamoDB容量不足 |
| **レートリミットエラー** | スロットリングとレート制限に関連するエラー | API Gatewayスロットリング、Lambda同時実行制限 |

### 2.2 エラーの重大度

| 重大度 | 説明 | オペレーション影響 | 通知戦略 |
|-------|------|----------------|----------|
| **CRITICAL** | システム全体の機能に影響する致命的なエラー | サービス停止またはコア機能の完全な損失 | 即時アラート (24/7オンコール) |
| **HIGH** | 機能に重大な影響を与えるがシステム全体の停止には至らないエラー | 主要機能の大幅な機能低下 | 即時アラート (営業時間内) |
| **MEDIUM** | 一部の機能に影響するが回避策のあるエラー | 特定の機能の制限付き使用または部分的な機能低下 | 集約通知 (日次) |
| **LOW** | システム機能に最小限の影響を与えるエラー | 目立たない問題、パフォーマンス低下 | ログ記録のみ、定期レポート |

## 3. Lambda関数のエラーハンドリング

### 3.1 エラーハンドリングパターン

#### 3.1.1 包括的なエラーラッパーパターン

すべてのLambdaハンドラー関数は、標準化されたエラー処理ラッパーでラップします：

```go
func Handler(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
    // エラーハンドリングラッパーを使用
    return errorWrapper(ctx, event, func(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
        // ビジネスロジック実装
        // ...
        return response, nil
    })
}

func errorWrapper(ctx context.Context, event events.APIGatewayProxyRequest, handler LambdaHandler) (events.APIGatewayProxyResponse, error) {
    requestID := ctx.Value(lambdacontext.RequestIDKey).(string)
    logger := log.With().
        Str("requestId", requestID).
        Str("path", event.Path).
        Str("method", event.HTTPMethod).
        Logger()
    
    ctx = logger.WithContext(ctx)
    
    defer func() {
        if r := recover(); r != nil {
            stackTrace := debug.Stack()
            logger.Error().
                Interface("panic", r).
                Bytes("stackTrace", stackTrace).
                Msg("Lambda関数でパニックが発生しました")
            
            // メトリクス記録
            recordErrorMetric("PanicError", event.Path)
            
            // 予期しないエラーの通知
            notifyUnexpectedError(ctx, r, string(stackTrace))
        }
    }()

    // リクエストログ
    logger.Info().Msg("リクエスト処理開始")
    
    start := time.Now()
    response, err := handler(ctx, event)
    duration := time.Since(start)
    
    // パフォーマンスメトリクス記録
    recordDurationMetric(event.Path, duration.Milliseconds())
    
    if err != nil {
        logger.Error().Err(err).Msg("リクエスト処理中にエラーが発生しました")
        return handleError(ctx, err)
    }
    
    logger.Info().
        Int("statusCode", response.StatusCode).
        Dur("duration", duration).
        Msg("リクエスト処理完了")
    
    return response, nil
}
```

#### 3.1.2 カスタムエラー型の定義

システム全体で一貫したエラー処理のために、カスタムエラー型を定義します：

```go
// AppError はアプリケーション固有のエラー型です
type AppError struct {
    Code       string                 `json:"code"`
    Message    string                 `json:"message"`
    Details    map[string]interface{} `json:"details,omitempty"`
    HTTPStatus int                    `json:"-"`
    Internal   error                  `json:"-"`
    Severity   string                 `json:"-"`
}

func (e *AppError) Error() string {
    return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// NewValidationError は入力検証エラーを作成します
func NewValidationError(message string, details map[string]interface{}) *AppError {
    return &AppError{
        Code:       "VALIDATION_ERROR",
        Message:    message,
        Details:    details,
        HTTPStatus: http.StatusBadRequest,
        Severity:   "LOW",
    }
}

// NewAuthorizationError は認証・認可エラーを作成します
func NewAuthorizationError(message string) *AppError {
    return &AppError{
        Code:       "AUTHORIZATION_ERROR",
        Message:    message,
        HTTPStatus: http.StatusForbidden,
        Severity:   "MEDIUM",
    }
}

// NewNotFoundError はリソース未検出エラーを作成します
func NewNotFoundError(resourceType string, identifier string) *AppError {
    return &AppError{
        Code:       "NOT_FOUND",
        Message:    fmt.Sprintf("%sが見つかりません", resourceType),
        Details:    map[string]interface{}{"identifier": identifier},
        HTTPStatus: http.StatusNotFound,
        Severity:   "LOW",
    }
}

// NewSystemError はシステムエラーを作成します
func NewSystemError(message string, internal error) *AppError {
    return &AppError{
        Code:       "SYSTEM_ERROR",
        Message:    message,
        Internal:   internal,
        HTTPStatus: http.StatusInternalServerError,
        Severity:   "HIGH",
    }
}

// NewServiceUnavailableError は一時的なサービス利用不可エラーを作成します
func NewServiceUnavailableError(message string, internal error) *AppError {
    return &AppError{
        Code:       "SERVICE_UNAVAILABLE",
        Message:    message,
        Internal:   internal,
        HTTPStatus: http.StatusServiceUnavailable,
        Severity:   "HIGH",
    }
}
```

### 3.2 一般的なエラー処理パターン

#### 3.2.1 DynamoDBエラー処理

```go
func getBooking(ctx context.Context, bookingID string) (*Booking, error) {
    input := &dynamodb.GetItemInput{
        TableName: aws.String(bookingsTable),
        Key: map[string]*dynamodb.AttributeValue{
            "PK": {S: aws.String("BOOKING#" + bookingID)},
        },
    }
    
    result, err := dynamoClient.GetItemWithContext(ctx, input)
    if err != nil {
        var awsErr awserr.Error
        if errors.As(err, &awsErr) {
            switch awsErr.Code() {
            case dynamodb.ErrCodeProvisionedThroughputExceededException, 
                 dynamodb.ErrCodeRequestLimitExceeded:
                return nil, NewServiceUnavailableError("データベースの容量が上限に達しています。しばらく経ってから再試行してください", err)
            case dynamodb.ErrCodeResourceNotFoundException:
                return nil, NewSystemError("設定エラー: テーブルが存在しません", err)
            case "ValidationException":
                return nil, NewSystemError("DynamoDB検証エラー", err)
            }
        }
        // その他のAWSエラー
        return nil, NewSystemError("データベースアクセスエラー", err)
    }
    
    if len(result.Item) == 0 {
        return nil, NewNotFoundError("予約", bookingID)
    }
    
    booking := &Booking{}
    if err := dynamodbattribute.UnmarshalMap(result.Item, booking); err != nil {
        return nil, NewSystemError("データマッピングエラー", err)
    }
    
    return booking, nil
}
```

#### 3.2.2 バッチ操作エラー処理

```go
func batchGetBookings(ctx context.Context, bookingIDs []string) (map[string]*Booking, []string, error) {
    if len(bookingIDs) == 0 {
        return make(map[string]*Booking), nil, nil
    }
    
    keys := make([]map[string]*dynamodb.AttributeValue, 0, len(bookingIDs))
    for _, id := range bookingIDs {
        keys = append(keys, map[string]*dynamodb.AttributeValue{
            "PK": {S: aws.String("BOOKING#" + id)},
        })
    }
    
    input := &dynamodb.BatchGetItemInput{
        RequestItems: map[string]*dynamodb.KeysAndAttributes{
            bookingsTable: {
                Keys: keys,
            },
        },
    }
    
    bookings := make(map[string]*Booking)
    unprocessedIDs := make([]string, 0)
    
    backoff := exponentialBackoff{
        baseDelay: 100 * time.Millisecond,
        maxDelay:  2 * time.Second,
        maxRetries: 3,
    }
    
    for len(input.RequestItems) > 0 && backoff.attempts < backoff.maxRetries {
        if backoff.attempts > 0 {
            delay := backoff.getNextDelay()
            time.Sleep(delay)
            log.Info().Msgf("バッチ取得再試行 #%d (遅延: %v)", backoff.attempts, delay)
        }
        
        result, err := dynamoClient.BatchGetItemWithContext(ctx, input)
        backoff.attempts++
        
        if err != nil {
            var awsErr awserr.Error
            if errors.As(err, &awsErr) {
                if awsErr.Code() == dynamodb.ErrCodeProvisionedThroughputExceededException {
                    continue // 再試行
                }
            }
            return bookings, bookingIDs, NewSystemError("バッチ取得エラー", err)
        }
        
        // 結果の処理
        if items, ok := result.Responses[bookingsTable]; ok {
            for _, item := range items {
                booking := &Booking{}
                if err := dynamodbattribute.UnmarshalMap(item, booking); err != nil {
                    log.Error().Err(err).Msg("アイテムのマッピングエラー")
                    continue
                }
                bookingID := strings.TrimPrefix(booking.PK, "BOOKING#")
                bookings[bookingID] = booking
            }
        }
        
        // 未処理キーの確認と更新
        input.RequestItems = result.UnprocessedKeys
    }
    
    // 未処理の予約IDを収集
    if len(input.RequestItems) > 0 {
        if unprocessedKeys, ok := input.RequestItems[bookingsTable]; ok {
            for _, key := range unprocessedKeys.Keys {
                pkValue := *key["PK"].S
                bookingID := strings.TrimPrefix(pkValue, "BOOKING#")
                unprocessedIDs = append(unprocessedIDs, bookingID)
            }
        }
    }
    
    return bookings, unprocessedIDs, nil
}
```

### 3.3 リトライ戦略

#### 3.3.1 指数バックオフ

一時的なエラーに対する再試行ロジックを実装します：

```go
type exponentialBackoff struct {
    baseDelay  time.Duration
    maxDelay   time.Duration
    attempts   int
    maxRetries int
}

func (b *exponentialBackoff) getNextDelay() time.Duration {
    delay := b.baseDelay * time.Duration(math.Pow(2, float64(b.attempts)))
    if delay > b.maxDelay {
        delay = b.maxDelay
    }
    
    // ジッターを追加して複数のリクエストが同時に再試行することを回避
    jitter := time.Duration(rand.Int63n(int64(delay) / 2))
    delay = delay - (delay / 2) + jitter
    
    return delay
}

func retryOperation(ctx context.Context, operation func() error) error {
    backoff := exponentialBackoff{
        baseDelay:  100 * time.Millisecond,
        maxDelay:   30 * time.Second,
        maxRetries: 5,
    }
    
    var err error
    for backoff.attempts <= backoff.maxRetries {
        if backoff.attempts > 0 {
            delay := backoff.getNextDelay()
            log.Info().
                Int("attempt", backoff.attempts).
                Dur("delay", delay).
                Msg("操作を再試行します")
                
            select {
            case <-time.After(delay):
                // 遅延後に続行
            case <-ctx.Done():
                return NewSystemError("コンテキストがキャンセルされました", ctx.Err())
            }
        }
        
        err = operation()
        backoff.attempts++
        
        if err == nil {
            return nil // 成功
        }
        
        // 一時的なエラーかどうかを確認
        if isTemporaryError(err) {
            continue // 再試行
        }
        
        // 永続的なエラーは即時失敗
        return err
    }
    
    return NewServiceUnavailableError("最大再試行回数を超えました", err)
}

func isTemporaryError(err error) bool {
    var appErr *AppError
    if errors.As(err, &appErr) {
        // アプリケーションエラーの場合、コードをチェック
        switch appErr.Code {
        case "RATE_LIMIT_EXCEEDED", "SERVICE_UNAVAILABLE", "CONNECTION_ERROR":
            return true
        default:
            return false
        }
    }
    
    // AWSエラーの確認
    var awsErr awserr.Error
    if errors.As(err, &awsErr) {
        switch awsErr.Code() {
        case 
            dynamodb.ErrCodeProvisionedThroughputExceededException,
            dynamodb.ErrCodeRequestLimitExceeded,
            "ThrottlingException",
            "TooManyRequestsException",
            "InternalServerError",
            "ServiceUnavailable":
            return true
        }
    }
    
    // HTTPエラーの確認
    var netErr net.Error
    if errors.As(err, &netErr) && netErr.Timeout() {
        return true
    }
    
    return false
}
```

#### 3.3.2 サーキットブレーカー

連続的なエラーを検出し、一時的にリクエストをブロックするサーキットブレーカーパターン：

```go
type CircuitBreaker struct {
    mu              sync.RWMutex
    name            string
    state           string
    failureCount    int
    failureThreshold int
    resetTimeout    time.Duration
    lastFailureTime time.Time
    metrics         *CircuitMetrics
}

const (
    StateClosed   = "closed"   // 正常動作、リクエスト許可
    StateOpen     = "open"     // 回路遮断、リクエスト拒否
    StateHalfOpen = "half_open" // テストリクエスト許可
)

func NewCircuitBreaker(name string, failureThreshold int, resetTimeout time.Duration) *CircuitBreaker {
    return &CircuitBreaker{
        name:            name,
        state:           StateClosed,
        failureThreshold: failureThreshold,
        resetTimeout:    resetTimeout,
        metrics:         newCircuitMetrics(name),
    }
}

func (cb *CircuitBreaker) Execute(ctx context.Context, operation func() error) error {
    if !cb.allowRequest() {
        cb.metrics.recordRejected()
        return NewServiceUnavailableError(
            "サービスが一時的に利用できません。しばらくしてから再試行してください",
            fmt.Errorf("circuit breaker %s is open", cb.name),
        )
    }
    
    err := operation()
    cb.recordResult(err)
    return err
}

func (cb *CircuitBreaker) allowRequest() bool {
    cb.mu.RLock()
    defer cb.mu.RUnlock()
    
    if cb.state == StateClosed {
        return true
    }
    
    if cb.state == StateOpen {
        // 回路がオープンの場合、resetTimeoutが経過したかどうかをチェック
        if time.Since(cb.lastFailureTime) > cb.resetTimeout {
            // ハーフオープン状態に遷移するには書き込みロックが必要
            cb.mu.RUnlock()
            cb.mu.Lock()
            defer cb.mu.Unlock()
            
            // 状態が変更されていないことを確認
            if cb.state == StateOpen && time.Since(cb.lastFailureTime) > cb.resetTimeout {
                cb.state = StateHalfOpen
                cb.metrics.recordStateChange(StateHalfOpen)
                log.Info().Str("circuit", cb.name).Msg("サーキットブレーカーがハーフオープン状態になりました")
                return true
            }
            return false
        }
        return false
    }
    
    // ハーフオープン状態では1つのリクエストのみを許可
    return true
}

func (cb *CircuitBreaker) recordResult(err error) {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    
    if err == nil {
        cb.metrics.recordSuccess()
        
        if cb.state == StateHalfOpen {
            cb.state = StateClosed
            cb.failureCount = 0
            cb.metrics.recordStateChange(StateClosed)
            log.Info().Str("circuit", cb.name).Msg("サーキットブレーカーがクローズ状態になりました")
        }
        return
    }
    
    cb.metrics.recordFailure()
    cb.lastFailureTime = time.Now()
    
    if cb.state == StateHalfOpen || cb.state == StateClosed {
        cb.failureCount++
        if cb.failureCount >= cb.failureThreshold {
            cb.state = StateOpen
            cb.metrics.recordStateChange(StateOpen)
            log.Warn().
                Str("circuit", cb.name).
                Int("failures", cb.failureCount).
                Dur("resetTimeout", cb.resetTimeout).
                Msg("サーキットブレーカーがオープン状態になりました")
        }
    }
}
```

## 4. API Gateway応答とHTTPエラー

### 4.1 HTTPエラーレスポンスの標準化

API Gateway経由で返すエラーレスポンスの標準化：

```go
func handleError(ctx context.Context, err error) (events.APIGatewayProxyResponse, error) {
    requestID := ctx.Value(lambdacontext.RequestIDKey).(string)
    
    var appErr *AppError
    var statusCode int
    var errorResponse map[string]interface{}
    
    if errors.As(err, &appErr) {
        // アプリケーション固有のエラー
        statusCode = appErr.HTTPStatus
        errorResponse = map[string]interface{}{
            "code":      appErr.Code,
            "message":   appErr.Message,
            "requestId": requestID,
        }
        
        if appErr.Details != nil {
            errorResponse["details"] = appErr.Details
        }
        
        // 内部エラーをログに記録
        if appErr.Internal != nil {
            log.Error().
                Err(appErr.Internal).
                Str("errorCode", appErr.Code).
                Str("severity", appErr.Severity).
                Msg("内部エラーの詳細")
        }
        
        // 重大度に基づく追加アクション
        switch appErr.Severity {
        case "HIGH", "CRITICAL":
            notifyOperationalError(ctx, appErr)
        }
    } else {
        // 未分類のエラー
        statusCode = http.StatusInternalServerError
        errorResponse = map[string]interface{}{
            "code":      "INTERNAL_SERVER_ERROR",
            "message":   "予期しないエラーが発生しました",
            "requestId": requestID,
        }
        
        log.Error().Err(err).Msg("未分類のエラーが発生しました")
        notifyUnexpectedError(ctx, err, "")
    }
    
    // メトリクス記録
    recordErrorMetric(errorResponse["code"].(string), "")
    
    responseBody, _ := json.Marshal(errorResponse)
    return events.APIGatewayProxyResponse{
        StatusCode: statusCode,
        Headers: map[string]string{
            "Content-Type": "application/json",
        },
        Body: string(responseBody),
    }, nil
}
```

### 4.2 エラーのHTTPステータスコードマッピング

| エラーカテゴリ | HTTPステータスコード | 例 |
|-------------|-------------------|------|
| **入力検証エラー** | 400 Bad Request | 無効なパラメータ、必須フィールドの欠如 |
| **認証エラー** | 401 Unauthorized | 無効なJWTトークン、期限切れトークン |
| **認可エラー** | 403 Forbidden | 必要な権限がない |
| **リソース未検出** | 404 Not Found | 指定されたIDのリソースが存在しない |
| **競合エラー** | 409 Conflict | 重複予約、楽観的ロック違反 |
| **レート制限** | 429 Too Many Requests | APIレート制限超過、DynamoDBスロットリング |
| **サーバエラー** | 500 Internal Server Error | 未処理の例外、プログラミングエラー |
| **サービス利用不可** | 503 Service Unavailable | 一時的なサービス障害、サーキットブレーカーオープン |

## 5. フロントエンドとのエラー連携

### 5.1 フロントエンドエラーハンドリング

フロントエンドでのエラー処理の標準化：

```typescript
// APIクライアント層のエラー処理
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  timeout: 10000,
});

// レスポンスインターセプターでエラーを標準化
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const standardError: AppError = {
      code: 'UNKNOWN_ERROR',
      message: '予期しないエラーが発生しました',
      requestId: '',
      details: {},
    };
    
    if (error.response) {
      // サーバーからのエラーレスポンス
      const { data, status } = error.response;
      
      // API標準形式のエラーレスポンス
      if (data && data.code) {
        standardError.code = data.code;
        standardError.message = data.message || standardError.message;
        standardError.requestId = data.requestId || '';
        standardError.details = data.details || {};
        standardError.status = status;
      } else {
        // 非標準エラーレスポンスの場合
        standardError.code = `HTTP_ERROR_${status}`;
        standardError.message = data?.message || getDefaultMessageForStatus(status);
        standardError.status = status;
      }
    } else if (error.request) {
      // リクエストは行われたがレスポンスなし
      standardError.code = 'NETWORK_ERROR';
      standardError.message = 'サーバーに接続できませんでした';
      
      // オフライン状態の検出
      if (!navigator.onLine) {
        standardError.code = 'OFFLINE';
        standardError.message = 'インターネット接続がありません';
      }
    } else {
      // リクエスト設定時のエラー
      standardError.code = 'REQUEST_SETUP_ERROR';
      standardError.message = error.message || standardError.message;
    }
    
    // エラーログ記録
    logError(standardError);
    
    // 必要に応じて特定のエラーを監視サービスに報告
    if (shouldReportError(standardError)) {
      reportErrorToMonitoring(standardError);
    }
    
    return Promise.reject(standardError);
  }
);

// エラーコードに基づくユーザーメッセージの取得
const getUserFriendlyMessage = (error: AppError): string => {
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return '入力内容に問題
