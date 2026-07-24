package model

import "time"

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Email        string    `gorm:"size:255;uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"size:255;not null" json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Folder struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"user_id"`
	Name      string    `gorm:"size:255;not null" json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Score struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	UserID       uint      `gorm:"index;not null" json:"user_id"`
	FolderID     *uint     `gorm:"index" json:"folder_id"`
	Title        string    `gorm:"size:255;not null" json:"title"`
	FilePath     string    `gorm:"size:512;not null" json:"-"`
	MimeType     string    `gorm:"size:128;not null" json:"mime_type"`
	OriginalName string    `gorm:"size:255;not null" json:"original_name"`
	ScrollSpeed  float64   `gorm:"not null;default:40" json:"scroll_speed"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
