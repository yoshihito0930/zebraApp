package services

import (
	"errors"
	"fmt"
	"time"

	"your-project/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AdminBookingServiceImpl struct {
	db *gorm.DB
}

func NewAdminBookingService(db *gorm.DB) *AdminBookingServiceImpl {
	return &AdminBookingServiceImpl{db: db}
}

// CreateBooking 管理者による予約作成
func (s *AdminBookingServiceImpl) CreateBooking(req CreateBookingRequest, adminID string) (*BookingResponse, error) {
	// ユーザーの存在確認
	var user models.User
	if err := s.db.First(&user, "id = ?", req.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("指定されたユーザーが見つかりません")
		}
		return nil, fmt.Errorf("ユーザーの確認に失敗しました: %w", err)
	}

	// 時間の競合チェック
	available, err := s.CheckAvailability(req.StartTime, req.EndTime, "")
	if err != nil {
		return nil, fmt.Errorf("空き状況の確認に失敗しました: %w", err)
	}
	if !available {
		return nil, fmt.Errorf("選択された時間帯には既に予約があります")
	}

	// ステータスのデフォルト設定
	status := models.BookingStatusPending
	if req.Status != "" {
		status = models.BookingStatus(req.Status)
	}

	// UUIDの生成
	bookingID := uuid.New()
	adminUUID, err := uuid.Parse(adminID)
	if err != nil {
		return nil, fmt.Errorf("管理者IDが無効です: %w", err)
	}

	// 予約の作成
	booking := models.Booking{
		ID:          bookingID,
		UserID:      user.ID,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Status:      status,
		BookingType: models.BookingType(req.BookingType),
		Purpose:     req.Purpose,
		CreatedBy:   &adminUUID, // 管理者が作成
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// トランザクション開始
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 予約の保存
	if err := tx.Create(&booking).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("予約の作成に失敗しました: %w", err)
	}

	// オプションの追加
	if len(req.OptionIDs) > 0 {
		for _, optionIDStr := range req.OptionIDs {
			optionID, err := uuid.Parse(optionIDStr)
			if err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("無効なオプションIDです: %s", optionIDStr)
			}

			bookingOption := models.BookingOption{
				ID:        uuid.New(),
				BookingID: bookingID,
				OptionID:  optionID,
			}

			if err := tx.Create(&bookingOption).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("オプションの追加に失敗しました: %w", err)
			}
		}
	}

	// ステータスログの記録
	statusLog := models.BookingStatusLog{
		ID:             uuid.New(),
		BookingID:      bookingID,
		PreviousStatus: "", // 新規作成
		NewStatus:      status,
		ChangedBy:      adminUUID,
		ChangedAt:      time.Now(),
		Reason:         "管理者による予約作成",
	}

	if err := tx.Create(&statusLog).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("ステータスログの記録に失敗しました: %w", err)
	}

	// コミット
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("トランザクションのコミットに失敗しました: %w", err)
	}

	// 作成された予約を取得して返却
	return s.GetBookingByID(bookingID.String())
}

// UpdateBooking 予約情報の更新
func (s *AdminBookingServiceImpl) UpdateBooking(bookingID string, req UpdateBookingRequest, adminID string) (*BookingResponse, error) {
	// 予約の存在確認
	var booking models.Booking
	if err := s.db.Preload("User").First(&booking, "id = ?", bookingID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("指定された予約が見つかりません")
		}
		return nil, fmt.Errorf("予約の確認に失敗しました: %w", err)
	}

	// 管理者UUIDの変換
	adminUUID, err := uuid.Parse(adminID)
	if err != nil {
		return nil, fmt.Errorf("管理者IDが無効です: %w", err)
	}

	// 時間の更新がある場合の競合チェック
	if req.StartTime != nil && req.EndTime != nil {
		available, err := s.CheckAvailability(*req.StartTime, *req.EndTime, bookingID)
		if err != nil {
			return nil, fmt.Errorf("空き状況の確認に失敗しました: %w", err)
		}
		if !available {
			return nil, fmt.Errorf("選択された時間帯には既に他の予約があります")
		}
	}

	// トランザクション開始
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 変更前の状態を保存
	originalStatus := booking.Status

	// 更新フィールドの設定
	updates := map[string]interface{}{
		"updated_at": time.Now(),
		"updated_by": adminUUID,
	}

	if req.StartTime != nil {
		updates["start_time"] = *req.StartTime
	}
	if req.EndTime != nil {
		updates["end_time"] = *req.EndTime
	}
	if req.BookingType != nil {
		updates["booking_type"] = *req.BookingType
	}
	if req.Purpose != nil {
		updates["purpose"] = *req.Purpose
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}

	// 予約の更新
	if err := tx.Model(&booking).Updates(updates).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("予約の更新に失敗しました: %w", err)
	}

	// ステータスが変更された場合のログ記録
	if req.Status != nil && models.BookingStatus(*req.Status) != originalStatus {
		statusLog := models.BookingStatusLog{
			ID:             uuid.New(),
			BookingID:      booking.ID,
			PreviousStatus: originalStatus,
			NewStatus:      models.BookingStatus(*req.Status),
			ChangedBy:      adminUUID,
			ChangedAt:      time.Now(),
			Reason:         "管理者による予約更新",
		}

		if err := tx.Create(&statusLog).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("ステータスログの記録に失敗しました: %w", err)
		}
	}

	// オプションの更新
	if req.OptionIDs != nil {
		// 既存のオプションを削除
		if err := tx.Where("booking_id = ?", booking.ID).Delete(&models.BookingOption{}).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("既存オプションの削除に失敗しました: %w", err)
		}

		// 新しいオプションを追加
		for _, optionIDStr := range req.OptionIDs {
			if optionIDStr == "" {
				continue
			}

			optionID, err := uuid.Parse(optionIDStr)
			if err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("無効なオプションIDです: %s", optionIDStr)
			}

			bookingOption := models.BookingOption{
				ID:        uuid.New(),
				BookingID: booking.ID,
				OptionID:  optionID,
			}

			if err := tx.Create(&bookingOption).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("オプションの追加に失敗しました: %w", err)
			}
		}
	}

	// コミット
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("トランザクションのコミットに失敗しました: %w", err)
	}

	// 更新された予約を取得して返却
	return s.GetBookingByID(bookingID)
}

