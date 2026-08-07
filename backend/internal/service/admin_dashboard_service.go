package service

import (
	"growpocket/internal/database"
	"growpocket/internal/model"
	"math"
	"time"
)

type AdminDashboardService struct{}

func NewAdminDashboardService() *AdminDashboardService {
	return &AdminDashboardService{}
}

type HotTaskDTO struct {
	ID             uint   `json:"id"`
	Title          string `json:"title"`
	Category       string `json:"category"`
	Points         int    `json:"points"`
	CompletedCount int64  `json:"completed_count"`
}

type RedeemItemDTO struct {
	ID            uint   `json:"id"`
	Name          string `json:"name"`
	Points        int    `json:"points"`
	RedeemedCount int64  `json:"redeemed_count"`
}

type OverviewStatsDTO struct {
	TotalFamilies        int64           `json:"total_families"`
	TotalParents         int64           `json:"total_parents"`
	TotalChildren        int64           `json:"total_children"`
	TodayNewFamilies     int64           `json:"today_new_families"`
	TodayNewChildren     int64           `json:"today_new_children"`
	TodayActiveTasks     int64           `json:"today_active_tasks"`
	TodayCompletedTasks  int64           `json:"today_completed_tasks"`
	TodayIncomePoints    int64           `json:"today_income_points"`
	TodayExpensePoints   int64           `json:"today_expense_points"`
	TotalTasks           int64           `json:"total_tasks"`
	TotalRedeemOrders    int64           `json:"total_redeem_orders"`
	AIGeneratedTaskRatio float64         `json:"ai_generated_task_ratio"`
	TopHotTasks          []HotTaskDTO    `json:"top_hot_tasks"`
	TopRedeemItems       []RedeemItemDTO `json:"top_redeem_items"`
}

