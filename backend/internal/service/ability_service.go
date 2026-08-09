package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"log"
	"strings"
)

type AbilityService struct{}

func NewAbilityService() *AbilityService {
	return &AbilityService{}
}

// ListDimensions 查询所有能力维度
func (s *AbilityService) ListDimensions() ([]model.AbilityDimension, error) {
	var dims []model.AbilityDimension
	err := database.DB.Order("sort_order ASC").Find(&dims).Error
	return dims, err
}

// GetChildScores 查询儿童的能力维度得分
func (s *AbilityService) GetChildScores(childID, familyID uint) ([]model.ChildAbilityScore, error) {
	var scores []model.ChildAbilityScore
	err := database.DB.Where("child_id = ? AND family_id = ?", childID, familyID).Find(&scores).Error
	return scores, err
}

// GetGrowthIndex 查询儿童成长指数（六维平均分）
func (s *AbilityService) GetGrowthIndex(childID, familyID uint) (int, error) {
	scores, err := s.GetChildScores(childID, familyID)
	if err != nil {
		return 0, err
	}
	if len(scores) == 0 {
		return 0, nil
	}
	// 如果不足 6 个维度，按 0 分补齐
	var dimCount int64
	if err := database.DB.Model(&model.AbilityDimension{}).Count(&dimCount).Error; err != nil {
		return 0, err
	}
	totalDim := int(dimCount)
	if totalDim == 0 {
		return 0, nil
	}
	sum := 0
	for _, sc := range scores {
		sum += sc.Score
	}
	// 未记录的维度按 0 分计入平均
	missing := totalDim - len(scores)
	sum += missing * 0
	return sum / totalDim, nil
}

// AwardTaskCompletion 任务完成后累加能力维度分值
// 主维度按难度权重：easy=1, medium=2, hard=3
// 次维度权重 × 0.5（向下取整）
func (s *AbilityService) AwardTaskCompletion(task *model.Task) error {
	if task.AbilityDimensionID == 0 {
		return nil // 未关联维度，跳过
	}

	// 计算主维度加分
	primaryDelta := difficultyWeight(task.Difficulty)
	if primaryDelta == 0 {
		primaryDelta = 2 // 默认 medium
	}

	// 解析次维度
	var secondaryIDs []uint
	if task.SecondaryDimensions != "" {
		if err := json.Unmarshal([]byte(task.SecondaryDimensions), &secondaryIDs); err != nil {
			log.Printf("[Ability] 解析次维度失败 task=%d: %v", task.ID, err)
		}
	}
	secondaryDelta := primaryDelta / 2 // 次维度 × 0.5，向下取整

	// 累加主维度
	if err := s.addScore(task.ChildID, task.FamilyID, task.AbilityDimensionID, primaryDelta); err != nil {
		return err
	}

	// 累加次维度
	for _, dimID := range secondaryIDs {
		if err := s.addScore(task.ChildID, task.FamilyID, dimID, secondaryDelta); err != nil {
			log.Printf("[Ability] 累加次维度失败 child=%d dim=%d: %v", task.ChildID, dimID, err)
		}
	}

	// 触发能力徽章检查
	s.checkAbilityBadge(task.ChildID, task.FamilyID, task.AbilityDimensionID)
	for _, dimID := range secondaryIDs {
		s.checkAbilityBadge(task.ChildID, task.FamilyID, dimID)
	}

	return nil
}

