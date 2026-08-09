package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"strings"
	"time"
)

type CommunityService struct{}

func NewCommunityService() *CommunityService {
	return &CommunityService{}
}

// ========== 分享相关 ==========

type CreateShareInput struct {
	FamilyID       uint
	UserID         uint
	Nickname       string
	ShareType      string
	Content        string
	Photos         string
	TaskID         uint
	TaskTitle      string
	TaskPoints     int
	ChildName      string
	Tag            string
	GrowthStoryID  uint
	AbilitySummary string
}

type ShareResponse struct {
	model.CommunityShare
	PhotoList []string `json:"photo_list"`
}

func (s *CommunityService) CreateShare(in CreateShareInput) (*model.CommunityShare, error) {
	if strings.TrimSpace(in.Content) == "" {
		return nil, errors.New("分享内容不能为空")
	}
	if len(in.Content) > 1000 {
		return nil, errors.New("内容不能超过1000字")
	}
	if in.ShareType == "" {
		in.ShareType = "text"
	}

	share := &model.CommunityShare{
		FamilyID:       in.FamilyID,
		UserID:         in.UserID,
		Nickname:       in.Nickname,
		ShareType:      in.ShareType,
		Content:        in.Content,
		Photos:         in.Photos,
		TaskID:         in.TaskID,
		TaskTitle:      in.TaskTitle,
		TaskPoints:     in.TaskPoints,
		ChildName:      in.ChildName,
		Tag:            in.Tag,
		GrowthStoryID:  in.GrowthStoryID,
		AbilitySummary: in.AbilitySummary,
		LikeCount:      0,
		CommentCount:   0,
	}
	if err := database.DB.Create(share).Error; err != nil {
		return nil, err
	}
	return share, nil
}

func parsePhotos(photosJSON string) []string {
	if photosJSON == "" {
		return nil
	}
	var photos []string
	if err := json.Unmarshal([]byte(photosJSON), &photos); err != nil {
		return nil
	}
	return photos
}

func toShareResponse(share *model.CommunityShare) ShareResponse {
	content := share.Content
	photos := parsePhotos(share.Photos)

	if content == "" {
		if share.Title != "" {
			content = share.Title
			if share.Description != "" {
				content = share.Title + "\n" + share.Description
			}
		} else {
			content = share.Description
		}
	}

	if len(photos) == 0 && share.Photo != "" {
		photos = []string{share.Photo}
	}

	if share.ShareType == "" {
		if len(photos) > 0 {
			share.ShareType = "text_image"
		} else {
			share.ShareType = "text"
		}
	}

	resp := ShareResponse{
		CommunityShare: *share,
		PhotoList:      photos,
	}
	resp.Content = content
	return resp
}

type ListSharesParams struct {
	Page     int
	PageSize int
	Sort     string
}

func (s *CommunityService) ListShares(p ListSharesParams) ([]ShareResponse, int64, error) {
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

	if err != nil {
		return nil, 0, err
	}

	resp := make([]ShareResponse, len(shares))
	for i := range shares {
		resp[i] = toShareResponse(&shares[i])
	}

	return resp, total, nil
}

