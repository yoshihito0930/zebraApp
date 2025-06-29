package main

import (
	"fmt"
	"log"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/zebraApp/internal/config"
)

func main() {
	// 環境変数から設定を読み込む
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("設定ファイルの読み込みに失敗しました: %v", err)
	}

	// Echoインスタンスを作成
	e := echo.New()

	// ミドルウェアの設定
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// ルートの設定
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(200, map[string]string{
			"status": "ok",
		})
	})

	// APIルートグループ
	api := e.Group("/api")

	// ルートの設定（後で実際のコントローラーに置き換え）
	api.GET("/", func(c echo.Context) error {
		return c.JSON(200, map[string]string{
			"message": "撮影スタジオ予約管理APIへようこそ",
			"version": "0.1.0",
		})
	})

	// サーバーの起動
	port := cfg.ServerPort
	if port == "" {
		port = "8080" // デフォルトポート
	}

	log.Printf("サーバーを起動します: http://localhost:%s", port)
	if err := e.Start(fmt.Sprintf(":%s", port)); err != nil {
		log.Fatalf("サーバーの起動に失敗しました: %v", err)
	}
}