func (s *AdminDashboardService) GetOverviewStats() (*OverviewStatsDTO, error) {
	db := database.DB
	today := time.Now().Format("2006-01-02")

	result := &OverviewStatsDTO{
		TopHotTasks:    make([]HotTaskDTO, 0),
		TopRedeemItems: make([]RedeemItemDTO, 0),
	}

	db.Model(&model.Family{}).Count(&result.TotalFamilies)
	db.Model(&model.User{}).Where("role = ?", model.RoleParent).Count(&result.TotalParents)
	db.Model(&model.User{}).Where("role = ?", model.RoleChild).Count(&result.TotalChildren)
	db.Model(&model.Family{}).Where("DATE(created_at) = ?", today).Count(&result.TodayNewFamilies)
	db.Model(&model.User{}).Where("role = ? AND DATE(created_at) = ?", model.RoleChild, today).Count(&result.TodayNewChildren)

	db.Model(&model.Task{}).Where("DATE(created_at) = ? OR status IN ?", today, []int{model.TaskStatusInProgress, model.TaskStatusSubmitted}).Count(&result.TodayActiveTasks)
	db.Model(&model.Task{}).Where("status = ? AND DATE(updated_at) = ?", model.TaskStatusCompleted, today).Count(&result.TodayCompletedTasks)

	var incomeSum *int64
	db.Model(&model.Transaction{}).Where("type = ? AND DATE(created_at) = ?", model.TransactionTypeIncome, today).Select("COALESCE(SUM(amount), 0)").Scan(&incomeSum)
	if incomeSum != nil {
		result.TodayIncomePoints = *incomeSum
	}

	var expenseSum *int64
	db.Model(&model.Transaction{}).Where("type = ? AND DATE(created_at) = ?", model.TransactionTypeExpense, today).Select("COALESCE(SUM(amount), 0)").Scan(&expenseSum)
	if expenseSum != nil {
		result.TodayExpensePoints = *expenseSum
	}

	db.Model(&model.Task{}).Count(&result.TotalTasks)
	db.Model(&model.Redeem{}).Count(&result.TotalRedeemOrders)

	var aiCount int64
	db.Model(&model.Task{}).Where("ai_generated = ?", true).Count(&aiCount)
	if result.TotalTasks > 0 {
		result.AIGeneratedTaskRatio = math.Round(float64(aiCount)/float64(result.TotalTasks)*10000) / 10000
	}

	type taskCountRow struct {
		TaskID         uint
		CompletedCount int64
	}
	var taskCounts []taskCountRow
	relatedTypeTask := "task"
	db.Model(&model.Transaction{}).
		Select("related_id AS task_id, COUNT(*) AS completed_count").
		Where("related_type = ?", &relatedTypeTask).
		Group("related_id").
		Order("completed_count DESC").
		Limit(10).
		Scan(&taskCounts)

	taskIDMap := make(map[uint]int64)
	for _, r := range taskCounts {
		taskIDMap[r.TaskID] = r.CompletedCount
	}

	var tasks []model.Task
	taskIDs := make([]uint, 0, len(taskCounts))
	for _, r := range taskCounts {
		taskIDs = append(taskIDs, r.TaskID)
	}
	if len(taskIDs) > 0 {
		db.Where("id IN ?", taskIDs).Find(&tasks)
	}
	taskMap := make(map[uint]model.Task)
	for _, t := range tasks {
		taskMap[t.ID] = t
	}

	result.TopHotTasks = make([]HotTaskDTO, 0, len(taskCounts))
	for _, r := range taskCounts {
		if t, ok := taskMap[r.TaskID]; ok {
			result.TopHotTasks = append(result.TopHotTasks, HotTaskDTO{
				ID:             t.ID,
				Title:          t.Title,
				Category:       t.Category,
				Points:         t.Points,
				CompletedCount: r.CompletedCount,
			})
		}
	}

	if len(result.TopHotTasks) == 0 {
		var recentTasks []model.Task
		db.Order("created_at DESC").Limit(10).Find(&recentTasks)
		for _, t := range recentTasks {
			result.TopHotTasks = append(result.TopHotTasks, HotTaskDTO{
				ID:             t.ID,
				Title:          t.Title,
				Category:       t.Category,
				Points:         t.Points,
				CompletedCount: 0,
			})
		}
	}

	type redeemCountRow struct {
		ItemID        uint
		RedeemedCount int64
	}
	var redeemCounts []redeemCountRow
	db.Model(&model.Redeem{}).
		Select("item_id, COUNT(*) AS redeemed_count").
		Group("item_id").
		Order("redeemed_count DESC").
		Limit(10).
		Scan(&redeemCounts)

	itemIDs := make([]uint, 0, len(redeemCounts))
	for _, r := range redeemCounts {
		itemIDs = append(itemIDs, r.ItemID)
	}
	var items []model.RedeemItem
	if len(itemIDs) > 0 {
		db.Where("id IN ?", itemIDs).Find(&items)
	}
	itemMap := make(map[uint]model.RedeemItem)
	for _, it := range items {
		itemMap[it.ID] = it
	}

	result.TopRedeemItems = make([]RedeemItemDTO, 0, len(redeemCounts))
	for _, r := range redeemCounts {
		if it, ok := itemMap[r.ItemID]; ok {
			result.TopRedeemItems = append(result.TopRedeemItems, RedeemItemDTO{
				ID:            it.ID,
				Name:          it.Name,
				Points:        it.Points,
				RedeemedCount: r.RedeemedCount,
			})
		}
	}

	return result, nil
}

type TrendPoint struct {
	Date  string `json:"date"`
	Value int64  `json:"value"`
}

type GradeDistributionDTO struct {
	GradeLabel string `json:"grade_label"`
	Grade      *int   `json:"grade,omitempty"`
	Count      int64  `json:"count"`
}

type CategoryDistributionDTO struct {
	Category string `json:"category"`
	Count    int64  `json:"count"`
}

type RedeemCategoryDistributionDTO struct {
	Category int    `json:"category"`
	Name     string `json:"name"`
	Count    int64  `json:"count"`
}

type TrendStatsDTO struct {
	FamilyRegistrationTrend   []TrendPoint                  `json:"family_registration_trend"`
	TaskCompletionTrend       []TrendPoint                  `json:"task_completion_trend"`
	PointsIncomeTrend         []TrendPoint                  `json:"points_income_trend"`
	PointsExpenseTrend        []TrendPoint                  `json:"points_expense_trend"`
	GradeDistribution         []GradeDistributionDTO        `json:"grade_distribution"`
	TaskCategoryDistribution  []CategoryDistributionDTO     `json:"task_category_distribution"`
	RedeemCategoryDistribution []RedeemCategoryDistributionDTO `json:"redeem_category_distribution"`
}

