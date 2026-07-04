package service

import (
	"errors"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"time"
)

type CommunityService struct{}

func NewCommunityService() *CommunityService {
	return &CommunityService{}
}

// ========== 分享相关 ==========

type CreateShareInput struct {
	FamilyID uint
	UserID   uint
	Nickname string
	Title    string
	Description string
	Photo    string
	TaskID   uint
	TaskTitle string
	TaskPoints int
	Tag      string
}

func (s *CommunityService) CreateShare(in CreateShareInput) (*model.CommunityShare, error) {
	if in.Title == "" {
		return nil, errors.New("标题不能为空")
	}
	if len(in.Title) > 100 {
		return nil, errors.New("标题不能超过100字")
	}
	if len(in.Description) > 1000 {
		return nil, errors.New("描述不能超过1000字")
	}

	share := &model.CommunityShare{
		FamilyID:    in.FamilyID,
		UserID:      in.UserID,
		Nickname:    in.Nickname,
		Title:       in.Title,
		Description: in.Description,
		Photo:       in.Photo,
		TaskID:      in.TaskID,
		TaskTitle:   in.TaskTitle,
		TaskPoints:  in.TaskPoints,
		Tag:         in.Tag,
		LikeCount:   0,
		CommentCount: 0,
	}
	if err := database.DB.Create(share).Error; err != nil {
		return nil, err
	}
	return share, nil
}

type ListSharesParams struct {
	Page     int
	PageSize int
	Sort     string // "latest" 或 "popular"
}

func (s *CommunityService) ListShares(p ListSharesParams) ([]model.CommunityShare, int64, error) {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.PageSize < 1 || p.PageSize > 100 {
		p.PageSize = 20
	}

	var shares []model.CommunityShare
	var total int64

	query := database.DB.Model(&model.CommunityShare{})
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	orderBy := "created_at DESC"
	if p.Sort == "popular" {
		orderBy = "like_count DESC, created_at DESC"
	}

	err := query.Order(orderBy).
		Limit(p.PageSize).
		Offset((p.Page - 1) * p.PageSize).
		Find(&shares).Error

	return shares, total, err
}

func (s *CommunityService) GetShare(id uint) (*model.CommunityShare, error) {
	var share model.CommunityShare
	err := database.DB.First(&share, id).Error
	if err != nil {
		return nil, errors.New("分享不存在")
	}
	return &share, nil
}

func (s *CommunityService) DeleteShare(id, familyID uint) error {
	var share model.CommunityShare
	if err := database.DB.First(&share, id).Error; err != nil {
		return errors.New("分享不存在")
	}
	if share.FamilyID != familyID {
		return errors.New("无权限删除此分享")
	}

	// 删除点赞和评论
	database.DB.Where("share_id = ?", id).Delete(&model.CommunityLike{})
	database.DB.Where("share_id = ?", id).Delete(&model.CommunityComment{})

	if err := database.DB.Delete(&share).Error; err != nil {
		return err
	}
	return nil
}

// ========== 点赞相关 ==========

func (s *CommunityService) AddLike(shareID, familyID, userID uint) (bool, int, error) {
	var existing model.CommunityLike
	err := database.DB.Where("share_id = ? AND family_id = ?", shareID, familyID).First(&existing).Error

	if err == nil {
		// 已点赞，返回当前状态
		var count int64
		database.DB.Model(&model.CommunityLike{}).Where("share_id = ?", shareID).Count(&count)
		return true, int(count), nil
	}

	// 未点赞，添加
	like := &model.CommunityLike{
		ShareID:  shareID,
		FamilyID: familyID,
		UserID:   userID,
	}
	if err := database.DB.Create(like).Error; err != nil {
		return false, 0, err
	}

	// 获取新的计数
	var count int64
	database.DB.Model(&model.CommunityLike{}).Where("share_id = ?", shareID).Count(&count)
	database.DB.Model(&model.CommunityShare{}).Where("id = ?", shareID).Update("like_count", int(count))
	return true, int(count), nil
}

