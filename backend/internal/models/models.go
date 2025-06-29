package models

import (
	"time"

	"github.com/google/uuid"
)

// User モデルはユーザー情報を表します
type User struct {
	ID                uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	Email             string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	HashedPassword    string    `gorm:"type:varchar(255);not null" json:"-"`
	FullName          string    `gorm:"type:varchar(100);not null" json:"fullName"`
	Address           string    `gorm:"type:text" json:"address,omitempty"`
	Phone             string    `gorm:"type:varchar(20)" json:"phone,omitempty"`
	TotalUsageMinutes int       `gorm:"default:0" json:"totalUsageMinutes"`
	BookingCount      int       `gorm:"default:0" json:"bookingCount"`
	IsAdmin           bool      `gorm:"default:false" json:"isAdmin"`
	CreatedAt         time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt         time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// リレーション
	Bookings        []Booking            `gorm:"foreignKey:UserID" json:"-"`
	Notifications   []Notification       `gorm:"foreignKey:UserID" json:"-"`
	TermsAgreements []UserTermsAgreement `gorm:"foreignKey:UserID" json:"-"`
}

// TableName はGORMがテーブル名として使用する名前を指定します
func (User) TableName() string {
	return "users"
}

// BookingStatus は予約のステータスを表す型
type BookingStatus string

// BookingType は予約の種類を表す型
type BookingType string

const (
	// BookingStatusPending は申請中ステータス
	BookingStatusPending BookingStatus = "pending"
	// BookingStatusApproved は承認済みステータス
	BookingStatusApproved BookingStatus = "approved"
	// BookingStatusRejected は拒否済みステータス
	BookingStatusRejected BookingStatus = "rejected"
	// BookingStatusCancelled はキャンセル済みステータス
	BookingStatusCancelled BookingStatus = "cancelled"

	// BookingTypeTemporary は仮予約
	BookingTypeTemporary BookingType = "temporary"
	// BookingTypeConfirmed は本予約
	BookingTypeConfirmed BookingType = "confirmed"
)

// Booking モデルは予約情報を表します
type Booking struct {
	ID                     uuid.UUID     `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	UserID                 *uuid.UUID    `gorm:"type:uuid" json:"userId,omitempty"`
	StartTime              time.Time     `gorm:"not null" json:"startTime"`
	EndTime                time.Time     `gorm:"not null" json:"endTime"`
	Status                 BookingStatus `gorm:"type:varchar(20);not null" json:"status"`
	BookingType            BookingType   `gorm:"type:varchar(20);not null" json:"bookingType"`
	Purpose                string        `gorm:"type:text" json:"purpose,omitempty"`
	PeopleCount            int           `json:"peopleCount,omitempty"`
	ConfirmationDeadline   *time.Time    `json:"confirmationDeadline,omitempty"`
	AutomaticCancellation  bool          `gorm:"default:false" json:"automaticCancellation"`
	CancellationFeePercent float64       `gorm:"default:0" json:"cancellationFeePercent"`
	ApprovedBy             *uuid.UUID    `gorm:"type:uuid" json:"approvedBy,omitempty"`
	ApprovedAt             *time.Time    `json:"approvedAt,omitempty"`
	CreatedAt              time.Time     `gorm:"default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt              time.Time     `gorm:"default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// リレーション
	User           *User              `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Approver       *User              `gorm:"foreignKey:ApprovedBy" json:"approver,omitempty"`
	BookingOptions []BookingOption    `gorm:"foreignKey:BookingID" json:"bookingOptions,omitempty"`
	StatusLogs     []BookingStatusLog `gorm:"foreignKey:BookingID" json:"statusLogs,omitempty"`
}

// TableName はGORMがテーブル名として使用する名前を指定します
func (Booking) TableName() string {
	return "bookings"
}

// Option モデルはオプションマスタ情報を表します
type Option struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	Name        string    `gorm:"type:varchar(100);not null" json:"name"`
	Description string    `gorm:"type:text" json:"description,omitempty"`
	UnitPrice   float64   `gorm:"not null" json:"unitPrice"`
	Unit        string    `gorm:"type:varchar(20);not null" json:"unit"`
	IsActive    bool      `gorm:"default:true" json:"isActive"`
	CreatedAt   time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// リレーション
	BookingOptions []BookingOption `gorm:"foreignKey:OptionID" json:"-"`
}

// TableName はGORMがテーブル名として使用する名前を指定します
func (Option) TableName() string {
	return "options"
}

// BookingOption モデルは予約オプション情報を表します
type BookingOption struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	BookingID uuid.UUID `gorm:"type:uuid;not null" json:"bookingId"`
	OptionID  uuid.UUID `gorm:"type:uuid;not null" json:"optionId"`
	Quantity  float64   `gorm:"not null" json:"quantity"`
	Price     float64   `gorm:"not null" json:"price"`
	CreatedAt time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// リレーション
	Booking *Booking `gorm:"foreignKey:BookingID" json:"booking,omitempty"`
	Option  *Option  `gorm:"foreignKey:OptionID" json:"option,omitempty"`
}

// TableName はGORMがテーブル名として使用する名前を指定します
func (BookingOption) TableName() string {
	return "booking_options"
}

// BookingStatusLog モデルは予約ステータス履歴を表します
type BookingStatusLog struct {
	ID             uuid.UUID     `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	BookingID      uuid.UUID     `gorm:"type:uuid;not null" json:"bookingId"`
	PreviousStatus BookingStatus `gorm:"type:varchar(20)" json:"previousStatus"`
	NewStatus      BookingStatus `gorm:"type:varchar(20);not null" json:"newStatus"`
	ChangedAt      time.Time     `gorm:"default:CURRENT_TIMESTAMP" json:"changedAt"`
	ChangedBy      *uuid.UUID    `gorm:"type:uuid" json:"changedBy,omitempty"`
	Note           string        `gorm:"type:text" json:"note,omitempty"`

	// リレーション
	Booking  *Booking `gorm:"foreignKey:BookingID" json:"booking,omitempty"`
	Modifier *User    `gorm:"foreignKey:ChangedBy" json:"modifier,omitempty"`
}

