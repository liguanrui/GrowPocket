package service

import (
	"errors"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"time"
)

type SystemMessageService struct{}

func NewSystemMessageService() *SystemMessageService {
	return &SystemMessageService{}
}

type CreateMessageInput struct {
	FamilyID    uint
	UserID      uint
	Type        string
	Title       string
	Content     string
	RelatedType string
	RelatedID   uint
}

// Create 写入一条系统消息（失败只打日志由调用方忽略亦可）
func (s *SystemMessageService) Create(in CreateMessageInput) (*model.SystemMessage, error) {
	if in.FamilyID == 0 || in.Title == "" || in.Content == "" || in.Type == "" {
		return nil, errors.New("消息参数不完整")
	}
	msg := &model.SystemMessage{
		FamilyID:    in.FamilyID,
		UserID:      in.UserID,
		Type:        in.Type,
		Title:       in.Title,
		Content:     in.Content,
		RelatedType: in.RelatedType,
		RelatedID:   in.RelatedID,
		IsRead:      false,
	}
	if err := database.DB.Create(msg).Error; err != nil {
		return nil, err
	}
	return msg, nil
}

// CreateQuiet 写消息，忽略错误（避免影响主流程）
func (s *SystemMessageService) CreateQuiet(in CreateMessageInput) {
	_, _ = s.Create(in)
}

type ListMessagesParams struct {
	FamilyID uint
	UserID   uint
	UnreadOnly bool
	Page     int
	PageSize int
}

func (s *SystemMessageService) List(p ListMessagesParams) ([]model.SystemMessage, int64, error) {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.PageSize < 1 || p.PageSize > 100 {
		p.PageSize = 30
	}
	q := database.DB.Model(&model.SystemMessage{}).
		Where("family_id = ? AND (user_id = 0 OR user_id = ?)", p.FamilyID, p.UserID)
	if p.UnreadOnly {
		q = q.Where("is_read = ?", false)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.SystemMessage
	err := q.Order("created_at DESC").
		Limit(p.PageSize).
		Offset((p.Page - 1) * p.PageSize).
		Find(&items).Error
	return items, total, err
}

func (s *SystemMessageService) UnreadCount(familyID, userID uint) (int64, error) {
	var count int64
	err := database.DB.Model(&model.SystemMessage{}).
		Where("family_id = ? AND (user_id = 0 OR user_id = ?) AND is_read = ?", familyID, userID, false).
		Count(&count).Error
	return count, err
}

func (s *SystemMessageService) MarkRead(id, familyID, userID uint) error {
	var msg model.SystemMessage
	if err := database.DB.Where("id = ? AND family_id = ? AND (user_id = 0 OR user_id = ?)", id, familyID, userID).
		First(&msg).Error; err != nil {
		return errors.New("消息不存在")
	}
	if msg.IsRead {
		return nil
	}
	now := time.Now()
	return database.DB.Model(&msg).Updates(map[string]interface{}{
		"is_read": true,
		"read_at": &now,
	}).Error
}

func (s *SystemMessageService) MarkAllRead(familyID, userID uint) error {
	now := time.Now()
	return database.DB.Model(&model.SystemMessage{}).
		Where("family_id = ? AND (user_id = 0 OR user_id = ?) AND is_read = ?", familyID, userID, false).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": &now,
		}).Error
}

// ---- 活动相关便捷写入 ----

func (s *SystemMessageService) NotifyActivityPublished(activity *model.CharityActivity) {
	if activity == nil {
		return
	}
	s.CreateQuiet(CreateMessageInput{
		FamilyID:    activity.FamilyID,
		Type:        model.MsgTypeActivityPublished,
		Title:       "活动发布成功",
		Content:     fmt.Sprintf("你发起的活动「%s」已发布，可在社区「我发起的」查看报名情况。", activity.Title),
		RelatedType: model.MsgRelatedActivity,
		RelatedID:   activity.ID,
	})
}