func generateDateSeries(days int) []string {
	dates := make([]string, days)
	now := time.Now()
	for i := days - 1; i >= 0; i-- {
		d := now.AddDate(0, 0, -i)
		dates[days-1-i] = d.Format("2006-01-02")
	}
	return dates
}

func (s *AdminDashboardService) GetTrendStats(days int) (*TrendStatsDTO, error) {
	if days <= 0 {
		days = 30
	}
	db := database.DB
	dateSeries := generateDateSeries(days)

	famMap := make(map[string]int64)
	type famRow struct {
		Date  string
		Count int64
	}
	var famRows []famRow
	db.Model(&model.Family{}).
		Select("DATE(created_at) AS date, COUNT(*) AS count").
		Where("created_at >= ?", time.Now().AddDate(0, 0, -days+1)).
		Group("DATE(created_at)").
		Scan(&famRows)
	for _, r := range famRows {
		famMap[r.Date] = r.Count
	}

	taskMap := make(map[string]int64)
	var taskRows []famRow
	db.Model(&model.Task{}).
		Select("DATE(updated_at) AS date, COUNT(*) AS count").
		Where("status = ? AND updated_at >= ?", model.TaskStatusCompleted, time.Now().AddDate(0, 0, -days+1)).
		Group("DATE(updated_at)").
		Scan(&taskRows)
	for _, r := range taskRows {
		taskMap[r.Date] = r.Count
	}

	incomeMap := make(map[string]int64)
	type sumRow struct {
		Date string
		Sum  int64
	}
	var incomeRows []sumRow
	db.Model(&model.Transaction{}).
		Select("DATE(created_at) AS date, COALESCE(SUM(amount), 0) AS sum").
		Where("type = ? AND created_at >= ?", model.TransactionTypeIncome, time.Now().AddDate(0, 0, -days+1)).
		Group("DATE(created_at)").
		Scan(&incomeRows)
	for _, r := range incomeRows {
		incomeMap[r.Date] = r.Sum
	}

	expenseMap := make(map[string]int64)
	var expenseRows []sumRow
	db.Model(&model.Transaction{}).
		Select("DATE(created_at) AS date, COALESCE(SUM(amount), 0) AS sum").
		Where("type = ? AND created_at >= ?", model.TransactionTypeExpense, time.Now().AddDate(0, 0, -days+1)).
		Group("DATE(created_at)").
		Scan(&expenseRows)
	for _, r := range expenseRows {
		expenseMap[r.Date] = r.Sum
	}

	result := &TrendStatsDTO{
		FamilyRegistrationTrend:   make([]TrendPoint, 0, days),
		TaskCompletionTrend:       make([]TrendPoint, 0, days),
		PointsIncomeTrend:         make([]TrendPoint, 0, days),
		PointsExpenseTrend:        make([]TrendPoint, 0, days),
		GradeDistribution:         make([]GradeDistributionDTO, 0),
		TaskCategoryDistribution:  make([]CategoryDistributionDTO, 0),
		RedeemCategoryDistribution: make([]RedeemCategoryDistributionDTO, 0),
	}
	for _, d := range dateSeries {
		result.FamilyRegistrationTrend = append(result.FamilyRegistrationTrend, TrendPoint{Date: d, Value: famMap[d]})
		result.TaskCompletionTrend = append(result.TaskCompletionTrend, TrendPoint{Date: d, Value: taskMap[d]})
		result.PointsIncomeTrend = append(result.PointsIncomeTrend, TrendPoint{Date: d, Value: incomeMap[d]})
		result.PointsExpenseTrend = append(result.PointsExpenseTrend, TrendPoint{Date: d, Value: expenseMap[d]})
	}

	type gradeRow struct {
		Grade *int
		Count int64
	}
	var gradeRows []gradeRow
	db.Model(&model.User{}).
		Select("grade, COUNT(*) AS count").
		Where("role = ?", model.RoleChild).
		Group("grade").
		Scan(&gradeRows)
	for _, r := range gradeRows {
		label := "未设置"
		if r.Grade != nil {
			label = gradeLabel(*r.Grade)
		}
		result.GradeDistribution = append(result.GradeDistribution, GradeDistributionDTO{
			GradeLabel: label,
			Grade:      r.Grade,
			Count:      r.Count,
		})
	}

	type catRow struct {
		Category string
		Count    int64
	}
	var catRows []catRow
	db.Model(&model.Task{}).
		Select("category, COUNT(*) AS count").
		Group("category").
		Scan(&catRows)
	for _, r := range catRows {
		cat := r.Category
		if cat == "" {
			cat = "未分类"
		}
		result.TaskCategoryDistribution = append(result.TaskCategoryDistribution, CategoryDistributionDTO{
			Category: cat,
			Count:    r.Count,
		})
	}

	type redeemCatRow struct {
		Category int
		Count    int64
	}
	var redeemCatRows []redeemCatRow
	db.Table("redeems r").
		Select("ri.category, COUNT(*) AS count").
		Joins("LEFT JOIN redeem_items ri ON r.item_id = ri.id").
		Group("ri.category").
		Scan(&redeemCatRows)
	redeemCatNameMap := map[int]string{
		model.RedeemItemCategoryMaterial:   "物质奖励",
		model.RedeemItemCategoryExperience: "体验特权",
		model.RedeemItemCategoryOther:      "其他",
	}
	for _, r := range redeemCatRows {
		name, ok := redeemCatNameMap[r.Category]
		if !ok {
			name = "其他"
		}
		result.RedeemCategoryDistribution = append(result.RedeemCategoryDistribution, RedeemCategoryDistributionDTO{
			Category: r.Category,
			Name:     name,
			Count:    r.Count,
		})
	}

	return result, nil
}

