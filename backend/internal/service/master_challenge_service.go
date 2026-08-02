package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"log"
	"strings"
	"time"
)

// MasterChallengeService 大师挑战服务（V3.1 模块 B）
type MasterChallengeService struct {
	aiService *AIService
	ability   *AbilityService
}

// NewMasterChallengeService 创建大师挑战服务实例
func NewMasterChallengeService(aiService *AIService) *MasterChallengeService {
	return &MasterChallengeService{
		aiService: aiService,
		ability:   NewAbilityService(),
	}
}

// masteryScoreThreshold 精通阈值（PRD：能力维度分值 ≥95 视为精通）
const masteryScoreThreshold = 95

// proficiencyScoreThreshold 熟练阈值（PRD：能力维度分值 ≥80 视为熟练）
const proficiencyScoreThreshold = 80

// InstanceDetail 实例详情（含阶段和提交）
type InstanceDetail struct {
	Instance   model.MasterChallengeInstance    `json:"instance"`
	Template   *model.MasterChallengeTemplate   `json:"template,omitempty"`
	Stages     []model.MasterChallengeStage     `json:"stages"`
	Submission *model.MasterChallengeSubmission `json:"submission,omitempty"`
}

// GetAvailableTemplates 获取该孩子可用的大师挑战模板列表
// 解锁条件：
//   - ≥1 项精通可看 L1
//   - ≥3 项精通可看 L1-L3
//   - 6 维全熟练（≥80）可看全部（含 L4-L5）
func (s *MasterChallengeService) GetAvailableTemplates(childID, familyID uint) ([]model.MasterChallengeTemplate, error) {
	masteryCount, proficiencyCount, err := s.countMasteryAndProficiency(childID, familyID)
	if err != nil {
		return nil, err
	}

	// 完全无解锁条件时返回空列表
	if masteryCount == 0 {
		return []model.MasterChallengeTemplate{}, nil
	}

	// 计算可解锁的最大难度等级
	maxDifficulty := 1
	if masteryCount >= 3 {
		maxDifficulty = 3
	}
	if proficiencyCount >= 6 {
		maxDifficulty = 5
	}

	var templates []model.MasterChallengeTemplate
	if err := database.DB.Where("is_active = ? AND difficulty_level <= ?", true, maxDifficulty).
		Order("category ASC, difficulty_level ASC, id ASC").Find(&templates).Error; err != nil {
		return nil, err
	}
	return templates, nil
}

// countMasteryAndProficiency 统计孩子的精通维度数与熟练维度数
func (s *MasterChallengeService) countMasteryAndProficiency(childID, familyID uint) (masteryCount, proficiencyCount int, err error) {
	scores, err := s.ability.GetChildScores(childID, familyID)
	if err != nil {
		return 0, 0, err
	}
	for _, sc := range scores {
		if sc.Score >= masteryScoreThreshold {
			masteryCount++
		}
		if sc.Score >= proficiencyScoreThreshold {
			proficiencyCount++
		}
	}
	return masteryCount, proficiencyCount, nil
}

// StartInstance 立项：从模板创建实例 + AI 拆阶段
func (s *MasterChallengeService) StartInstance(childID, familyID, templateID uint) (*model.MasterChallengeInstance, []model.MasterChallengeStage, error) {
	// 1. 校验模板
	var template model.MasterChallengeTemplate
	if err := database.DB.First(&template, templateID).Error; err != nil {
		return nil, nil, errors.New("大师挑战模板不存在")
	}
	if !template.IsActive {
		return nil, nil, errors.New("该模板已下线")
	}

	// 2. 校验孩子
	var child model.User
	if err := database.DB.Where("id = ? AND family_id = ? AND role = ?", childID, familyID, model.RoleChild).First(&child).Error; err != nil {
		return nil, nil, errors.New("孩子档案不存在或不属于当前家庭")
	}

	// 3. 检查是否已有进行中的同模板实例（避免重复立项）
	var existing model.MasterChallengeInstance
	if err := database.DB.Where("child_id = ? AND template_id = ? AND status = ?", childID, templateID, "in_progress").First(&existing).Error; err == nil {
		return nil, nil, errors.New("该模板已有进行中的实例，请先完成或放弃后再立项")
	}

	// 4. 创建实例
	now := time.Now()
	instance := &model.MasterChallengeInstance{
		FamilyID:   familyID,
		ChildID:    childID,
		TemplateID: templateID,
		Title:      template.Title,
		Status:     "in_progress",
		StartedAt:  now,
	}
	if err := database.DB.Create(instance).Error; err != nil {
		return nil, nil, errors.New("立项失败")
	}

	// 5. AI 拆阶段
	stages, err := s.GenerateStages(template, child)
	if err != nil {
		log.Printf("[MasterChallenge] GenerateStages 失败 instance=%d: %v", instance.ID, err)
		stages = s.fallbackStages(instance.ID, template)
	}
	// 6. 持久化阶段
	for i := range stages {
		stages[i].InstanceID = instance.ID
		if err := database.DB.Create(&stages[i]).Error; err != nil {
			log.Printf("[MasterChallenge] 持久化阶段失败 instance=%d stage_index=%d: %v", instance.ID, stages[i].StageIndex, err)
		}
	}

	log.Printf("[MasterChallenge] 立项成功 instance=%d template=%d stages=%d", instance.ID, templateID, len(stages))
	return instance, stages, nil
}

