# 撮影スタジオ予約管理アプリケーション システムアーキテクチャ図

## 1. 全体システム構成図

```mermaid
graph TD
    subgraph "クライアント層"
        A[Webブラウザ]
        B[モバイルブラウザ]
    end
    
    subgraph "プレゼンテーション層"
        C[フロントエンド SPA - React/Next.js]
        C1[カレンダーコンポーネント]
        C2[予約フォーム]
        C3[管理画面]
        C4[通知表示]
    end
    
    subgraph "API層"
        D[API Gateway]
        D1[認証Lambda]
        D2[予約Lambda]
        D3[カレンダーLambda]
        D4[通知Lambda]
        D5[管理Lambda]
        D6[ユーザーLambda]
    end
    
    subgraph "データ層"
        F1[(DynamoDB)]
    end
    
    subgraph "外部サービス"
        G1[SES - Eメールサービス]
        G2[S3 - クラウドストレージ]
    end
    
    subgraph "バックグラウンド処理"
        H1[EventBridge]
        H2[SQS/SNS]
    end
    
    A --> C
    B --> C
    C --> C1
    C --> C2
    C --> C3
    C --> C4
    C --> D
    
    D --> D1
    D --> D2
    D --> D3
    D --> D4
    D --> D5
    D --> D6
    
    D1 --> F1
    D2 --> F1
    D3 --> F1
    D4 --> F1
    D5 --> F1
    D6 --> F1
    
    D4 --> G1
    D5 --> G2
    
    H1 --> D2
    H1 --> D4
    H2 --> D4
    
    classDef frontend fill:#f9f,stroke:#333,stroke-width:1px;
    classDef backend fill:#bbf,stroke:#333,stroke-width:1px;
    classDef database fill:#bfb,stroke:#333,stroke-width:1px;
    classDef service fill:#fbb,stroke:#333,stroke-width:1px;
    
    class A,B frontend;
    class C,C1,C2,C3,C4 frontend;
    class D,D1,D2,D3,D4,D5,D6 backend;
    class F1 database;
    class G1,G2,H1,H2 service;
```

## 2. 予約フロー図

```mermaid
sequenceDiagram
    participant User as 利用者
    participant Frontend as フロントエンド
    participant API as API Gateway
    participant Lambda as Lambdaファンクション
    participant DB as DynamoDB
    participant Admin as 管理者
    participant Notifier as SNS通知サービス
    
    User->>Frontend: ログイン
    Frontend->>API: 認証リクエスト
    API->>Lambda: 認証Lambda呼び出し
    Lambda->>DB: ユーザー検証
    DB-->>Lambda: 認証結果
    Lambda-->>API: 処理結果返却
    API-->>Frontend: 認証トークン
    
    User->>Frontend: カレンダー閲覧
    Frontend->>API: 空き状況取得
    API->>Lambda: カレンダーLambda呼び出し
    Lambda->>DB: 予約データ照会
    DB-->>Lambda: 予約データ
    Lambda-->>API: 処理結果返却
    API-->>Frontend: カレンダーデータ
    Frontend-->>User: 空き状況表示
    
    User->>Frontend: 日時選択と予約情報入力
    Frontend->>API: 予約申請送信
    API->>Lambda: 予約Lambda呼び出し
    Lambda->>DB: 予約情報保存
    DB-->>Lambda: 保存結果
    Lambda->>Notifier: 管理者へ通知
    Notifier->>Admin: 予約申請通知
    Lambda-->>API: 処理結果返却
    API-->>Frontend: 予約申請結果
    Frontend-->>User: 申請完了表示
    
    Admin->>API: 予約承認/拒否
    API->>Lambda: 管理Lambda呼び出し
    Lambda->>DB: 予約ステータス更新
    DB-->>Lambda: 更新結果
    Lambda->>Notifier: 利用者へ通知
    Notifier->>User: 承認/拒否通知
    Lambda-->>API: 処理結果返却
    API-->>Admin: 承認/拒否完了表示
    
    note over User,Admin: 仮予約期限前
    
    Notifier->>User: 確定リマインダー
    User->>Frontend: 本予約へ変更リクエスト
    Frontend->>API: 予約タイプ更新
    API->>Lambda: 予約Lambda呼び出し
    Lambda->>DB: 予約タイプ変更
    DB-->>Lambda: 更新結果
    Lambda->>Notifier: 管理者へ通知
    Notifier->>Admin: 予約タイプ変更通知
    Lambda-->>API: 処理結果返却
    API-->>Frontend: 変更結果
    Frontend-->>User: 本予約確定表示
```