func gradeLabel(g int) string {
	switch g {
	case 1:
		return "一年级"
	case 2:
		return "二年级"
	case 3:
		return "三年级"
	case 4:
		return "四年级"
	case 5:
		return "五年级"
	case 6:
		return "六年级"
	default:
		return "其他年级"
	}
}

type AbilityDimensionDTO struct {
	ID    uint   `json:"id"`
	Code  string `json:"code"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type AbilityRadarDTO struct {
	Dimensions  []AbilityDimensionDTO `json:"dimensions"`
	PlatformAvg []float64            `json:"platform_avg"`
	ByGrade     map[int][]float64   `json:"by_grade"`
}

func (s *AdminDashboardService) GetAbilityRadar() (*AbilityRadarDTO, error) {
	db := database.DB

	var dims []model.AbilityDimension
	if err := db.Order("sort_order ASC, id ASC").Find(&dims).Error; err != nil {
		return nil, err
	}

	result := &AbilityRadarDTO{
		Dimensions:  make([]AbilityDimensionDTO, 0, len(dims)),
		PlatformAvg: make([]float64, len(dims)),
		ByGrade:     make(map[int][]float64),
	}
	for _, d := range dims {
		result.Dimensions = append(result.Dimensions, AbilityDimensionDTO{
			ID:    d.ID,
			Code:  d.Code,
			Name:  d.Name,
			Color: d.Color,
		})
	}

	dimIDToIdx := make(map[uint]int)
	for i, d := range dims {
		dimIDToIdx[d.ID] = i
	}

	type avgRow struct {
		DimensionID uint
		AvgScore    float64
	}
	var avgRows []avgRow
	db.Model(&model.ChildAbilityScore{}).
		Select("dimension_id, AVG(score) AS avg_score").
		Group("dimension_id").
		Scan(&avgRows)
	for _, r := range avgRows {
		if idx, ok := dimIDToIdx[r.DimensionID]; ok {
			result.PlatformAvg[idx] = math.Round(r.AvgScore*100) / 100
		}
	}

	type gradeAvgRow struct {
		Grade       int
		DimensionID uint
		AvgScore    float64
	}
	var gradeAvgRows []gradeAvgRow
	db.Table("child_ability_scores cas").
		Select("u.grade, cas.dimension_id, AVG(cas.score) AS avg_score").
		Joins("LEFT JOIN users u ON cas.child_id = u.id").
		Where("u.role = ? AND u.grade IS NOT NULL", model.RoleChild).
		Group("u.grade, cas.dimension_id").
		Scan(&gradeAvgRows)

	for _, r := range gradeAvgRows {
		if _, ok := result.ByGrade[r.Grade]; !ok {
			result.ByGrade[r.Grade] = make([]float64, len(dims))
		}
		if idx, ok := dimIDToIdx[r.DimensionID]; ok {
			result.ByGrade[r.Grade][idx] = math.Round(r.AvgScore*100) / 100
		}
	}

	return result, nil
}