// GenerateStages AI 拆阶段
// 硬约束：阶段数必须等于模板的 RecommendedStages，否则 fallback 到标准阶段
func (s *MasterChallengeService) GenerateStages(template model.MasterChallengeTemplate, child model.User) ([]model.MasterChallengeStage, error) {
	grade, _ := ResolveGrade(&child)
	gradeText := fmt.Sprintf("%d 年级", grade)
	if grade == 0 {
		gradeText = "幼儿园/未入学"
	}

	// 构造 prompt
	prompt := fmt.Sprintf(
		"你是儿童项目式学习设计师。请为以下大师挑战项目设计 %d 个执行阶段。\n"+
			"项目标题：%s\n"+
			"项目描述：%s\n"+
			"项目类别：%s\n"+
			"难度等级：L%d\n"+
			"孩子年级：%s\n"+
			"预计完成天数：%d 天\n\n"+
			"要求：\n"+
			"- 必须返回恰好 %d 个阶段\n"+
			"- 每个阶段包含 title（≤20字）和 description（≤80字）\n"+
			"- 阶段顺序应体现「准备→执行→总结」的递进逻辑\n"+
			"- 描述应具体可执行，符合孩子年级认知水平\n"+
			"返回纯 JSON（不要 markdown 代码块），格式：\n"+
			`[{"title":"阶段1标题","description":"阶段1描述"},{"title":"阶段2标题","description":"阶段2描述"}]`,
		template.RecommendedStages, template.Title, template.Description, template.Category,
		template.DifficultyLevel, gradeText, template.EstimatedDays,
		template.RecommendedStages,
	)

	reply, err := s.aiService.Chat(prompt, nil, "请根据项目信息拆分执行阶段")
	if err != nil {
		return nil, fmt.Errorf("AI 调用失败: %w", err)
	}

	// 解析 JSON
	cleaned := cleanJSONResponse(reply)
	if !strings.HasPrefix(cleaned, "[") {
		return nil, errors.New("AI 返回格式不是 JSON 数组")
	}
	var aiStages []struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := json.Unmarshal([]byte(cleaned), &aiStages); err != nil {
		return nil, fmt.Errorf("AI 返回 JSON 解析失败: %w", err)
	}

	// 硬约束：阶段数必须等于 RecommendedStages
	if len(aiStages) != template.RecommendedStages {
		return nil, fmt.Errorf("AI 返回阶段数 %d 不等于推荐阶段数 %d", len(aiStages), template.RecommendedStages)
	}

	// 构造 stage 记录
	stages := make([]model.MasterChallengeStage, 0, len(aiStages))
	for i, st := range aiStages {
		title := strings.TrimSpace(st.Title)
		if title == "" {
			title = fmt.Sprintf("阶段 %d", i+1)
		}
		desc := strings.TrimSpace(st.Description)
		// 截断超长字段
		if len([]rune(title)) > 50 {
			title = string([]rune(title)[:50])
		}
		if len([]rune(desc)) > 250 {
			desc = string([]rune(desc)[:250])
		}
		stages = append(stages, model.MasterChallengeStage{
			StageIndex:  i,
			Title:       title,
			Description: desc,
			Status:      "pending",
		})
	}
	return stages, nil
}