## 3. DynamoDBデータモデル設計

### 主要テーブル構成

```mermaid
graph TD
    subgraph "Users テーブル"
        U1["PK: USER#&lt;userId&gt;"]
        U2["属性: email, hashedPassword, fullName,<br>address, phone, isAdmin, <br>totalUsageMinutes, bookingCount, <br>createdAt, updatedAt"]
    end
    
    subgraph "Bookings テーブル"
        B1["PK: BOOKING#&lt;bookingId&gt;"]
        B2["SK: USER#&lt;userId&gt;"]
        B3["GSI1-PK: USER#&lt;userId&gt;"]
        B4["GSI1-SK: BOOKING#&lt;createdAt&gt;"]
        B5["GSI2-PK: STATUS#&lt;status&gt;"]
        B6["GSI2-SK: &lt;startTime&gt;"]
        B7["属性: startTime, endTime, purpose, <br>status, bookingType, peopleCount, <br>confirmationDeadline, options,<br>cancellationFeePercent, etc"]
    end
    
    subgraph "Calendar テーブル"
        C1["PK: DATE#&lt;YYYY-MM-DD&gt;"]
        C2["SK: TIME#&lt;startTime&gt;#&lt;endTime&gt;"]
        C3["属性: bookingId, status, bookingType"]
    end
    
    subgraph "Notifications テーブル"
        N1["PK: USER#&lt;userId&gt;"]
        N2["SK: NOTIFICATION#&lt;timestamp&gt;"]
        N3["属性: title, content, type, isRead, <br>relatedEntityId, createdAt, readAt"]
    end
    
    subgraph "TermsOfService テーブル"
        T1["PK: TERMS#&lt;version&gt;"]
        T2["属性: content, effectiveDate"]
    end
    
    subgraph "UserAgreements テーブル"
        A1["PK: USER#&lt;userId&gt;"]
        A2["SK: TERMS#&lt;version&gt;"]
        A3["属性: agreedAt"]
    end
    
    U1 --> B3
    B1 --> C3
    U1 --> N1
    U1 --> A1
    T1 --> A2
    
    classDef table fill:#f9f,stroke:#333,stroke-width:1px;
    
    class U1,U2,B1,B2,B3,B4,B5,B6,B7,C1,C2,C3,N1,N2,N3,T1,T2,A1,A2,A3 table;
```

### アクセスパターン

