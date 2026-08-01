package model

import "time"

// CommunityShare 社区分享
type CommunityShare struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	FamilyID     uint      `gorm:"index;not null" json:"family_id"`
	UserID       uint      `gorm:"not null" json:"user_id"`
	Nickname     string    `gorm:"size:50;not null" json:"nickname"`
	ShareType    string    `gorm:"size:20;not null;default:text" json:"share_type"`
	Content      string    `gorm:"type:text" json:"content"`
	Photos       string    `gorm:"type:text" json:"photos,omitempty"`
	TaskID       uint      `gorm:"index" json:"task_id,omitempty"`
	TaskTitle    string    `gorm:"size:200" json:"task_title,omitempty"`
	TaskPoints   int       `json:"task_points,omitempty"`
	ChildName    string    `gorm:"size:50" json:"child_name,omitempty"`
	Tag          string    `gorm:"size:30" json:"tag,omitempty"`
	LikeCount    int       `gorm:"default:0" json:"like_count"`
	CommentCount int       `gorm:"default:0" json:"comment_count"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	Title        string    `gorm:"size:100" json:"-"`
	Description  string    `gorm:"type:text" json:"-"`
	Photo        string    `gorm:"size:500" json:"-"`
	GrowthStoryID uint   `gorm:"index" json:"growth_story_id,omitempty"` // 成长故事ID（share_type=growth_story时关联）
	AbilitySummary string `gorm:"type:text" json:"ability_summary,omitempty"` // 能力提升摘要（成长故事分享时）
}

// CommunityLike 点赞记录
type CommunityLike struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ShareID   uint      `gorm:"index;not null" json:"share_id"`
	FamilyID  uint      `gorm:"index;not null" json:"family_id"`
	UserID    uint      `gorm:"not null" json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

// CommunityComment 评论
type CommunityComment struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ShareID   uint      `gorm:"index;not null" json:"share_id"`
	FamilyID  uint      `gorm:"index;not null" json:"family_id"`
	UserID    uint      `gorm:"not null" json:"user_id"`
	Nickname  string    `gorm:"size:50;not null" json:"nickname"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	CreatedAt time.Time `json:"created_at"`
}