// fallbackStages 标准阶段兜底（AI 失败时使用）
func (s *MasterChallengeService) fallbackStages(instanceID uint, template model.MasterChallengeTemplate) []model.MasterChallengeStage {
	stageCount := template.RecommendedStages
	if stageCount < 1 {
		stageCount = 3
	}
	templates := []struct{ title, desc string }{
		{"准备阶段", "了解项目背景，收集资料与所需材料，制定执行计划。"},
		{"执行阶段", "按计划推进项目核心任务，记录进展与遇到的问题。"},
		{"优化阶段", "对中期成果进行检查与优化，完善细节。"},
		{"展示阶段", "整理成果，准备展示材料与汇报方式。"},
		{"总结阶段", "复盘项目全过程，撰写总结与反思。"},
	}
	stages := make([]model.MasterChallengeStage, 0, stageCount)
	for i := 0; i < stageCount; i++ {
		tpl := templates[i%len(templates)]
		stages = append(stages, model.MasterChallengeStage{
			InstanceID:  instanceID,
			StageIndex:  i,
			Title:       tpl.title,
			Description: tpl.desc,
			Status:      "pending",
		})
	}
	return stages
}

// UpdateStage 阶段打卡
func (s *MasterChallengeService) UpdateStage(stageID uint, notes, attachments string, selfRating int) (*model.MasterChallengeStage, error) {
	var stage model.MasterChallengeStage
	if err := database.DB.First(&stage, stageID).Error; err != nil {
		return nil, errors.New("阶段记录不存在")
	}

	// 自评分数范围校验
	if selfRating < 0 {
		selfRating = 0
	}
	if selfRating > 5 {
		selfRating = 5
	}

	stage.Notes = notes
	stage.Attachments = attachments
	stage.SelfRating = selfRating

	// 首次打卡时状态变为 in_progress；若已 completed 则保留
	if stage.Status == "pending" {
		stage.Status = "in_progress"
	}

	if err := database.DB.Save(&stage).Error; err != nil {
		return nil, errors.New("阶段打卡失败")
	}
	return &stage, nil
}

// SubmitForReview 提交验收
func (s *MasterChallengeService) SubmitForReview(instanceID uint, childSummary, attachments string) (*model.MasterChallengeSubmission, error) {
	var instance model.MasterChallengeInstance
	if err := database.DB.First(&instance, instanceID).Error; err != nil {
		return nil, errors.New("大师挑战实例不存在")
	}
	if instance.Status != "in_progress" {
		return nil, errors.New("仅进行中的实例可提交验收")
	}

	// 检查是否已有未审核的提交
	var pending model.MasterChallengeSubmission
	if err := database.DB.Where("instance_id = ? AND reviewed_at = ?", instanceID, time.Time{}).First(&pending).Error; err == nil {
		return nil, errors.New("该实例已有待审核的提交，请等待家长验收")
	}

	// 更新实例状态为 submitted
	instance.Status = "submitted"
	instance.FinalSummary = childSummary
	if err := database.DB.Save(&instance).Error; err != nil {
		return nil, errors.New("更新实例状态失败")
	}

	// 创建提交记录（reviewed_at 留空，待家长审核后填充）
	submission := &model.MasterChallengeSubmission{
		InstanceID:   instanceID,
		ChildSummary: childSummary,
		Attachments:  attachments,
	}
	if err := database.DB.Create(submission).Error; err != nil {
		return nil, errors.New("创建提交记录失败")
	}
	return submission, nil
}