func (s *CommunityService) GetShare(id uint) (*ShareResponse, error) {
	var share model.CommunityShare
	err := database.DB.First(&share, id).Error
	if err != nil {
		return nil, errors.New("分享不存在")
	}
	resp := toShareResponse(&share)
	return &resp, nil
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

func (s *CommunityService) ToggleLike(shareID, familyID, userID uint) (bool, int, error) {
	var existing model.CommunityLike
	err := database.DB.Where("share_id = ? AND family_id = ?", shareID, familyID).First(&existing).Error

	if err == nil {
		database.DB.Delete(&existing)
	} else {
		like := &model.CommunityLike{
			ShareID:  shareID,
			FamilyID: familyID,
			UserID:   userID,
		}
		if err := database.DB.Create(like).Error; err != nil {
			return false, 0, err
		}
	}

	var count int64
	database.DB.Model(&model.CommunityLike{}).Where("share_id = ?", shareID).Count(&count)
	database.DB.Model(&model.CommunityShare{}).Where("id = ?", shareID).Update("like_count", int(count))

	var checkExisting model.CommunityLike
	liked := database.DB.Where("share_id = ? AND family_id = ?", shareID, familyID).First(&checkExisting).Error == nil

	return liked, int(count), nil
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

type CreateDonationInput struct {
	ProjectID    uint
	FamilyID     uint
	ChildID      uint
	ChildName    string
	Weight       float64
	Details      string
	ContactName  string
	ContactPhone string
	Address      string
	Photo        string
}

func (s *CommunityService) CreateDonation(in CreateDonationInput) (*model.CharityDonation, error) {
	project, err := s.GetProject(in.ProjectID)
	if err != nil {
		return nil, err
	}

	if in.ChildName == "" {
		return nil, errors.New("请选择捐赠人（孩子）")
	}
	if in.Weight <= 0 {
		return nil, errors.New("请填写捐赠重量")
	}
	if in.ContactName == "" {
		return nil, errors.New("请填写联系人姓名")
	}
	if in.ContactPhone == "" {
		return nil, errors.New("请填写联系电话")
	}
	if in.Address == "" {
		return nil, errors.New("请填写上门回收地址")
	}

	points := int(float64(project.PointsPerKg) * in.Weight)

	donation := &model.CharityDonation{
		FamilyID:     in.FamilyID,
		ChildID:      in.ChildID,
		ChildName:    in.ChildName,
		ProjectID:    in.ProjectID,
		ProjectTitle: project.Title,
		Weight:       in.Weight,
		Details:      in.Details,
		ContactName:  in.ContactName,
		ContactPhone: in.ContactPhone,
		Address:      in.Address,
		Photo:        in.Photo,
		Points:       points,
		Status:       model.DonationStatusPending,
	}

	if err := database.DB.Create(donation).Error; err != nil {
		return nil, err
	}

	NewSystemMessageService().NotifyDonationSubmitted(donation)
	return donation, nil
}

// ConfirmDonationReceived 机构/管理端确认收件（待取件 → 已收件）
func (s *CommunityService) ConfirmDonationReceived(donationID uint) error {
	var donation model.CharityDonation
	if err := database.DB.First(&donation, donationID).Error; err != nil {
		return errors.New("捐赠记录不存在")
	}
	if donation.Status != model.DonationStatusPending {
		return errors.New("当前状态不支持确认收件（需为待取件）")
	}

	now := time.Now()
	donation.Status = model.DonationStatusReceived
	donation.ReceivedAt = &now
	if err := database.DB.Save(&donation).Error; err != nil {
		return err
	}
	NewSystemMessageService().NotifyDonationReceived(&donation)
	return nil
}

// CompleteDonation 发放积分并完结（已收件 → 已完成）
func (s *CommunityService) CompleteDonation(donationID uint) error {
	var donation model.CharityDonation
	if err := database.DB.First(&donation, donationID).Error; err != nil {
		return errors.New("捐赠记录不存在")
	}
	if donation.Status != model.DonationStatusReceived {
		return errors.New("请先确认收件")
	}

	var child model.User
	if err := database.DB.First(&child, donation.ChildID).Error; err != nil {
		return errors.New("孩子档案不存在")
	}

	newBalance := child.Balance + donation.Points
	now := time.Now()

	tx := database.DB.Begin()

	if err := tx.Model(&child).Update("balance", newBalance).Error; err != nil {
		tx.Rollback()
		return err
	}

	relatedType := "donation"
	relatedID := donation.ID
	transaction := &model.Transaction{
		ChildID:      donation.ChildID,
		Type:         model.TransactionTypeIncome,
		Amount:       donation.Points,
		Reason:       fmt.Sprintf("公益捐赠: %s (%.1fkg)", donation.ProjectTitle, donation.Weight),
		RelatedID:    &relatedID,
		RelatedType:  &relatedType,
		BalanceAfter: newBalance,
		CreatedAt:    now,
	}
	if err := tx.Create(transaction).Error; err != nil {
		tx.Rollback()
		return err
	}

	donation.Status = model.DonationStatusCompleted
	donation.CompletedAt = &now
	if err := tx.Save(&donation).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}

	achievementService := &AchievementService{}
	achievementService.IncrementCounter(donation.ChildID, model.CounterTypeTotalPoints, 0, donation.Points)
	achievementService.CheckAchievements(donation.ChildID, model.CounterTypeTotalPoints, 0)

	NewSystemMessageService().NotifyDonationCompleted(&donation)
	return nil
}

type ListDonationsParams struct {
	Status   int // 0=全部
	Page     int
	PageSize int
	Keyword  string
}

func (s *CommunityService) ListDonations(p ListDonationsParams) ([]model.CharityDonation, int64, error) {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.PageSize < 1 || p.PageSize > 100 {
		p.PageSize = 20
	}
	q := database.DB.Model(&model.CharityDonation{})
	if p.Status > 0 {
		q = q.Where("status = ?", p.Status)
	}
	if kw := strings.TrimSpace(p.Keyword); kw != "" {
		like := "%" + kw + "%"
		q = q.Where("child_name LIKE ? OR project_title LIKE ? OR contact_phone LIKE ? OR address LIKE ?", like, like, like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.CharityDonation
	err := q.Order("created_at DESC").
		Limit(p.PageSize).
		Offset((p.Page - 1) * p.PageSize).
		Find(&items).Error
	return items, total, err
}

func (s *CommunityService) GetChildByID(childID uint) (*model.User, error) {
	var child model.User
	if err := database.DB.First(&child, childID).Error; err != nil {
		return nil, errors.New("孩子不存在")
	}
	return &child, nil
}

func (s *CommunityService) ListMyDonations(familyID uint) ([]model.CharityDonation, error) {
	var donations []model.CharityDonation
	err := database.DB.Where("family_id = ?", familyID).
		Order("created_at DESC").
		Find(&donations).Error
	return donations, err
}