// AddScoreForDimension 公开方法，供问卷服务调用累加维度分值
// V3.1：按年级·维度发展矩阵对问卷基线进行压低（latent 维按 weight 压缩 delta）
// 并施加发展硬 Cap（latent 不超过 cap 的 85%，secondary/primary 不超过 cap）
func (s *AbilityService) AddScoreForDimension(childID, familyID, dimensionID uint, delta int) error {
	if delta <= 0 {
		return nil
	}

	// 查询孩子当前年级
	grade := s.resolveChildGrade(childID)

	// 查年级·维度发展指南
	guide, _ := s.GetGradeGuide(grade, dimensionID)

	// 蓄势维（latent）：按 weight 压低 delta
	adjustedDelta := delta
	if guide.FocusLevel == "latent" {
		adjustedDelta = int(float64(delta) * guide.Weight)
		if adjustedDelta < 0 {
			adjustedDelta = 0
		}
	}

	// 先走原有累加逻辑（保留 score>100 → 100 的兜底）
	if err := s.addScore(childID, familyID, dimensionID, adjustedDelta); err != nil {
		return err
	}

	// 计算本年级发展硬上限：latent 不超过 cap 的 85%，其余维度为 cap
	effectiveCap := guide.Cap
	if guide.FocusLevel == "latent" {
		effectiveCap = int(float64(guide.Cap) * 0.85)
	}
	if effectiveCap <= 0 {
		return nil
	}

	// 二次 clamp：若累加后超过发展 Cap，则下压到 Cap
	var score model.ChildAbilityScore
	if err := database.DB.Where("child_id = ? AND dimension_id = ?", childID, dimensionID).First(&score).Error; err == nil {
		if score.Score > effectiveCap {
			score.Score = effectiveCap
			if err := database.DB.Save(&score).Error; err != nil {
				log.Printf("[Ability] 应用发展 Cap 失败 child=%d dim=%d: %v", childID, dimensionID, err)
			}
		}
	}

	return nil
}

// GetGradeGuide 查询年级·维度发展指南
// grade<1 或 >6 时回退到 grade=1；查不到记录时返回默认值 {Weight:1.0, Cap:100, FocusLevel:"secondary"}
func (s *AbilityService) GetGradeGuide(grade int, dimID uint) (model.GradeDimensionGuide, error) {
	if grade < 1 || grade > 6 {
		grade = 1
	}
	var guide model.GradeDimensionGuide
	if err := database.DB.Where("grade = ? AND dimension_id = ?", grade, dimID).First(&guide).Error; err != nil {
		// 查不到返回默认值，避免阻塞调用方
		return model.GradeDimensionGuide{
			Weight:     1.0,
			Cap:        100,
			FocusLevel: "secondary",
		}, nil
	}
	return guide, nil
}

// resolveChildGrade 查询孩子当前年级（用 child_service.ResolveGrade 推算），异常时回退到 1
func (s *AbilityService) resolveChildGrade(childID uint) int {
	var child model.User
	if err := database.DB.First(&child, childID).Error; err != nil {
		return 1
	}
	grade, _ := ResolveGrade(&child)
	if grade < 1 || grade > 6 {
		return 1
	}
	return grade
}

// addScore 累加维度分值（上限 100）
func (s *AbilityService) addScore(childID, familyID, dimensionID uint, delta int) error {
	if delta <= 0 {
		return nil
	}
	var score model.ChildAbilityScore
	err := database.DB.Where("child_id = ? AND dimension_id = ?", childID, dimensionID).First(&score).Error
	if err != nil {
		// 不存在，创建
		score = model.ChildAbilityScore{
			FamilyID:    familyID,
			ChildID:     childID,
			DimensionID: dimensionID,
			Score:       delta,
		}
		if score.Score > 100 {
			score.Score = 100
		}
		return database.DB.Create(&score).Error
	}
	// 已存在，累加
	score.Score += delta
	if score.Score > 100 {
		score.Score = 100
	}
	return database.DB.Save(&score).Error
}

// checkAbilityBadge 能力徽章触发（维度分值首次达 30/60/90 触发铜/银/金）
// 注意：勋章系统已下线，这里仅记录日志，不实际创建徽章
func (s *AbilityService) checkAbilityBadge(childID, familyID, dimensionID uint) {
	var score model.ChildAbilityScore
	if err := database.DB.Where("child_id = ? AND dimension_id = ?", childID, dimensionID).First(&score).Error; err != nil {
		return
	}
	if score.Score >= 90 {
		log.Printf("[Ability] 金徽章 child=%d dim=%d", childID, dimensionID)
	} else if score.Score >= 60 {
		log.Printf("[Ability] 银徽章 child=%d dim=%d", childID, dimensionID)
	} else if score.Score >= 30 {
		log.Printf("[Ability] 铜徽章 child=%d dim=%d", childID, dimensionID)
	}
}