// Review 家长验收打分（3 维，≥2 维达到 4 星即通过）
func (s *MasterChallengeService) Review(submissionID uint, participationScore, applicationScore, qualityScore int) (*model.MasterChallengeSubmission, error) {
	var submission model.MasterChallengeSubmission
	if err := database.DB.First(&submission, submissionID).Error; err != nil {
		return nil, errors.New("提交记录不存在")
	}
	// 已审核过的提交不可重复审核
	if !submission.ReviewedAt.IsZero() {
		return nil, errors.New("该提交已审核")
	}

	// 评分范围校验（1-5）
	clampScore := func(v int) int {
		if v < 1 {
			v = 1
		}
		if v > 5 {
			v = 5
		}
		return v
	}
	submission.ParticipationScore = clampScore(participationScore)
	submission.ApplicationScore = clampScore(applicationScore)
	submission.QualityScore = clampScore(qualityScore)

	// 通过条件：≥2 个维度评分 ≥4 视为通过
	stars := 0
	if submission.ParticipationScore >= 4 {
		stars++
	}
	if submission.ApplicationScore >= 4 {
		stars++
	}
	if submission.QualityScore >= 4 {
		stars++
	}
	submission.Passed = stars >= 2
	submission.ReviewedAt = time.Now()

	// 查询实例
	var instance model.MasterChallengeInstance
	if err := database.DB.First(&instance, submission.InstanceID).Error; err != nil {
		return nil, errors.New("关联实例不存在")
	}

	// 通过：发奖励 + 实例状态 → completed
	if submission.Passed {
		if err := s.awardReward(&instance, &submission); err != nil {
			log.Printf("[MasterChallenge] awardReward 失败 instance=%d: %v", instance.ID, err)
			// 奖励发放失败不阻塞审核流程，但记录错误
		}
		instance.Status = "completed"
		now := time.Now()
		instance.CompletedAt = &now
	} else {
		// 未通过：实例状态回到 in_progress，允许孩子重新提交
		instance.Status = "in_progress"
	}

	if err := database.DB.Save(&instance).Error; err != nil {
		return nil, errors.New("更新实例状态失败")
	}

	// 保存 submission（含 PointsAwarded）
	if err := database.DB.Save(&submission).Error; err != nil {
		return nil, errors.New("保存审核结果失败")
	}

	log.Printf("[MasterChallenge] 审核完成 submission=%d passed=%v points=%d", submission.ID, submission.Passed, submission.PointsAwarded)
	return &submission, nil
}

// awardReward 验收通过后发奖励
//   - 稀有积分 = template.PointsReward * 难度倍率（L1=1.5x, L2=2x, L3=3x, L4=4x, L5=5x）
//   - 写 Transaction（RelatedType='master_project'）
//   - 对 template.PrimaryDimIDs 的每个维度，调用 AwardMasteryStar → mastery_stars +1（上限 5）
//   - 调用 growth_story_service.GenerateProjectStory 生成专题成长故事
func (s *MasterChallengeService) awardReward(instance *model.MasterChallengeInstance, submission *model.MasterChallengeSubmission) error {
	// 1. 查询模板
	var template model.MasterChallengeTemplate
	if err := database.DB.First(&template, instance.TemplateID).Error; err != nil {
		return fmt.Errorf("模板不存在: %w", err)
	}

	// 2. 计算稀有积分（PointsReward * 倍率，倍率以 *10 整数表示）
	multiplier := difficultyMultiplier(template.DifficultyLevel)
	pointsAwarded := template.PointsReward * multiplier / 10
	if pointsAwarded <= 0 {
		pointsAwarded = template.PointsReward
	}

	// 3. 原子事务：更新余额 + 写 Transaction
	tx := database.DB.Begin()

	var child model.User
	if err := tx.Where("id = ? AND role = ?", instance.ChildID, "child").First(&child).Error; err != nil {
		tx.Rollback()
		return errors.New("孩子档案不存在")
	}

	newBalance := child.Balance + pointsAwarded
	if err := tx.Model(&child).Update("balance", newBalance).Error; err != nil {
		tx.Rollback()
		return errors.New("更新余额失败")
	}

	relatedType := "master_project"
	instanceID := instance.ID
	reason := fmt.Sprintf("大师挑战通过：%s（L%d）", template.Title, template.DifficultyLevel)
	txRec := &model.Transaction{
		ChildID:      instance.ChildID,
		Type:         model.TransactionTypeIncome,
		Amount:       pointsAwarded,
		Reason:       reason,
		RelatedID:    &instanceID,
		RelatedType:  &relatedType,
		BalanceAfter: newBalance,
	}
	if err := tx.Create(txRec).Error; err != nil {
		tx.Rollback()
		return errors.New("创建积分流水失败")
	}

	if err := tx.Commit().Error; err != nil {
		return errors.New("提交事务失败")
	}

	// 4. 对 PrimaryDimIDs 的每个维度加精通星
	var dimIDs []uint
	if template.PrimaryDimIDs != "" {
		if err := json.Unmarshal([]byte(template.PrimaryDimIDs), &dimIDs); err != nil {
			log.Printf("[MasterChallenge] 解析 PrimaryDimIDs 失败 template=%d: %v", template.ID, err)
		}
	}
	for _, dimID := range dimIDs {
		if err := s.ability.AwardMasteryStar(instance.ChildID, dimID); err != nil {
			log.Printf("[MasterChallenge] AwardMasteryStar 失败 child=%d dim=%d: %v", instance.ChildID, dimID, err)
		}
	}

	// 5. 更新 submission 的 PointsAwarded
	submission.PointsAwarded = pointsAwarded

	// 6. 生成项目式成长故事（失败不阻塞）
	storyService := NewGrowthStoryService(s.aiService)
	if _, err := storyService.GenerateProjectStory(instance.ID); err != nil {
		log.Printf("[MasterChallenge] GenerateProjectStory 失败 instance=%d: %v", instance.ID, err)
	}

	log.Printf("[MasterChallenge] 奖励发放完成 instance=%d points=%d dims=%d", instance.ID, pointsAwarded, len(dimIDs))
	return nil
}

