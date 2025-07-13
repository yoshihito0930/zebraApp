package controllers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
)

type AdminBookingController struct {
	adminBookingService AdminBookingService
}

type AdminBookingService interface {
	CreateBooking(req CreateBookingRequest, adminID string) (*BookingResponse, error)
	UpdateBooking(bookingID string, req UpdateBookingRequest, adminID string) (*BookingResponse, error)
	GetBookings(filters BookingFilters, page, limit int) (*BookingListResponse, error)
	GetBookingByID(bookingID string) (*BookingResponse, error)
	DeleteBooking(bookingID string, adminID string) error
	SearchUsers(query string, limit int) ([]UserSearchResult, error)
	CheckAvailability(startTime, endTime time.Time, excludeBookingID string) (bool, error)
}

type CreateBookingRequest struct {
	UserID      string    `json:"userId" validate:"required"`
	UserEmail   string    `json:"userEmail,omitempty"`
	UserName    string    `json:"userName,omitempty"`
	StartTime   time.Time `json:"startTime" validate:"required"`
	EndTime     time.Time `json:"endTime" validate:"required"`
	BookingType string    `json:"bookingType" validate:"required,oneof=temporary confirmed"`
	Purpose     string    `json:"purpose,omitempty"`
	Notes       string    `json:"notes,omitempty"`
	OptionIDs   []string  `json:"optionIds,omitempty"`
	Status      string    `json:"status,omitempty"` // 管理者が作成時にステータスを指定可能
}

type UpdateBookingRequest struct {
	StartTime   *time.Time `json:"startTime,omitempty"`
	EndTime     *time.Time `json:"endTime,omitempty"`
	BookingType *string    `json:"bookingType,omitempty"`
	Purpose     *string    `json:"purpose,omitempty"`
	Notes       *string    `json:"notes,omitempty"`
	Status      *string    `json:"status,omitempty"`
	OptionIDs   []string   `json:"optionIds,omitempty"`
}

type BookingResponse struct {
	ID                      string                  `json:"id"`
	UserID                  string                  `json:"userId"`
	UserName                string                  `json:"userName"`
	UserEmail               string                  `json:"userEmail"`
	StartTime               time.Time               `json:"startTime"`
	EndTime                 time.Time               `json:"endTime"`
	Status                  string                  `json:"status"`
	BookingType             string                  `json:"bookingType"`
	Purpose                 string                  `json:"purpose"`
	Notes                   string                  `json:"notes,omitempty"`
	TotalAmountIncludingTax int                     `json:"totalAmountIncludingTax"`
	CreatedAt               time.Time               `json:"createdAt"`
	UpdatedAt               time.Time               `json:"updatedAt"`
	CreatedBy               string                  `json:"createdBy,omitempty"` // 管理者が作成した場合
	UpdatedBy               string                  `json:"updatedBy,omitempty"`
	Options                 []BookingOptionResponse `json:"options,omitempty"`
}

type BookingOptionResponse struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Price    int    `json:"price"`
	Quantity int    `json:"quantity"`
}

type BookingFilters struct {
	Status      string `query:"status"`
	BookingType string `query:"bookingType"`
	UserID      string `query:"userId"`
	StartDate   string `query:"startDate"`
	EndDate     string `query:"endDate"`
	Search      string `query:"search"`
	SortBy      string `query:"sortBy"`
	SortOrder   string `query:"sortOrder"`
}

type BookingListResponse struct {
	Bookings    []BookingResponse `json:"bookings"`
	TotalCount  int               `json:"totalCount"`
	Page        int               `json:"page"`
	Limit       int               `json:"limit"`
	HasNextPage bool              `json:"hasNextPage"`
}

type UserSearchResult struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	FullName string `json:"fullName"`
	Phone    string `json:"phone,omitempty"`
}

type AvailabilityCheckResponse struct {
	Available bool                 `json:"available"`
	Conflicts []ConflictingBooking `json:"conflicts,omitempty"`
	Message   string               `json:"message,omitempty"`
}

type ConflictingBooking struct {
	ID        string    `json:"id"`
	StartTime time.Time `json:"startTime"`
	EndTime   time.Time `json:"endTime"`
	UserName  string    `json:"userName"`
	Status    string    `json:"status"`
}

func NewAdminBookingController(service AdminBookingService) *AdminBookingController {
	return &AdminBookingController{
		adminBookingService: service,
	}
}

// CreateBooking 管理者による予約作成
func (c *AdminBookingController) CreateBooking(ctx echo.Context) error {
	// 管理者権限チェック
	if !isAdmin(ctx) {
		return ctx.JSON(http.StatusForbidden, map[string]string{
			"error": "管理者権限が必要です",
		})
	}

	var req CreateBookingRequest
	if err := ctx.Bind(&req); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request format",
		})
	}

	// バリデーション
	if req.StartTime.IsZero() || req.EndTime.IsZero() {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "開始時間と終了時間は必須です",
		})
	}

	if req.EndTime.Before(req.StartTime) {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "終了時間は開始時間より後である必要があります",
		})
	}

	// 管理者IDの取得
	adminID := getUserID(ctx)

	// 予約作成
	booking, err := c.adminBookingService.CreateBooking(req, adminID)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{
			"error": "予約の作成に失敗しました: " + err.Error(),
		})
	}

	return ctx.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"booking": booking,
		"message": "予約を作成しました",
	})
}