// difficultyWeight 难度对应权重
func difficultyWeight(difficulty string) int {
	switch difficulty {
	case "easy":
		return 1
	case "medium":
		return 2
	case "hard":
		return 3
	default:
		return 2
	}
}

// GetDimensionByID 根据ID查询维度
func (s *AbilityService) GetDimensionByID(id uint) (*model.AbilityDimension, error) {
	var dim model.AbilityDimension
	if err := database.DB.First(&dim, id).Error; err != nil {
		return nil, errors.New("能力维度不存在")
	}
	return &dim, nil
}

// AbilityDelta 单个维度的能力变化记录（阶段回顾时生成）
type AbilityDelta struct {
	DimensionID   uint   `json:"dimension_id"`
	DimensionName string `json:"dimension_name"`
	OldScore      int    `json:"old_score"`
	NewScore      int    `json:"new_score"`
	Delta         int    `json:"delta"`
}

// ReassessScores 阶段回顾时由 AI 重新评定六维能力得分
// 基于周期内完成的任务情况，AI 给出各维度 0-100 的评定分值
// 返回各维度的新旧得分对比
func (s *AbilityService) ReassessScores(aiService *AIService, childID, familyID uint, tasks []model.Task, dimensions []model.AbilityDimension) ([]AbilityDelta, error) {
	if len(dimensions) == 0 {
		return nil, errors.New("无能力维度数据")
	}

	// V3.1：查询孩子当前年级，用于构造发展约束 prompt 与硬 clamp
	grade := s.resolveChildGrade(childID)

	// 1. 读取当前能力得分作为基线
	oldScores, _ := s.GetChildScores(childID, familyID)
	oldScoreMap := make(map[uint]int)
	for _, sc := range oldScores {
		oldScoreMap[sc.DimensionID] = sc.Score
	}

	// 2. 按维度分组统计周期内任务
	dimStats := make(map[uint]map[string]int) // dimID -> {count, easy, medium, hard}
	for _, t := range tasks {
		if t.AbilityDimensionID == 0 {
			continue
		}
		if dimStats[t.AbilityDimensionID] == nil {
			dimStats[t.AbilityDimensionID] = map[string]int{"count": 0, "easy": 0, "medium": 0, "hard": 0}
		}
		dimStats[t.AbilityDimensionID]["count"]++
		diff := t.Difficulty
		if diff == "" {
			diff = "medium"
		}
		dimStats[t.AbilityDimensionID][diff]++
	}

	// 3. 构造 AI 评定 prompt
	var parts []string
	parts = append(parts, "你是儿童能力评估专家。请基于以下周期内任务完成情况，重新评定儿童各能力维度的得分（0-100 分）。")
	parts = append(parts, fmt.Sprintf("周期内共完成 %d 项任务。", len(tasks)))
	parts = append(parts, "各维度任务统计：")
	for _, d := range dimensions {
		stats := dimStats[d.ID]
		old := oldScoreMap[d.ID]
		parts = append(parts, fmt.Sprintf("- 维度 %s（ID=%d）：当前基线 %d 分，周期内完成 %d 项任务（easy=%d, medium=%d, hard=%d）",
			d.Name, d.ID, old, stats["count"], stats["easy"], stats["medium"], stats["hard"]))
	}
	parts = append(parts, "评定规则：")
	parts = append(parts, "- 基于任务完成数量和难度，适度提升对应维度得分")
	parts = append(parts, "- 未完成任务的维度保持基线或微调")
	parts = append(parts, "- 总体分值不超过 100")
	parts = append(parts, "- 评定应体现成长，但避免虚高")
	parts = append(parts, "返回纯 JSON（不要 markdown 代码块），格式：{\"1\": 35, \"2\": 28, ...}（key 为 dimension_id，value 为新得分）")

	// V3.1：追加年级发展约束（软约束，引导 AI 按主轴/次轴/蓄势维差异化加分）
	var capParts []string
	for _, d := range dimensions {
		g, _ := s.GetGradeGuide(grade, d.ID)
		capParts = append(capParts, fmt.Sprintf("%d=%s Cap=%d", d.ID, d.Name, g.Cap))
	}
	parts = append(parts, "年级发展约束（严格执行）：")
	parts = append(parts, "- 主轴维（primary）：可大胆加分（+3~+8）")
	parts = append(parts, "- 次轴维（secondary）：正常加分（+1~+5）")
	parts = append(parts, "- 蓄势维（latent）：即使任务多也只能 +0~+2，且不得超过本年级 Cap")
	parts = append(parts, "各维度 Cap："+strings.Join(capParts, ", "))

	// V3.1 模块 D：追加学业趋势软参考（仅作 AI 参考，不直接加能力分）
	if trendRef := s.buildAcademicTrendReference(childID, familyID); trendRef != "" {
		parts = append(parts, trendRef)
	}

	// 4. 调用 AI
	reply, err := aiService.Chat(strings.Join(parts, "\n"), nil, "请评定能力维度得分")
	if err != nil {
		log.Printf("[Ability] AI 评定调用失败 child=%d: %v", childID, err)
		// AI 调用失败时，保留原得分不变更
		return s.buildDeltas(oldScoreMap, oldScoreMap, dimensions), nil
	}

	// 5. 解析 AI 返回
	reply = cleanAbilityJSONResponse(reply)
	newScoreMap := make(map[uint]int)
	if strings.HasPrefix(reply, "{") {
		var rawMap map[string]int
		if err := json.Unmarshal([]byte(reply), &rawMap); err == nil {
			for k, v := range rawMap {
				var dimID uint
				if _, err := fmt.Sscanf(k, "%d", &dimID); err == nil && v >= 0 {
					if v > 100 {
						v = 100
					}
					newScoreMap[dimID] = v
				}
			}
		}
	}

	// 6. AI 未给出评定时，保留原得分
	if len(newScoreMap) == 0 {
		log.Printf("[Ability] AI 评定返回为空，保留原得分 child=%d", childID)
		return s.buildDeltas(oldScoreMap, oldScoreMap, dimensions), nil
	}

	// 7. 覆盖写入 ChildAbilityScore
	for _, d := range dimensions {
		newScore, ok := newScoreMap[d.ID]
		if !ok {
			newScore = oldScoreMap[d.ID] // AI 未评定则保留原值
		}
		// V3.1：按年级发展 Cap 进行硬 clamp
		newScore = s.ClampWithDevelopmentalCap(grade, d.ID, newScore)
		if ok {
			// 仅当 AI 给出评定时才同步回 map，保留 buildDeltas 对未评定维度的原有行为
			newScoreMap[d.ID] = newScore
		}
		if err := s.setScore(childID, familyID, d.ID, newScore); err != nil {
			log.Printf("[Ability] 更新能力得分失败 child=%d dim=%d: %v", childID, d.ID, err)
		}
	}

	return s.buildDeltas(oldScoreMap, newScoreMap, dimensions), nil
}

