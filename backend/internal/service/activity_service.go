package service

import (
	"errors"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"time"
)

type ActivityService struct{}

func NewActivityService() *ActivityService {
	return &ActivityService{}
}

type CreateActivityInput struct {
	FamilyID    uint
	UserID      uint
	Nickname    string
	Title       string
	ActivityType int
	Description string
	Location    string
	ContactPhone string
	EventTime   time.Time
	MaxParticipants int
	Points      int
}

func (s *ActivityService) CreateActivity(in CreateActivityInput) (*model.CharityActivity, error) {
	if in.Title == "" {
		return nil, errors.New("活动标题不能为空")
	}
	if len(in.Title) > 200 {
		return nil, errors.New("标题不能超过200字")
	}
	if in.ContactPhone == "" {
		return nil, errors.New("请填写联系电话")
	}
	if in.EventTime.IsZero() {
		return nil, errors.New("请选择活动时间")
	}
	if in.MaxParticipants <= 0 {
		in.MaxParticipants = 10
	}
	if in.Points <= 0 {
		in.Points = 80
	}

	activity := &model.CharityActivity{
		FamilyID:     in.FamilyID,
		UserID:       in.UserID,
		Nickname:     in.Nickname,
		Title:        in.Title,
		ActivityType: in.ActivityType,
		Description:  in.Description,
		Location:     in.Location,
		ContactPhone: in.ContactPhone,
		EventTime:    in.EventTime,
		MaxParticipants: in.MaxParticipants,
		ParticipantsCount: 0,
		Points:       in.Points,
		OrganizerPoints: 100,
		Status:       model.ActivityStatusRecruiting,
	}

	if err := database.DB.Create(activity).Error; err != nil {
		return nil, err
	}
	NewSystemMessageService().NotifyActivityPublished(activity)
	return activity, nil
}

type ListActivitiesParams struct {
	Page         int
	PageSize     int
	Type         int // 0 = 全部
}

func (s *ActivityService) ListActivities(p ListActivitiesParams) ([]model.CharityActivity, int64, error) {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.PageSize < 1 || p.PageSize > 100 {
		p.PageSize = 20
	}

	var activities []model.CharityActivity
	var total int64

	query := database.DB.Model(&model.CharityActivity{})
	if p.Type > 0 {
		query = query.Where("activity_type = ?", p.Type)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Order("created_at DESC").
		Limit(p.PageSize).
		Offset((p.Page - 1) * p.PageSize).
		Find(&activities).Error

	return activities, total, err
}

func (s *ActivityService) GetActivity(id uint) (*model.CharityActivity, error) {
	var activity model.CharityActivity
	err := database.DB.First(&activity, id).Error
	if err != nil {
		return nil, errors.New("活动不存在")
	}
	return &activity, nil
}

func (s *ActivityService) JoinActivity(activityID, familyID, childID uint) (*model.ActivityParticipant, error) {
	activity, err := s.GetActivity(activityID)
	if err != nil {
		return nil, err
	}

	if activity.Status != model.ActivityStatusRecruiting {
		return nil, errors.New("活动已结束或无法报名")
	}

	// 检查是否已报名
	var existing model.ActivityParticipant
	if err := database.DB.Where("activity_id = ? AND child_id = ?", activityID, childID).First(&existing).Error; err == nil {
		return nil, errors.New("该孩子已报名此活动")
	}

	// 获取孩子信息（必须属于当前家庭）
	var child model.User
	if err := database.DB.Where("id = ? AND family_id = ? AND role = ?", childID, familyID, model.RoleChild).First(&child).Error; err != nil {
		return nil, errors.New("请选择本家庭的孩子报名")
	}

	// 检查人数
	if activity.ParticipantsCount >= activity.MaxParticipants {
		return nil, errors.New("活动名额已满")
	}

	participant := &model.ActivityParticipant{
		ActivityID: activityID,
		FamilyID:   familyID,
		ChildID:    childID,
		ChildName:  child.Nickname,
	}
	if err := database.DB.Create(participant).Error; err != nil {
		return nil, err
	}

	// 更新参与者数量
	database.DB.Model(activity).Update("participants_count", activity.ParticipantsCount+1)

	// 系统消息：报名成功 + 通知发起者（及满员提示）
	NewSystemMessageService().NotifyActivityJoined(activity, familyID, child.Nickname)

	return participant, nil
}

func (s *ActivityService) CompleteActivity(activityID, familyID, childID uint, photo string) (int, error) {
	activity, err := s.GetActivity(activityID)
	if err != nil {
		return 0, err
	}

	if activity.Status != model.ActivityStatusRecruiting {
		return 0, errors.New("活动已结束")
	}

	// 查找参与者记录
	var participant model.ActivityParticipant
	err = database.DB.Where("activity_id = ? AND child_id = ?", activityID, childID).First(&participant).Error
	if err != nil {
		return 0, errors.New("该孩子未报名此活动")
	}

	if participant.Completed {
		return 0, errors.New("已标记完成")
	}

	// 更新参与者状态
	now := time.Now()
	points := activity.Points
	if familyID == activity.FamilyID {
		points = activity.OrganizerPoints // 组织者获得更多积分
	}
	database.DB.Model(&participant).Updates(map[string]interface{}{
		"completed":     true,
		"points_earned": points,
		"photo":         photo,
		"completed_at":  &now,
	})

	// 更新孩子积分
	var child model.User
	database.DB.Where("id = ? AND role = ?", childID, "child").First(&child)
	newBalance := child.Balance + points
	database.DB.Model(&child).Update("balance", newBalance)

	// 创建 Transaction 记录
	tx := &model.Transaction{
		ChildID:      childID,
		Type:         0,
		Amount:       points,
		Reason:       "参与公益活动: " + activity.Title,
		BalanceAfter: newBalance,
		CreatedAt:    now,
	}
	if err := database.DB.Create(tx).Error; err != nil {
		return 0, err
	}

	// 系统消息：完成方积分到账 + 通知发起者
	NewSystemMessageService().NotifyActivityCompletedForFamilies(activity, familyID, participant.ChildName, points)

	return points, nil
}

func (s *ActivityService) DeleteActivity(id, familyID uint) error {
	var activity model.CharityActivity
	if err := database.DB.First(&activity, id).Error; err != nil {
		return errors.New("活动不存在")
	}

	if activity.FamilyID != familyID {
		return errors.New("无权限删除此活动")
	}

	// 删除参与者记录
	database.DB.Where("activity_id = ?", id).Delete(&model.ActivityParticipant{})

	// 删除活动
	database.DB.Delete(&activity)
	return nil
}

func (s *ActivityService) GetParticipants(activityID uint) ([]model.ActivityParticipant, error) {
	var participants []model.ActivityParticipant
	err := database.DB.Where("activity_id = ?", activityID).Order("created_at ASC").Find(&participants).Error
	return participants, err
}

func (s *ActivityService) ListMyActivities(familyID uint) ([]model.CharityActivity, error) {
	var activities []model.CharityActivity
	err := database.DB.Where("family_id = ?", familyID).
		Order("created_at DESC").
		Find(&activities).Error
	return activities, err
}