// UpdateBooking 予約情報の更新
func (c *AdminBookingController) UpdateBooking(ctx echo.Context) error {
	// 管理者権限チェック
	if !isAdmin(ctx) {
		return ctx.JSON(http.StatusForbidden, map[string]string{
			"error": "管理者権限が必要です",
		})
	}

	bookingID := ctx.Param("id")
	if bookingID == "" {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "予約IDが必要です",
		})
	}

	var req UpdateBookingRequest
	if err := ctx.Bind(&req); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request format",
		})
	}

	// 時間のバリデーション
	if req.StartTime != nil && req.EndTime != nil {
		if req.EndTime.Before(*req.StartTime) {
			return ctx.JSON(http.StatusBadRequest, map[string]string{
				"error": "終了時間は開始時間より後である必要があります",
			})
		}
	}

	// 管理者IDの取得
	adminID := getUserID(ctx)

	// 予約更新
	booking, err := c.adminBookingService.UpdateBooking(bookingID, req, adminID)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{
			"error": "予約の更新に失敗しました: " + err.Error(),
		})
	}

	return ctx.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"booking": booking,
		"message": "予約を更新しました",
	})
}

// GetBookings 予約一覧取得
func (c *AdminBookingController) GetBookings(ctx echo.Context) error {
	// 管理者権限チェック
	if !isAdmin(ctx) {
		return ctx.JSON(http.StatusForbidden, map[string]string{
			"error": "管理者権限が必要です",
		})
	}

	var filters BookingFilters
	if err := ctx.Bind(&filters); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid filter parameters",
		})
	}

	// ページネーション
	page := 1
	limit := 20

	if pageStr := ctx.QueryParam("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	if limitStr := ctx.QueryParam("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	// 予約一覧取得
	result, err := c.adminBookingService.GetBookings(filters, page, limit)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{
			"error": "予約一覧の取得に失敗しました: " + err.Error(),
		})
	}

	return ctx.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// GetBookingByID 予約詳細取得
func (c *AdminBookingController) GetBookingByID(ctx echo.Context) error {
	// 管理者権限チェック
	if !isAdmin(ctx) {
		return ctx.JSON(http.StatusForbidden, map[string]string{
			"error": "管理者権限が必要です",
		})
	}

	bookingID := ctx.Param("id")
	if bookingID == "" {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "予約IDが必要です",
		})
	}

	booking, err := c.adminBookingService.GetBookingByID(bookingID)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{
			"error": "予約の取得に失敗しました: " + err.Error(),
		})
	}

	return ctx.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"booking": booking,
	})
}

// DeleteBooking 予約削除
func (c *AdminBookingController) DeleteBooking(ctx echo.Context) error {
	// 管理者権限チェック
	if !isAdmin(ctx) {
		return ctx.JSON(http.StatusForbidden, map[string]string{
			"error": "管理者権限が必要です",
		})
	}

	bookingID := ctx.Param("id")
	if bookingID == "" {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "予約IDが必要です",
		})
	}

	adminID := getUserID(ctx)

	err := c.adminBookingService.DeleteBooking(bookingID, adminID)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{
			"error": "予約の削除に失敗しました: " + err.Error(),
		})
	}

	return ctx.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "予約を削除しました",
	})
}

// SearchUsers ユーザー検索
func (c *AdminBookingController) SearchUsers(ctx echo.Context) error {
	// 管理者権限チェック
	if !isAdmin(ctx) {
		return ctx.JSON(http.StatusForbidden, map[string]string{
			"error": "管理者権限が必要です",
		})
	}

	query := ctx.QueryParam("q")
	if query == "" {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "検索クエリが必要です",
		})
	}

	limit := 10
	if limitStr := ctx.QueryParam("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 50 {
			limit = l
		}
	}

	users, err := c.adminBookingService.SearchUsers(query, limit)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{
			"error": "ユーザー検索に失敗しました: " + err.Error(),
		})
	}

	return ctx.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"users":   users,
	})
}

// CheckAvailability 空き状況確認
func (c *AdminBookingController) CheckAvailability(ctx echo.Context) error {
	// 管理者権限チェック
	if !isAdmin(ctx) {
		return ctx.JSON(http.StatusForbidden, map[string]string{
			"error": "管理者権限が必要です",
		})
	}

	startTimeStr := ctx.QueryParam("startTime")
	endTimeStr := ctx.QueryParam("endTime")
	excludeBookingID := ctx.QueryParam("excludeBookingId")

	if startTimeStr == "" || endTimeStr == "" {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "開始時間と終了時間が必要です",
		})
	}

	startTime, err := time.Parse(time.RFC3339, startTimeStr)
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "開始時間の形式が正しくありません",
		})
	}

	endTime, err := time.Parse(time.RFC3339, endTimeStr)
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "終了時間の形式が正しくありません",
		})
	}

	available, err := c.adminBookingService.CheckAvailability(startTime, endTime, excludeBookingID)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{
			"error": "空き状況の確認に失敗しました: " + err.Error(),
		})
	}

	response := AvailabilityCheckResponse{
		Available: available,
	}

	if !available {
		response.Message = "選択された時間帯には既に予約があります"
	}

	return ctx.JSON(http.StatusOK, response)
}

// ヘルパー関数
func isAdmin(ctx echo.Context) bool {
	if user := ctx.Get("user"); user != nil {
		if userMap, ok := user.(map[string]interface{}); ok {
			if isAdmin, exists := userMap["isAdmin"]; exists {
				if admin, ok := isAdmin.(bool); ok {
					return admin
				}
			}
		}
	}
	return false
}

func getUserID(ctx echo.Context) string {
	if user := ctx.Get("user"); user != nil {
		if userMap, ok := user.(map[string]interface{}); ok {
			if id, exists := userMap["id"]; exists {
				if userID, ok := id.(string); ok {
					return userID
				}
			}
		}
	}
	return ""
}