// ClampWithDevelopmentalCap 按年级·维度发展 Cap 对得分进行硬 clamp
// 若 score 超过该年级该维度的 Cap，则下压到 Cap 并记录日志
func (s *AbilityService) ClampWithDevelopmentalCap(grade int, dimID uint, score int) int {
	guide, _ := s.GetGradeGuide(grade, dimID)
	if score > guide.Cap {
		log.Printf("[Ability] DEVELOPMENT_CAP_APPLIED grade=%d dim=%d raw=%d clamped=%d", grade, dimID, score, guide.Cap)
		return guide.Cap
	}
	return score
}

// buildDeltas 构造新旧得分对比
func (s *AbilityService) buildDeltas(oldMap, newMap map[uint]int, dims []model.AbilityDimension) []AbilityDelta {
	deltas := make([]AbilityDelta, 0, len(dims))
	for _, d := range dims {
		old := oldMap[d.ID]
		new := newMap[d.ID]
		if new == 0 && old == 0 {
			// 都为 0 时，若 newMap 没有该 key 则保留 old
			if _, ok := newMap[d.ID]; !ok {
				new = old
			}
		}
		deltas = append(deltas, AbilityDelta{
			DimensionID:   d.ID,
			DimensionName: d.Name,
			OldScore:      old,
			NewScore:      new,
			Delta:         new - old,
		})
	}
	return deltas
}