// GetBookings 予約一覧取得
func (s *AdminBookingServiceImpl) GetBookings(filters BookingFilters, page, limit int) (*BookingListResponse, error) {
	query := s.db.Model(&models.Booking{}).
		Preload("User").
		Preload("BookingOptions").
		Preload("BookingOptions.Option")

	// フィルタリング
	if filters.Status != "" && filters.Status != "all" {
		if filters.Status == "expiring" {
			// 期限切れ間近（48時間以内）の仮予約
			deadline := time.Now().Add(48 * time.Hour)
			query = query.Where("booking_type = ? AND status = ? AND deadline_at <= ? AND deadline_at > ?",
				models.BookingTypeTemporary, models.BookingStatusPending, deadline, time.Now())
		} else {
			query = query.Where("status = ?", filters.Status)
		}
	}

	if filters.BookingType != "" && filters.BookingType != "all" {
		query = query.Where("booking_type = ?", filters.BookingType)
	}

	if filters.UserID != "" {
		query = query.Where("user_id = ?", filters.UserID)
	}

	if filters.StartDate != "" {
		startDate, err := time.Parse("2006-01-02", filters.StartDate)
		if err == nil {
			query = query.Where("start_time >= ?", startDate)
		}
	}

	if filters.EndDate != "" {
		endDate, err := time.Parse("2006-01-02", filters.EndDate)
		if err == nil {
			endDate = endDate.Add(24 * time.Hour) // 当日の終わりまで
			query = query.Where("start_time < ?", endDate)
		}
	}

	if filters.Search != "" {
		query = query.Joins("LEFT JOIN users ON users.id = bookings.user_id").
			Where("users.full_name ILIKE ? OR users.email ILIKE ? OR bookings.purpose ILIKE ?",
				"%"+filters.Search+"%", "%"+filters.Search+"%", "%"+filters.Search+"%")
	}

	// ソート
	orderBy := "created_at DESC"
	if filters.SortBy != "" {
		sortOrder := "DESC"
		if filters.SortOrder == "asc" {
			sortOrder = "ASC"
		}
		orderBy = fmt.Sprintf("%s %s", filters.SortBy, sortOrder)
	}
	query = query.Order(orderBy)

	// 総件数の取得
	var totalCount int64
	if err := query.Count(&totalCount).Error; err != nil {
		return nil, fmt.Errorf("総件数の取得に失敗しました: %w", err)
	}

	// ページネーション
	offset := (page - 1) * limit
	var bookings []models.Booking
	if err := query.Offset(offset).Limit(limit).Find(&bookings).Error; err != nil {
		return nil, fmt.Errorf("予約一覧の取得に失敗しました: %w", err)
	}

	// レスポンス形式に変換
	bookingResponses := make([]BookingResponse, len(bookings))
	for i, booking := range bookings {
		bookingResponses[i] = s.convertToBookingResponse(booking)
	}

	return &BookingListResponse{
		Bookings:    bookingResponses,
		TotalCount:  int(totalCount),
		Page:        page,
		Limit:       limit,
		HasNextPage: totalCount > int64(page*limit),
	}, nil
}

// GetBookingByID 予約詳細取得
func (s *AdminBookingServiceImpl) GetBookingByID(bookingID string) (*BookingResponse, error) {
	var booking models.Booking
	if err := s.db.Preload("User").
		Preload("BookingOptions").
		Preload("BookingOptions.Option").
		First(&booking, "id = ?", bookingID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("指定された予約が見つかりません")
		}
		return nil, fmt.Errorf("予約の取得に失敗しました: %w", err)
	}

	response := s.convertToBookingResponse(booking)
	return &response, nil
}

