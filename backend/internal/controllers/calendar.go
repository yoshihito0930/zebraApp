package controllers

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

type CalendarController struct {
	calendarService CalendarService
}

type CalendarService interface {
	GetEvents(startDate, endDate time.Time, userID string) ([]EventResponse, error)
	GetAvailability(startDate, endDate time.Time) ([]AvailabilitySlot, error)
}

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
	Type      string `json:"type"` // "business_hours", "break", "blocked"
}

type CalendarEventsResponse struct {
	Events       []EventResponse    `json:"events"`
	Availability []AvailabilitySlot `json:"availability"`
}

func NewCalendarController(calendarService CalendarService) *CalendarController {
	return &CalendarController{
		calendarService: calendarService,
	}
}

// GetEvents カレンダーイベントと空き状況を取得
func (c *CalendarController) GetEvents(ctx echo.Context) error {
	// クエリパラメータの取得
	startStr := ctx.QueryParam("start")
	endStr := ctx.QueryParam("end")

	if startStr == "" || endStr == "" {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "start and end parameters are required",
		})
	}

	// 日付のパース
	startDate, err := time.Parse("2006-01-02", startStr)
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid start date format. Use YYYY-MM-DD",
		})
	}

	endDate, err := time.Parse("2006-01-02", endStr)
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid end date format. Use YYYY-MM-DD",
		})
	}

	// 終了日を翌日の開始時刻まで延長（FullCalendarの仕様に合わせる）
	endDate = endDate.Add(24 * time.Hour)

	// ユーザーIDの取得（認証ミドルウェアから）
	userID := ""
	if user := ctx.Get("user"); user != nil {
		if userMap, ok := user.(map[string]interface{}); ok {
			if id, exists := userMap["id"]; exists {
				userID = id.(string)
			}
		}
	}

	// イベントデータの取得
	events, err := c.calendarService.GetEvents(startDate, endDate, userID)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch events",
		})
	}

	// 空き状況の取得
	availability, err := c.calendarService.GetAvailability(startDate, endDate)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch availability",
		})
	}

	response := CalendarEventsResponse{
		Events:       events,
		Availability: availability,
	}

	return ctx.JSON(http.StatusOK, response)
}

// GetAvailability 空き状況のみを取得
func (c *CalendarController) GetAvailability(ctx echo.Context) error {
	startStr := ctx.QueryParam("start")
	endStr := ctx.QueryParam("end")

	if startStr == "" || endStr == "" {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "start and end parameters are required",
		})
	}

	startDate, err := time.Parse("2006-01-02", startStr)
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid start date format. Use YYYY-MM-DD",
		})
	}

	endDate, err := time.Parse("2006-01-02", endStr)
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid end date format. Use YYYY-MM-DD",
		})
	}

	endDate = endDate.Add(24 * time.Hour)

	availability, err := c.calendarService.GetAvailability(startDate, endDate)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch availability",
		})
	}

	return ctx.JSON(http.StatusOK, map[string]interface{}{
		"availability": availability,
	})
}