// setScore 覆盖写入维度得分（非累加）
func (s *AbilityService) setScore(childID, familyID, dimensionID uint, score int) error {
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	var record model.ChildAbilityScore
	err := database.DB.Where("child_id = ? AND dimension_id = ?", childID, dimensionID).First(&record).Error
	if err != nil {
		// 不存在，创建
		record = model.ChildAbilityScore{
			FamilyID:    familyID,
			ChildID:     childID,
			DimensionID: dimensionID,
			Score:       score,
		}
		return database.DB.Create(&record).Error
	}
	record.Score = score
	return database.DB.Save(&record).Error
}

// cleanAbilityJSONResponse 清理 AI 返回中的 markdown 代码块标记
func cleanAbilityJSONResponse(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}

// buildAcademicTrendReference 构造学业趋势软参考文本（V3.1 模块 D）
// 查询当前周期内的学业趋势档位，按 (subject, metric_type) 分组取最近 6 条
// 返回多行文本，形如：
//   学业趋势参考（仅作参考，不直接加能力分）：
//   - 语文作业档：最近 6 次为 A, B, A, A, B, A（趋势上升）
//   - 数学测验档：最近 3 次为 B, C, B（需关注）
//
// 无数据时返回空串（prompt 不追加）
func (s *AbilityService) buildAcademicTrendReference(childID, familyID uint) string {
	// 查询最近一个成长周期获取时间范围（ReassessScores 在阶段回顾时调用，对应周期为最近一条）
	var cycle model.GrowthCycle
	cycleErr := database.DB.Where("child_id = ? AND family_id = ?", childID, familyID).
		Order("start_date DESC").First(&cycle).Error

	var entries []model.AcademicTrendEntry
	if cycleErr == nil && cycle.ID > 0 {
		// 按周期时间范围查询（与 tasks 过滤逻辑一致，使用 created_at）
		database.DB.Where("child_id = ? AND family_id = ? AND created_at >= ? AND created_at <= ?",
			childID, familyID, cycle.StartDate, cycle.EndDate).
			Order("created_at ASC").Find(&entries)
	} else {
		// 无周期时降级：取最近 30 条
		database.DB.Where("child_id = ? AND family_id = ?", childID, familyID).
			Order("created_at DESC").Limit(30).Find(&entries)
	}
	if len(entries) == 0 {
		return ""
	}

	// 按 (subject, metric_type) 分组，保留首次出现顺序
	groupKey := func(e model.AcademicTrendEntry) string {
		return e.Subject + "|" + e.MetricType
	}
	groups := make(map[string][]model.AcademicTrendEntry)
	groupOrder := make([]string, 0)
	for _, e := range entries {
		key := groupKey(e)
		if _, ok := groups[key]; !ok {
			groupOrder = append(groupOrder, key)
		}
		groups[key] = append(groups[key], e)
	}

	subjectNames := map[string]string{
		"chinese": "语文", "math": "数学", "english": "英语", "other": "其他",
	}
	metricNames := map[string]string{
		"homework":          "作业档",
		"quiz":              "测验档",
		"midterm_final":     "期中期末档",
		"self_study_duration": "自习时长档",
	}

	lines := make([]string, 0, len(groupOrder)+1)
	lines = append(lines, "学业趋势参考（仅作参考，不直接加能力分）：")
	for _, key := range groupOrder {
		group := groups[key]
		// 取最近 6 条（entries 已按时间正序，末尾为最新）
		if len(group) > 6 {
			group = group[len(group)-6:]
		}
		keyParts := strings.SplitN(key, "|", 2)
		if len(keyParts) != 2 {
			continue
		}
		subject, metricType := keyParts[0], keyParts[1]
		subjectName := subjectNames[subject]
		if subjectName == "" {
			subjectName = subject
		}
		metricName := metricNames[metricType]
		if metricName == "" {
			metricName = metricType
		}
		values := make([]string, 0, len(group))
		for _, e := range group {
			values = append(values, e.ValueABC)
		}
		trend := analyzeABCTrend(values)
		lines = append(lines, fmt.Sprintf("- %s%s：最近 %d 次为 %s（%s）",
			subjectName, metricName, len(values), strings.Join(values, ", "), trend))
	}
	return strings.Join(lines, "\n")
}

