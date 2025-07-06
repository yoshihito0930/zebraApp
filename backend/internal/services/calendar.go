package services

import (
	"database/sql"
	"fmt"
	"time"
)

type CalendarServiceImpl struct {
	db *sql.DB
}

type BookingData struct {
	ID               string
	UserID           string
	UserName         string
	StartTime        time.Time
	EndTime          time.Time
	Status           string
	BookingType      string
	Purpose          string
	PhotographerName sql.NullString
	CreatedAt        time.Time
}

func NewCalendarService(db *sql.DB) *CalendarServiceImpl {
	return &CalendarServiceImpl{db: db}
}

// GetEvents 指定期間の予約イベントを取得
func (s *CalendarServiceImpl) GetEvents(startDate, endDate time.Time, userID string) ([]EventResponse, error) {
	query := `
		SELECT 
			b.id,
			b.user_id,
			u.full_name,
			b.start_time,
			b.end_time,
			b.status,
			b.booking_type,
			COALESCE(b.purpose, ''),
			b.created_at
		FROM bookings b
		LEFT JOIN users u ON b.user_id = u.id
		WHERE b.start_time < $1 AND b.end_time > $2
		  AND b.status != 'cancelled'
		ORDER BY b.start_time ASC
	`

	rows, err := s.db.Query(query, endDate, startDate)
	if err != nil {
		return nil, fmt.Errorf("failed to query bookings: %w", err)
	}
	defer rows.Close()

	var events []EventResponse
	for rows.Next() {
		var booking BookingData
		err := rows.Scan(
			&booking.ID,
			&booking.UserID,
			&booking.UserName,
			&booking.StartTime,
			&booking.EndTime,
			&booking.Status,
			&booking.BookingType,
			&booking.Purpose,
			&booking.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan booking: %w", err)
		}

		event := s.formatBookingAsEvent(booking)
		events = append(events, event)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	return events, nil
}

// GetAvailability 指定期間の空き状況を取得
func (s *CalendarServiceImpl) GetAvailability(startDate, endDate time.Time) ([]AvailabilitySlot, error) {
	var availability []AvailabilitySlot

	// 営業時間の設定（現在はハードコード、将来的には設定テーブルから取得）
	businessStart := 9 // 9:00
	businessEnd := 22  // 22:00
	slotDuration := 60 // 60分単位

	// 既存の予約を取得
	bookedSlots, err := s.getBookedSlots(startDate, endDate)
	if err != nil {
		return nil, err
	}

	// 日付ごとに空き状況を生成
	current := startDate
	for current.Before(endDate) {
		// 平日のみ営業（土日は休業）
		if current.Weekday() == time.Saturday || current.Weekday() == time.Sunday {
			current = current.Add(24 * time.Hour)
			continue
		}

		// 営業時間内のタイムスロットを生成
		for hour := businessStart; hour < businessEnd; hour++ {
			slotStart := time.Date(current.Year(), current.Month(), current.Day(), hour, 0, 0, 0, current.Location())
			slotEnd := slotStart.Add(time.Duration(slotDuration) * time.Minute)

			// この時間枠が利用可能かチェック
			available := true
			slotType := "business_hours"

			for _, booked := range bookedSlots {
				if s.timeSlotsOverlap(slotStart, slotEnd, booked.Start, booked.End) {
					available = false
					break
				}
			}

			slot := AvailabilitySlot{
				Start:     slotStart.Format(time.RFC3339),
				End:       slotEnd.Format(time.RFC3339),
				Available: available,
				Type:      slotType,
			}
			availability = append(availability, slot)
		}

		current = current.Add(24 * time.Hour)
	}

	return availability, nil
}

// 既存の予約された時間枠を取得
func (s *CalendarServiceImpl) getBookedSlots(startDate, endDate time.Time) ([]struct{ Start, End time.Time }, error) {
	query := `
		SELECT start_time, end_time
		FROM bookings
		WHERE start_time < $1 AND end_time > $2
		  AND status IN ('approved', 'pending')
		ORDER BY start_time ASC
	`

	rows, err := s.db.Query(query, endDate, startDate)
	if err != nil {
		return nil, fmt.Errorf("failed to query booked slots: %w", err)
	}
	defer rows.Close()

	var bookedSlots []struct{ Start, End time.Time }
	for rows.Next() {
		var slot struct{ Start, End time.Time }
		err := rows.Scan(&slot.Start, &slot.End)
		if err != nil {
			return nil, fmt.Errorf("failed to scan booked slot: %w", err)
		}
		bookedSlots = append(bookedSlots, slot)
	}

	return bookedSlots, nil
}

// 時間枠の重複チェック
func (s *CalendarServiceImpl) timeSlotsOverlap(start1, end1, start2, end2 time.Time) bool {
	return start1.Before(end2) && start2.Before(end1)
}

// 予約データをイベント形式に変換
func (s *CalendarServiceImpl) formatBookingAsEvent(booking BookingData) EventResponse {
	colors := s.getEventColor(booking.Status, booking.BookingType)

	title := fmt.Sprintf("%s - %s", booking.UserName, booking.Purpose)
	if booking.Purpose == "" {
		title = booking.UserName
	}

	return EventResponse{
		ID:              booking.ID,
		Title:           title,
		Start:           booking.StartTime.Format(time.RFC3339),
		End:             booking.EndTime.Format(time.RFC3339),
		BackgroundColor: colors.BackgroundColor,
		BorderColor:     colors.BorderColor,
		TextColor:       colors.TextColor,
		ExtendedProps: map[string]interface{}{
			"userId":           booking.UserID,
			"userName":         booking.UserName,
			"status":           booking.Status,
			"bookingType":      booking.BookingType,
			"purpose":          booking.Purpose,
			"photographerName": booking.PhotographerName.String,
			"createdAt":        booking.CreatedAt.Format(time.RFC3339),
		},
	}
}

// イベントの色を決定
func (s *CalendarServiceImpl) getEventColor(status, bookingType string) struct {
	BackgroundColor string
	BorderColor     string
	TextColor       string
} {
	var backgroundColor, borderColor string
	textColor := "#FFFFFF"

	switch status {
	case "cancelled":
		backgroundColor = "#9CA3AF" // gray-400
		borderColor = "#6B7280"     // gray-500
	case "approved":
		if bookingType == "temporary" {
			backgroundColor = "#10B981" // emerald-500
			borderColor = "#059669"     // emerald-600
		} else {
			backgroundColor = "#3B82F6" // blue-500
			borderColor = "#2563EB"     // blue-600
		}
	case "pending":
		backgroundColor = "#F59E0B" // amber-500
		borderColor = "#D97706"     // amber-600
	case "rejected":
		backgroundColor = "#EF4444" // red-500
		borderColor = "#DC2626"     // red-600
	default:
		backgroundColor = "#6B7280" // gray-500
		borderColor = "#4B5563"     // gray-600
	}

	return struct {
		BackgroundColor string
		BorderColor     string
		TextColor       string
	}{backgroundColor, borderColor, textColor}
}

// インターフェースの実装確認用の型定義
type EventResponse struct {
	ID              string                 `json:"id"`
	Title           string                 `json:"title"`
	Start           string                 `json:"start"`
	End             string                 `json:"end"`
	BackgroundColor string                 `json:"backgroundColor"`
	BorderColor     string                 `json:"borderColor"`
	TextColor       string                 `json:"textColor"`
	ExtendedProps   map[string]interface{} `json:"extendedProps"`
}

type AvailabilitySlot struct {
	Start     string `json:"start"`
	End       string `json:"end"`
	Available bool   `json:"available"`
	Type      string `json:"type"`
}