func (s *SystemMessageService) NotifyActivityJoined(activity *model.CharityActivity, joinerFamilyID uint, childName string) {
	if activity == nil {
		return
	}
	// 报名方：报名成功
	s.CreateQuiet(CreateMessageInput{
		FamilyID:    joinerFamilyID,
		Type:        model.MsgTypeActivityJoinSuccess,
		Title:       "报名成功",
		Content:     fmt.Sprintf("%s 已成功报名活动「%s」。活动时间：%s，地点：%s。请按时参加哦。",
			childName, activity.Title,
			activity.EventTime.Format("2006/1/2 15:04"),
			fallbackText(activity.Location, "待定")),
		RelatedType: model.MsgRelatedActivity,
		RelatedID:   activity.ID,
	})

	// 发起方：有人报名（自己报自己的不重复通知）
	if joinerFamilyID != activity.FamilyID {
		s.CreateQuiet(CreateMessageInput{
			FamilyID:    activity.FamilyID,
			Type:        model.MsgTypeActivityNewSignup,
			Title:       "有新报名",
			Content:     fmt.Sprintf("%s 报名了你发起的活动「%s」。当前报名 %d/%d 人，可在「我发起的」查看名单。",
				childName, activity.Title, activity.ParticipantsCount+1, activity.MaxParticipants),
			RelatedType: model.MsgRelatedActivity,
			RelatedID:   activity.ID,
		})
	}

	// 满员提示
	if activity.ParticipantsCount+1 >= activity.MaxParticipants {
		s.CreateQuiet(CreateMessageInput{
			FamilyID:    activity.FamilyID,
			Type:        model.MsgTypeActivityFull,
			Title:       "活动已满员",
			Content:     fmt.Sprintf("你发起的活动「%s」报名已满（%d/%d），记得组织大家按时参加。",
				activity.Title, activity.MaxParticipants, activity.MaxParticipants),
			RelatedType: model.MsgRelatedActivity,
			RelatedID:   activity.ID,
		})
	}
}

func (s *SystemMessageService) NotifyActivityCompletedForFamilies(activity *model.CharityActivity, completerFamilyID uint, childName string, points int) {
	if activity == nil {
		return
	}
	s.CreateQuiet(CreateMessageInput{
		FamilyID:    completerFamilyID,
		Type:        model.MsgTypeActivityTip,
		Title:       "活动完成，积分已到账",
		Content:     fmt.Sprintf("%s 完成了活动「%s」，获得 %d 积分，继续保持公益热情吧！", childName, activity.Title, points),
		RelatedType: model.MsgRelatedActivity,
		RelatedID:   activity.ID,
	})
	if completerFamilyID != activity.FamilyID {
		s.CreateQuiet(CreateMessageInput{
			FamilyID:    activity.FamilyID,
			Type:        model.MsgTypeActivityCompleted,
			Title:       "有人完成了活动",
			Content:     fmt.Sprintf("%s 已完成你发起的活动「%s」，获得 %d 积分。", childName, activity.Title, points),
			RelatedType: model.MsgRelatedActivity,
			RelatedID:   activity.ID,
		})
	}
}

// ---- 捐赠相关便捷写入 ----

func (s *SystemMessageService) NotifyDonationSubmitted(d *model.CharityDonation) {
	if d == nil {
		return
	}
	s.CreateQuiet(CreateMessageInput{
		FamilyID: d.FamilyID,
		Type:     model.MsgTypeDonationSubmitted,
		Title:    "捐赠申请已提交",
		Content: fmt.Sprintf(
			"%s 的「%s」捐赠申请已提交（约 %.1fkg，预计 %d 积分）。请保持电话畅通，等待机构上门取件。",
			d.ChildName, d.ProjectTitle, d.Weight, d.Points,
		),
		RelatedType: model.MsgRelatedDonation,
		RelatedID:   d.ID,
	})
}

func (s *SystemMessageService) NotifyDonationReceived(d *model.CharityDonation) {
	if d == nil {
		return
	}
	s.CreateQuiet(CreateMessageInput{
		FamilyID: d.FamilyID,
		Type:     model.MsgTypeDonationReceived,
		Title:    "机构已确认收件",
		Content: fmt.Sprintf(
			"%s 捐赠的「%s」（%.1fkg）机构已确认收件，积分将很快发放到账。",
			d.ChildName, d.ProjectTitle, d.Weight,
		),
		RelatedType: model.MsgRelatedDonation,
		RelatedID:   d.ID,
	})
}

func (s *SystemMessageService) NotifyDonationCompleted(d *model.CharityDonation) {
	if d == nil {
		return
	}
	s.CreateQuiet(CreateMessageInput{
		FamilyID: d.FamilyID,
		Type:     model.MsgTypeDonationCompleted,
		Title:    "捐赠完成，积分已到账",
		Content: fmt.Sprintf(
			"%s 的「%s」捐赠已完成，%d 积分已发放到孩子账户，感谢你们的爱心！",
			d.ChildName, d.ProjectTitle, d.Points,
		),
		RelatedType: model.MsgRelatedDonation,
		RelatedID:   d.ID,
	})
}

func fallbackText(s, def string) string {
	if s == "" {
		return def
	}
	return s
}