// TableName はGORMがテーブル名として使用する名前を指定します
func (BookingStatusLog) TableName() string {
	return "booking_status_logs"
}

// NotificationType は通知の種類を表す型
type NotificationType string

const (
	// NotificationTypeBooking は予約関連通知
	NotificationTypeBooking NotificationType = "booking"
	// NotificationTypeReminder はリマインダー通知
	NotificationTypeReminder NotificationType = "reminder"
	// NotificationTypeSystem はシステム通知
	NotificationTypeSystem NotificationType = "system"
	// NotificationTypeAdmin は管理者からの通知
	NotificationTypeAdmin NotificationType = "admin"
)

// Notification モデルは通知情報を表します
type Notification struct {
	ID              uuid.UUID        `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	UserID          uuid.UUID        `gorm:"type:uuid;not null" json:"userId"`
	Title           string           `gorm:"type:varchar(100);not null" json:"title"`
	Content         string           `gorm:"type:text;not null" json:"content"`
	Type            NotificationType `gorm:"type:varchar(20);not null" json:"type"`
	IsRead          bool             `gorm:"default:false" json:"isRead"`
	RelatedEntityID *uuid.UUID       `gorm:"type:uuid" json:"relatedEntityId,omitempty"`
	CreatedAt       time.Time        `gorm:"default:CURRENT_TIMESTAMP" json:"createdAt"`
	ReadAt          *time.Time       `json:"readAt,omitempty"`

	// リレーション
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// TableName はGORMがテーブル名として使用する名前を指定します
func (Notification) TableName() string {
	return "notifications"
}

// TermsOfService モデルは利用規約情報を表します
type TermsOfService struct {
	ID            uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	Content       string    `gorm:"type:text;not null" json:"content"`
	Version       int       `gorm:"not null" json:"version"`
	EffectiveDate time.Time `gorm:"not null" json:"effectiveDate"`
	CreatedAt     time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"createdAt"`

	// リレーション
	UserAgreements []UserTermsAgreement `gorm:"foreignKey:TermsID" json:"-"`
}

// TableName はGORMがテーブル名として使用する名前を指定します
func (TermsOfService) TableName() string {
	return "terms_of_service"
}

// UserTermsAgreement モデルはユーザーの利用規約同意情報を表します
type UserTermsAgreement struct {
	ID       uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	UserID   uuid.UUID `gorm:"type:uuid;not null" json:"userId"`
	TermsID  uuid.UUID `gorm:"type:uuid;not null" json:"termsId"`
	AgreedAt time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"agreedAt"`

	// リレーション
	User  *User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Terms *TermsOfService `gorm:"foreignKey:TermsID" json:"terms,omitempty"`
}

// TableName はGORMがテーブル名として使用する名前を指定します
func (UserTermsAgreement) TableName() string {
	return "user_terms_agreements"
}