// analyzeABCTrend 根据 ABC 档位序列判断趋势（上升 / 需关注 / 保持稳定 / 数据不足）
// 评分：A+=4, A=3, B=2, C=1；比较后半段均值与前半段均值
func analyzeABCTrend(values []string) string {
	if len(values) < 2 {
		return "数据不足"
	}
	scoreOf := func(v string) int {
		switch v {
		case "A+":
			return 4
		case "A":
			return 3
		case "B":
			return 2
		case "C":
			return 1
		}
		return 0
	}
	n := len(values)
	mid := n / 2
	if mid == 0 {
		mid = 1
	}
	firstSum, secondSum := 0, 0
	for i := 0; i < mid; i++ {
		firstSum += scoreOf(values[i])
	}
	for i := mid; i < n; i++ {
		secondSum += scoreOf(values[i])
	}
	firstAvg := float64(firstSum) / float64(mid)
	secondAvg := float64(secondSum) / float64(n-mid)
	if secondAvg > firstAvg+0.01 {
		return "趋势上升"
	}
	if secondAvg < firstAvg-0.01 {
		return "需关注"
	}
	return "保持稳定"
}

// AwardMasteryStar 精通星数 +1（上限 5）
// V3.1 模块 B：大师挑战验收通过后调用，对模板 PrimaryDimIDs 中的每个维度加 1 颗精通星
// 已达 5 星的维度不再累加，避免越界
func (s *AbilityService) AwardMasteryStar(childID, dimID uint) error {
	var score model.ChildAbilityScore
	err := database.DB.Where("child_id = ? AND dimension_id = ?", childID, dimID).First(&score).Error
	if err != nil {
		// 不存在该维度得分记录时静默跳过（未评定过的维度不发星）
		log.Printf("[Ability] AwardMasteryStar 跳过：未找到 child=%d dim=%d 的能力得分记录", childID, dimID)
		return nil
	}
	if score.MasteryStars >= 5 {
		log.Printf("[Ability] AwardMasteryStar 跳过：child=%d dim=%d 已达 5 星上限", childID, dimID)
		return nil
	}
	score.MasteryStars++
	if err := database.DB.Save(&score).Error; err != nil {
		log.Printf("[Ability] AwardMasteryStar 失败 child=%d dim=%d: %v", childID, dimID, err)
		return err
	}
	log.Printf("[Ability] AwardMasteryStar 成功 child=%d dim=%d stars=%d", childID, dimID, score.MasteryStars)
	return nil
}