// difficultyMultiplier 难度对应倍率（L1=1.5x, L2=2x, L3=3x, L4=4x, L5=5x）
// 返回 *10 后的整数值，便于做整数运算：实际积分 = PointsReward * multiplier / 10
func difficultyMultiplier(level int) int {
	switch level {
	case 1:
		return 15 // 1.5x
	case 2:
		return 20 // 2x
	case 3:
		return 30 // 3x
	case 4:
		return 40 // 4x
	case 5:
		return 50 // 5x
	default:
		return 20 // 默认 2x
	}
}

// GetInstances 查询孩子的大师挑战实例列表
func (s *MasterChallengeService) GetInstances(childID, familyID uint) ([]model.MasterChallengeInstance, error) {
	var instances []model.MasterChallengeInstance
	if err := database.DB.Where("child_id = ? AND family_id = ?", childID, familyID).
		Order("created_at DESC").Find(&instances).Error; err != nil {
		return nil, err
	}
	return instances, nil
}

// GetInstanceDetail 查询实例详情（含阶段和提交）
func (s *MasterChallengeService) GetInstanceDetail(instanceID uint) (*InstanceDetail, error) {
	var instance model.MasterChallengeInstance
	if err := database.DB.First(&instance, instanceID).Error; err != nil {
		return nil, errors.New("实例不存在")
	}

	var template model.MasterChallengeTemplate
	hasTemplate := true
	if err := database.DB.First(&template, instance.TemplateID).Error; err != nil {
		hasTemplate = false
	}

	var stages []model.MasterChallengeStage
	database.DB.Where("instance_id = ?", instanceID).Order("stage_index ASC").Find(&stages)

	var submission model.MasterChallengeSubmission
	hasSubmission := false
	if err := database.DB.Where("instance_id = ?", instanceID).Order("created_at DESC").First(&submission).Error; err == nil {
		hasSubmission = true
	}

	detail := &InstanceDetail{
		Instance: instance,
		Stages:   stages,
	}
	if hasTemplate {
		detail.Template = &template
	}
	if hasSubmission {
		detail.Submission = &submission
	}
	return detail, nil
}

// GetStageByID 查询单个阶段记录（用于权限校验前置）
func (s *MasterChallengeService) GetStageByID(stageID uint) (*model.MasterChallengeStage, error) {
	var stage model.MasterChallengeStage
	if err := database.DB.First(&stage, stageID).Error; err != nil {
		return nil, errors.New("阶段记录不存在")
	}
	return &stage, nil
}

// GetSubmissionByID 查询单个提交记录（用于权限校验前置）
func (s *MasterChallengeService) GetSubmissionByID(submissionID uint) (*model.MasterChallengeSubmission, error) {
	var submission model.MasterChallengeSubmission
	if err := database.DB.First(&submission, submissionID).Error; err != nil {
		return nil, errors.New("提交记录不存在")
	}
	return &submission, nil
}