// DeleteBooking 予約削除（論理削除）
func (s *AdminBookingServiceImpl) DeleteBooking(bookingID string, adminID string) error {
	// 予約の存在確認
	var booking models.Booking
	if err := s.db.First(&booking, "id = ?", bookingID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("指定された予約が見つかりません")
		}
		return fmt.Errorf("予約の確認に失敗しました: %w", err)
	}

	// 管理者UUIDの変換
	adminUUID, err := uuid.Parse(adminID)
	if err != nil {
		return fmt.Errorf("管理者IDが無効です: %w", err)
	}

	// トランザクション開始
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// ステータスをキャンセルに変更（論理削除）
	updates := map[string]interface{}{
		"status":     models.BookingStatusCancelled,
		"updated_at": time.Now(),
		"updated_by": adminUUID,
	}

	if err := tx.Model(&booking).Updates(updates).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("予約のキャンセルに失敗しました: %w", err)
	}

	// ステータスログの記録
	statusLog := models.BookingStatusLog{
		ID:             uuid.New(),
		BookingID:      booking.ID,
		PreviousStatus: booking.Status,
		NewStatus:      models.BookingStatusCancelled,
		ChangedBy:      adminUUID,
		ChangedAt:      time.Now(),
		Reason:         "管理者による予約削除",
	}

	if err := tx.Create(&statusLog).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("ステータスログの記録に失敗しました: %w", err)
	}

	// コミット
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("トランザクションのコミットに失敗しました: %w", err)
	}

	return nil
}

// SearchUsers ユーザー検索
func (s *AdminBookingServiceImpl) SearchUsers(query string, limit int) ([]UserSearchResult, error) {
	var users []models.User
	if err := s.db.Where("full_name ILIKE ? OR email ILIKE ?", "%"+query+"%", "%"+query+"%").
		Limit(limit).Find(&users).Error; err != nil {
		return nil, fmt.Errorf("ユーザー検索に失敗しました: %w", err)
	}

	results := make([]UserSearchResult, len(users))
	for i, user := range users {
		results[i] = UserSearchResult{
			ID:       user.ID.String(),
			Email:    user.Email,
			FullName: user.FullName,
			Phone:    user.Phone,
		}
	}

	return results, nil
}

// CheckAvailability 空き状況確認
func (s *AdminBookingServiceImpl) CheckAvailability(startTime, endTime time.Time, excludeBookingID string) (bool, error) {
	query := s.db.Model(&models.Booking{}).
		Where("start_time < ? AND end_time > ? AND status IN ?",
			endTime, startTime, []models.BookingStatus{
				models.BookingStatusPending,
				models.BookingStatusApproved,
			})

	// 特定の予約を除外（編集時）
	if excludeBookingID != "" {
		query = query.Where("id != ?", excludeBookingID)
	}

	var count int64
	if err := query.Count(&count).Error; err != nil {
		return false, fmt.Errorf("空き状況の確認に失敗しました: %w", err)
	}

	return count == 0, nil
}

// convertToBookingResponse モデルをレスポンス形式に変換
func (s *AdminBookingServiceImpl) convertToBookingResponse(booking models.Booking) BookingResponse {
	response := BookingResponse{
		ID:                      booking.ID.String(),
		UserID:                  booking.UserID.String(),
		StartTime:               booking.StartTime,
		EndTime:                 booking.EndTime,
		Status:                  string(booking.Status),
		BookingType:             string(booking.BookingType),
		Purpose:                 booking.Purpose,
		TotalAmountIncludingTax: booking.TotalAmountIncludingTax,
		CreatedAt:               booking.CreatedAt,
		UpdatedAt:               booking.UpdatedAt,
	}

	// ユーザー情報
	if booking.User != nil {
		response.UserName = booking.User.FullName
		response.UserEmail = booking.User.Email
	}

	// 作成者・更新者
	if booking.CreatedBy != nil {
		response.CreatedBy = booking.CreatedBy.String()
	}
	if booking.UpdatedBy != nil {
		response.UpdatedBy = booking.UpdatedBy.String()
	}

	// オプション情報
	if len(booking.BookingOptions) > 0 {
		options := make([]BookingOptionResponse, len(booking.BookingOptions))
		for i, bo := range booking.BookingOptions {
			option := BookingOptionResponse{
				ID: bo.OptionID.String(),
			}
			if bo.Option != nil {
				option.Name = bo.Option.Name
				option.Price = bo.Option.Price
			}
			options[i] = option
		}
		response.Options = options
	}

	return response
}

// インターフェースに必要な型定義をここで重複定義
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
	Status      string    `json:"status,omitempty"`
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
	CreatedBy               string                  `json:"createdBy,omitempty"`
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