// SetQuestionnaireBaseline 问卷建档/重评时：将问卷原始分映射为"符合年级发展阶段"的能力基线分，覆盖写入。
// 与 AddScoreForDimension（任务奖励累加）的区别：
//   - 问卷是"评估当前水平"，不是"获得成长奖励"，所以先归一化 → 再映射到年级×维度的能力区间 → 覆盖 setScore
//   - rawScore: 用户该维度答题实际得分（累加值，如 3 题 × 5 = 15）
//   - rawMin:   该维度的理论最低分（每题选最低选项，如 3 题 × 1 = 3）
//   - rawMax:   该维度的理论最高分（每题选最高选项，如 3 题 × 5 = 15）
func (s *AbilityService) SetQuestionnaireBaseline(childID, familyID, dimID uint, rawScore, rawMin, rawMax int) error {
	grade := s.resolveChildGrade(childID)
	guide, _ := s.GetGradeGuide(grade, dimID)

	// 1. 归一化答题位置 ratio ∈ [0, 1]：0 = 全选最差，1 = 全选最好
	rawRange := rawMax - rawMin
	if rawRange <= 0 {
		rawRange = 1
	}
	ratio := float64(rawScore-rawMin) / float64(rawRange)
	if ratio < 0 {
		ratio = 0
	}
	if ratio > 1 {
		ratio = 1
	}

	// 2. 计算本年级本维度的能力基线区间 [floor, ceiling]
	//    设计逻辑：问卷全答对 ≠ 能力满分，需留出后续任务成长空间
	//    - 低年级（1-2）：全答最好也不能太高（1 年级 primary 维 ≈ 60 分，体现刚入学）
	//    - 高年级（5-6）：基础习惯应该不错，但 primary 维仍留 8-15 分成长空间（六年级 primary ≈ 88 分）
	//    - latent 维：整体上限压在 Cap*0.85 附近，且 ceiling 不超过 Cap*0.55
	gradeNorm := float64(grade-1) / 5.0 // 1年级→0.0, 6年级→1.0
	var floor, ceiling float64
	switch guide.FocusLevel {
	case "primary":
		// 主轴：1年级 [35% Cap, 60% Cap]，6年级 [60% Cap, 88% Cap]
		// 例：一年级 full mark = 60；六年级 full mark = 88
		floor = float64(guide.Cap) * (0.35 + 0.25*gradeNorm)
		ceiling = float64(guide.Cap) * (0.60 + 0.28*gradeNorm)
	case "secondary":
		// 次轴：1年级 [25% Cap, 50% Cap]，6年级 [50% Cap, 80% Cap]
		// 例：一年级 full mark = 50；六年级 secondary(full mark) = 80
		floor = float64(guide.Cap) * (0.25 + 0.25*gradeNorm)
		ceiling = float64(guide.Cap) * (0.50 + 0.30*gradeNorm)
	case "latent":
		// 蓄势：latentCap = Cap * 0.85（同发展硬上限）
		// 1年级 [3% latentCap, 20% latentCap] ≈ [2,14]；6年级 [25% latentCap, 55% latentCap] ≈ [21,46]
		latentCap := float64(guide.Cap) * 0.85
		floor = latentCap * (0.03 + 0.22*gradeNorm)
		ceiling = latentCap * (0.20 + 0.35*gradeNorm)
	default:
		floor = float64(guide.Cap) * 0.30
		ceiling = float64(guide.Cap) * 0.65
	}

	// 3. 按 ratio 在区间内线性插值得到基线分
	baseline := int(floor + ratio*(ceiling-floor) + 0.5)
	if baseline < 0 {
		baseline = 0
	}
	if baseline > 100 {
		baseline = 100
	}

	log.Printf("[Ability] 问卷基线建档 child=%d dim=%d grade=%d level=%s raw=%d/%d~%d → ratio=%.2f cap=%d → baseline=%d (区间%.0f~%.0f)",
		childID, dimID, grade, guide.FocusLevel, rawScore, rawMin, rawMax, ratio, guide.Cap, baseline, floor, ceiling)

	return s.setScore(childID, familyID, dimID, baseline)
}