1. ユーザー情報取得: `Users` テーブル - PK で GetItem
2. ユーザー予約一覧取得: `Bookings` テーブル - GSI1 で Query (PK = USER#userId)
3. 日付別の空き状況確認: `Calendar` テーブル - PK で Query (PK = DATE#YYYY-MM-DD)
4. 承認待ち予約一覧取得: `Bookings` テーブル - GSI2 で Query (PK = STATUS#pending)
5. ユーザー通知取得: `Notifications` テーブル - PK で Query (PK = USER#userId)

## 4. デプロイ・運用アーキテクチャ（AWS サーバレスとIaC）

本システムは、AWSのサーバレスサービス群を全面的に採用し、インフラストラクチャのプロビジョニングと管理はIaC（Infrastructure as Code）によって自動化されます。CI/CDパイプラインを通じて、アプリケーションコードとインフラ定義の変更が、テスト、ステージング、本番環境へ安全かつ迅速にデプロイされます。

```mermaid
graph TD
    subgraph "開発・CI/CD"
        Dev[開発者] --> Git[Gitリポジトリ]
        Git --> CI_CD[CI/CDパイプライン<br>(GitHub Actions)]
        subgraph "IaCによるプロビジョニング"
            CI_CD --> IaC{IaC<br>(CloudFormation/Terraform)}
        end
    end

    subgraph "AWS Cloud"
        subgraph "フロントエンド"
            B[CloudFront]
            C[S3 - 静的ファイル]
        end
        
        subgraph "バックエンド"
            D[API Gateway]
            E[Lambda Functions]
        end
        
        subgraph "データストア"
            G[DynamoDB]
        end
        
        subgraph "ストレージ/メッセージング"
            I[S3 - ファイルストレージ]
            J[SQS - メッセージキュー]
        end
        
        subgraph "メール/通知"
            K[SES - メール送信]
            L[SNS - 通知]
            EV[EventBridge]
        end
        
        subgraph "監視/ロギング"
            M[CloudWatch]
            N[X-Ray]
        end
    end
    
    subgraph "クライアント"
        A[Web/モバイルブラウザ]
    end

    IaC --> B; IaC --> C; IaC --> D; IaC --> E; IaC --> G;
    IaC --> I; IaC --> J; IaC --> K; IaC --> L; IaC --> EV;
    IaC --> M; IaC --> N;

    CI_CD -- "フロントエンドデプロイ" --> C
    CI_CD -- "バックエンドデプロイ" --> E
    
    A --> B
    B --> C
    A --> D
    D --> E
    E --> G
    E --> I
    E --> J
    J --> E
    E --> K
    E --> L
    EV --> E
    E --> M
    E --> N
    
    classDef cicd fill:#d4e1f5,stroke:#333,stroke-width:1px;
    classDef client fill:#f9f,stroke:#333,stroke-width:1px;
    classDef frontend fill:#bbf,stroke:#333,stroke-width:1px;
    classDef backend fill:#bfb,stroke:#333,stroke-width:1px;
    classDef data fill:#fbb,stroke:#333,stroke-width:1px;
    classDef monitoring fill:#ffb,stroke:#333,stroke-width:1px;

    class Dev,Git,CI_CD,IaC cicd;
    class A client;
    class B,C frontend;
    class D,E,J,K,L,EV backend;
    class G,I data;
    class M,N monitoring;
```

## 5. ユーザーロールと権限

```mermaid
graph TD
    A["ユーザー"] --> B["未認証ユーザー"]
    A --> C["認証済みユーザー"]
    C --> D["一般利用者"]
    C --> E["管理者"]
    
    subgraph "未認証ユーザー権限"
        B1["ログイン"]
        B2["アカウント登録"]
        B3["パスワードリセット"]
    end
    
    subgraph "一般利用者権限"
        D1["カレンダー閲覧"]
        D2["予約申請"]
        D3["自分の予約管理"]
        D4["プロフィール管理"]
        D5["通知確認"]
    end
    
    subgraph "管理者権限"
        E1["全予約管理"]
        E2["予約承認/拒否"]
        E3["ユーザー管理"]
        E4["統計/レポート閲覧"]
        E5["システム設定"]
        E6["通知管理"]
        E7["利用規約管理"]
    end
    
    B --> B1
    B --> B2
    B --> B3
    
    D --> D1
    D --> D2
    D --> D3
    D --> D4
    D --> D5
    
    E --> D1
    E --> D2
    E --> D3
    E --> D4
    E --> D5
    E --> E1
    E --> E2
    E --> E3
    E --> E4
    E --> E5
    E --> E6
    E --> E7
    
    classDef userType fill:#f9f,stroke:#333,stroke-width:1px;
    classDef guestPerm fill:#ddf,stroke:#333,stroke-width:1px;
    classDef userPerm fill:#bfb,stroke:#333,stroke-width:1px;
    classDef adminPerm fill:#fbb,stroke:#333,stroke-width:1px;
    
    class A,B,C,D,E userType;
    class B1,B2,B3 guestPerm;
    class D1,D2,D3,D4,D5 userPerm;
    class E1,E2,E3,E4,E5,E6,E7 adminPerm;