func (s *CommunityService) RemoveLike(shareID, familyID uint) (bool, int, error) {
	var existing model.CommunityLike
	err := database.DB.Where("share_id = ? AND family_id = ?", shareID, familyID).First(&existing).Error

	if err != nil {
		// 未点赞
		var count int64
		database.DB.Model(&model.CommunityLike{}).Where("share_id = ?", shareID).Count(&count)
		return false, int(count), nil
	}

	// 取消点赞
	database.DB.Delete(&existing)
	var count int64
	database.DB.Model(&model.CommunityLike{}).Where("share_id = ?", shareID).Count(&count)
	database.DB.Model(&model.CommunityShare{}).Where("id = ?", shareID).Update("like_count", int(count))
	return false, int(count), nil
}

// ========== 评论相关 ==========

func (s *CommunityService) AddComment(shareID, familyID, userID uint, nickname, content string) (*model.CommunityComment, error) {
	if content == "" {
		return nil, errors.New("评论内容不能为空")
	}
	if len(content) > 500 {
		return nil, errors.New("评论不能超过500字")
	}

	// 验证分享是否存在
	var share model.CommunityShare
	if err := database.DB.First(&share, shareID).Error; err != nil {
		return nil, errors.New("分享不存在")
	}

	comment := &model.CommunityComment{
		ShareID:  shareID,
		FamilyID: familyID,
		UserID:   userID,
		Nickname: nickname,
		Content:  content,
	}

	if err := database.DB.Create(comment).Error; err != nil {
		return nil, err
	}

	// 更新评论计数
	database.DB.Model(&share).Update("comment_count", share.CommentCount+1)

	return comment, nil
}

func (s *CommunityService) ListComments(shareID uint) ([]model.CommunityComment, error) {
	var comments []model.CommunityComment
	err := database.DB.Where("share_id = ?", shareID).
		Order("created_at DESC").
		Find(&comments).Error
	return comments, err
}

// ========== 公益项目相关 ==========

func (s *CommunityService) ListProjects() ([]model.CharityProject, error) {
	var projects []model.CharityProject
	err := database.DB.Order("id ASC").Find(&projects).Error
	return projects, err
}

func (s *CommunityService) GetProject(id uint) (*model.CharityProject, error) {
	var project model.CharityProject
	err := database.DB.First(&project, id).Error
	if err != nil {
		return nil, errors.New("项目不存在")
	}
	return &project, nil
}

func (s *CommunityService) JoinProject(projectID, familyID, childID uint, childName string, details, photo string) (*model.CharityDonation, error) {
	project, err := s.GetProject(projectID)
	if err != nil {
		return nil, err
	}

	if childName == "" {
		return nil, errors.New("请选择孩子")
	}

	donation := &model.CharityDonation{
		FamilyID:     familyID,
		ChildID:      childID,
		ChildName:    childName,
		ProjectID:    projectID,
		ProjectTitle: project.Title,
		Details:      details,
		Photo:        photo,
		Points:       project.Points,
	}

	if err := database.DB.Create(donation).Error; err != nil {
		return nil, err
	}

	// 更新孩子余额并创建 Transaction
	var child model.User
	if err := database.DB.First(&child, childID).Error; err != nil {
		return nil, errors.New("孩子档案不存在")
	}

	newBalance := child.Balance + project.Points
	database.DB.Model(&child).Update("balance", newBalance)

	// 创建 Transaction 记录
	tx := &model.Transaction{
		ChildID:     childID,
		Type:        model.TransactionTypeIncome,
		Amount:      project.Points,
		Reason:      "参与公益项目: " + project.Title,
		BalanceAfter: newBalance,
		CreatedAt:   time.Now(),
	}
	if err := database.DB.Create(tx).Error; err != nil {
		return nil, err
	}

	achievementService := &AchievementService{}
	achievementService.IncrementCounter(childID, model.CounterTypeCharity, 0, 1)
	achievementService.CheckAchievements(childID, model.CounterTypeCharity, 0)

	achievementService.IncrementCounter(childID, model.CounterTypeTotalPoints, 0, project.Points)
	achievementService.CheckAchievements(childID, model.CounterTypeTotalPoints, 0)

	return donation, nil
}

func (s *CommunityService) ListMyDonations(familyID uint) ([]model.CharityDonation, error) {
	var donations []model.CharityDonation
	err := database.DB.Where("family_id = ?", familyID).
		Order("created_at DESC").
		Find(&donations).Error
	return donations, err
}
