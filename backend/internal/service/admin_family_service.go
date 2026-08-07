package service

import (
	"encoding/json"
	"errors"
	"growpocket/internal/model"
	"growpocket/pkg/util"
	"sort"
	"time"

	"gorm.io/gorm"
)

type AdminFamilyService struct {
	db         *gorm.DB
	logService *AdminAuthService
}

func NewAdminFamilyService(db *gorm.DB, logService *AdminAuthService) *AdminFamilyService {
	return &AdminFamilyService{db: db, logService: logService}
}

type FamilyListDTO struct {
	ID           uint      `json:"id"`
	Name         string    `json:"name"`
	CreatedAt    time.Time `json:"created_at"`
	ParentCount  int       `json:"parent_count"`
	ChildCount   int       `json:"child_count"`
	TotalBalance int       `json:"total_balance"`
	TaskCount    int64     `json:"task_count"`
	RedeemCount  int64     `json:"redeem_count"`
	IsActive     bool      `json:"is_active"`
}

type PaginationResult[T any] struct {
	Items    []T   `json:"items"`
	Total    int64 `json:"total"`
	Page     int   `json:"page"`
	PageSize int   `json:"page_size"`
}

func NewPaginationResult[T any](items []T, total int64, pag util.Pagination) *PaginationResult[T] {
	return &PaginationResult[T]{
		Items:    items,
		Total:    total,
		Page:     pag.Page,
		PageSize: pag.PageSize,
	}
}

type familyAgg struct {
	FamilyID     uint
	ParentCount  int
	ChildCount   int
	TotalBalance int
	TaskCount    int64
	RedeemCount  int64
}

func (s *AdminFamilyService) ListFamilies(pag util.Pagination, search string, statusFilter string, sortBy string, order string) (*PaginationResult[FamilyListDTO], error) {
	needsAggSort := sortBy == "tasks" || sortBy == "balance"

	baseWhere := s.db.Model(&model.Family{})
	if search != "" {
		searchLike := "%" + search + "%"
		sub := s.db.Model(&model.User{}).
			Select("DISTINCT family_id").
			Where("role = ? AND nickname ILIKE ?", model.RoleParent, searchLike)
		baseWhere = baseWhere.Where("name ILIKE ? OR id IN (?)", searchLike, sub)
	}
	switch statusFilter {
	case "active":
		baseWhere = baseWhere.Where("is_active = ?", true)
	case "inactive":
		baseWhere = baseWhere.Where("is_active = ?", false)
	}

	var total int64
	if err := baseWhere.Count(&total).Error; err != nil {
		return nil, err
	}

	var allFamilyIDs []uint
	if needsAggSort {
		if err := baseWhere.Pluck("id", &allFamilyIDs).Error; err != nil {
			return nil, err
		}
	} else {
		sortSQL := "created_at DESC"
		if sortBy == "name" {
			sortDir := "DESC"
			if order == "asc" {
				sortDir = "ASC"
			}
			sortSQL = "name " + sortDir
		}

		type famRow struct {
			ID        uint
			Name      string
			CreatedAt time.Time
			IsActive  bool
		}
		var rows []famRow
		if err := baseWhere.Select("id, name, created_at, is_active").
			Order(sortSQL).Offset(pag.Offset()).Limit(pag.Limit()).Scan(&rows).Error; err != nil {
			return nil, err
		}

		familyIDs := make([]uint, 0, len(rows))
		for _, r := range rows {
			familyIDs = append(familyIDs, r.ID)
		}
		aggMap := s.aggregateFamilies(familyIDs)
		result := make([]FamilyListDTO, 0, len(rows))
		for _, r := range rows {
			agg := aggMap[r.ID]
			result = append(result, FamilyListDTO{
				ID:           r.ID,
				Name:         r.Name,
				CreatedAt:    r.CreatedAt,
				ParentCount:  agg.ParentCount,
				ChildCount:   agg.ChildCount,
				TotalBalance: agg.TotalBalance,
				TaskCount:    agg.TaskCount,
				RedeemCount:  agg.RedeemCount,
				IsActive:     r.IsActive,
			})
		}
		return NewPaginationResult(result, total, pag), nil
	}

	if len(allFamilyIDs) == 0 {
		return NewPaginationResult[FamilyListDTO]([]FamilyListDTO{}, total, pag), nil
	}

	aggMap := s.aggregateFamilies(allFamilyIDs)

	type famBase struct {
		ID        uint
		Name      string
		CreatedAt time.Time
		IsActive  bool
	}
	var baseRows []famBase
	s.db.Model(&model.Family{}).Select("id, name, created_at, is_active").
		Where("id IN ?", allFamilyIDs).Scan(&baseRows)
	baseMap := make(map[uint]famBase, len(baseRows))
	for _, b := range baseRows {
		baseMap[b.ID] = b
	}

	fullList := make([]FamilyListDTO, 0, len(allFamilyIDs))
	for _, fid := range allFamilyIDs {
		b := baseMap[fid]
		a := aggMap[fid]
		fullList = append(fullList, FamilyListDTO{
			ID:           fid,
			Name:         b.Name,
			CreatedAt:    b.CreatedAt,
			ParentCount:  a.ParentCount,
			ChildCount:   a.ChildCount,
			TotalBalance: a.TotalBalance,
			TaskCount:    a.TaskCount,
			RedeemCount:  a.RedeemCount,
			IsActive:     b.IsActive,
		})
	}

	cmpDir := 1
	if order == "asc" {
		cmpDir = -1
	}
	if sortBy == "tasks" {
		dir := cmpDir
		sort.SliceStable(fullList, func(i, j int) bool {
			return (fullList[i].TaskCount - fullList[j].TaskCount) * int64(dir) > 0
		})
	} else if sortBy == "balance" {
		dir := cmpDir
		sort.SliceStable(fullList, func(i, j int) bool {
			return (fullList[i].TotalBalance - fullList[j].TotalBalance) * dir > 0
		})
	}

	start := pag.Offset()
	end := start + pag.Limit()
	if start > len(fullList) {
		start = len(fullList)
	}
	if end > len(fullList) {
		end = len(fullList)
	}
	pagedItems := fullList[start:end]
	if pagedItems == nil {
		pagedItems = []FamilyListDTO{}
	}
	return NewPaginationResult(pagedItems, total, pag), nil
}

func (s *AdminFamilyService) aggregateFamilies(familyIDs []uint) map[uint]familyAgg {
	result := make(map[uint]familyAgg, len(familyIDs))
	for _, id := range familyIDs {
		result[id] = familyAgg{FamilyID: id}
	}

	type countRow struct {
		FamilyID uint
		Cnt      int
	}

	var parents []countRow
	s.db.Model(&model.User{}).
		Select("family_id, COUNT(*) as cnt").
		Where("family_id IN ? AND role = ?", familyIDs, model.RoleParent).
		Group("family_id").Scan(&parents)
	for _, r := range parents {
		a := result[r.FamilyID]
		a.ParentCount = r.Cnt
		result[r.FamilyID] = a
	}

	var children []countRow
	s.db.Model(&model.User{}).
		Select("family_id, COUNT(*) as cnt").
		Where("family_id IN ? AND role = ?", familyIDs, model.RoleChild).
		Group("family_id").Scan(&children)
	for _, r := range children {
		a := result[r.FamilyID]
		a.ChildCount = r.Cnt
		result[r.FamilyID] = a
	}

	type balRow struct {
		FamilyID uint
		Sum      int
	}
	var bals []balRow
	s.db.Model(&model.User{}).
		Select("family_id, COALESCE(SUM(balance),0) as sum").
		Where("family_id IN ? AND role = ?", familyIDs, model.RoleChild).
		Group("family_id").Scan(&bals)
	for _, r := range bals {
		a := result[r.FamilyID]
		a.TotalBalance = r.Sum
		result[r.FamilyID] = a
	}

	type cnt64Row struct {
		FamilyID uint
		Cnt      int64
	}
	var tasks []cnt64Row
	s.db.Model(&model.Task{}).
		Select("family_id, COUNT(*) as cnt").
		Where("family_id IN ?", familyIDs).
		Group("family_id").Scan(&tasks)
	for _, r := range tasks {
		a := result[r.FamilyID]
		a.TaskCount = r.Cnt
		result[r.FamilyID] = a
	}

	childIDsQuery := s.db.Model(&model.User{}).Select("id").Where("family_id IN ? AND role = ?", familyIDs, model.RoleChild)
	var redeems []cnt64Row
	s.db.Model(&model.Redeem{}).
		Select("u.family_id, COUNT(*) as cnt").
		Joins("LEFT JOIN users u ON u.id = redeems.child_id").
		Where("redeems.child_id IN (?)", childIDsQuery).
		Group("u.family_id").Scan(&redeems)
	for _, r := range redeems {
		a := result[r.FamilyID]
		a.RedeemCount = r.Cnt
		result[r.FamilyID] = a
	}

	return result
}

type TaskStats struct {
	Total     int64 `json:"total"`
	Completed int64 `json:"completed"`
	Pending   int64 `json:"pending"`
	Rejected  int64 `json:"rejected"`
}

type AbilityScoreDTO struct {
	DimensionID    uint    `json:"dimension_id"`
	DimensionCode  string  `json:"dimension_code"`
	DimensionName  string  `json:"dimension_name"`
	DimensionColor string  `json:"dimension_color"`
	Score          float64 `json:"score"`
}

type ChildDetailDTO struct {
	ID                uint            `json:"id"`
	FamilyID          uint            `json:"family_id"`
	Role              string          `json:"role"`
	Nickname          string          `json:"nickname"`
	Avatar            string          `json:"avatar,omitempty"`
	Gender            *int            `json:"gender,omitempty"`
	Birthday          *time.Time      `json:"birthday,omitempty"`
	Grade             *int            `json:"grade,omitempty"`
	GradeOverridden   bool            `json:"grade_overridden,omitempty"`
	Age               *int            `json:"age,omitempty"`
	Hobbies           string          `json:"hobbies,omitempty"`
	Balance           int             `json:"balance"`
	CreatedAt         time.Time       `json:"created_at"`
	FamilyName        string          `json:"family_name"`
	TotalPointsEarned int64           `json:"total_points_earned"`
	TotalPointsSpent  int64           `json:"total_points_spent"`
	TaskStats         TaskStats       `json:"task_stats"`
	GrowthCycleCount  int64           `json:"growth_cycle_count"`
	AbilityScores     []AbilityScoreDTO `json:"ability_scores"`
}

type FamilyDetailDTO struct {
	Family             model.Family     `json:"family"`
	Parents            []model.User     `json:"parents"`
	Children           []ChildDetailDTO `json:"children"`
	RecentTasks        []model.Task     `json:"recent_tasks"`
	RecentTransactions []model.Transaction `json:"recent_transactions"`
	RecentRedeems      []model.Redeem   `json:"recent_redeems"`
}

func (s *AdminFamilyService) GetFamilyDetail(familyID uint) (*FamilyDetailDTO, error) {
	var family model.Family
	if err := s.db.First(&family, familyID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("家庭不存在")
		}
		return nil, err
	}

	var parents []model.User
	if err := s.db.Where("family_id = ? AND role = ?", familyID, model.RoleParent).Find(&parents).Error; err != nil {
		return nil, err
	}

	var childUsers []model.User
	if err := s.db.Where("family_id = ? AND role = ?", familyID, model.RoleChild).Find(&childUsers).Error; err != nil {
		return nil, err
	}

	children := s.buildChildDetailDTOs(childUsers, family.Name)

	var recentTasks []model.Task
	s.db.Where("family_id = ?", familyID).Order("created_at DESC").Limit(20).Find(&recentTasks)

	var recentTransactions []model.Transaction
	childIDs := make([]uint, 0, len(childUsers))
	for _, cu := range childUsers {
		childIDs = append(childIDs, cu.ID)
	}
	if len(childIDs) > 0 {
		s.db.Where("child_id IN ?", childIDs).Order("created_at DESC").Limit(20).Find(&recentTransactions)
	}

	var recentRedeems []model.Redeem
	if len(childIDs) > 0 {
		s.db.Where("child_id IN ?", childIDs).Order("created_at DESC").Limit(20).Find(&recentRedeems)
	}

	return &FamilyDetailDTO{
		Family:             family,
		Parents:            parents,
		Children:           children,
		RecentTasks:        ifNilEmptyTasks(recentTasks),
		RecentTransactions: ifNilEmptyTransactions(recentTransactions),
		RecentRedeems:      ifNilEmptyRedeems(recentRedeems),
	}, nil
}

func ifNilEmptyTasks(v []model.Task) []model.Task {
	if v == nil {
		return []model.Task{}
	}
	return v
}
func ifNilEmptyTransactions(v []model.Transaction) []model.Transaction {
	if v == nil {
		return []model.Transaction{}
	}
	return v
}
func ifNilEmptyRedeems(v []model.Redeem) []model.Redeem {
	if v == nil {
		return []model.Redeem{}
	}
	return v
}
func ifNilEmptyAbilityScores(v []AbilityScoreDTO) []AbilityScoreDTO {
	if v == nil {
		return []AbilityScoreDTO{}
	}
	return v
}

func (s *AdminFamilyService) buildChildDetailDTOs(users []model.User, fallbackFamilyName string) []ChildDetailDTO {
	if len(users) == 0 {
		return []ChildDetailDTO{}
	}

	childIDs := make([]uint, 0, len(users))
	familyIDs := make([]uint, 0, len(users))
	famSet := make(map[uint]struct{})
	for _, u := range users {
		childIDs = append(childIDs, u.ID)
		if _, ok := famSet[u.FamilyID]; !ok {
			famSet[u.FamilyID] = struct{}{}
			familyIDs = append(familyIDs, u.FamilyID)
		}
	}

	famNames := make(map[uint]string)
	var famRows []struct {
		ID   uint
		Name string
	}
	s.db.Model(&model.Family{}).Select("id, name").Where("id IN ?", familyIDs).Scan(&famRows)
	for _, r := range famRows {
		famNames[r.ID] = r.Name
	}

	earned := make(map[uint]int64)
	spent := make(map[uint]int64)
	type sumRow struct {
		ChildID uint
		Sum     int64
	}
	var earnedRows []sumRow
	s.db.Model(&model.Transaction{}).
		Select("child_id, COALESCE(SUM(amount),0) as sum").
		Where("child_id IN ? AND type = ?", childIDs, model.TransactionTypeIncome).
		Group("child_id").Scan(&earnedRows)
	for _, r := range earnedRows {
		earned[r.ChildID] = r.Sum
	}
	var spentRows []sumRow
	s.db.Model(&model.Transaction{}).
		Select("child_id, COALESCE(SUM(amount),0) as sum").
		Where("child_id IN ? AND type = ?", childIDs, model.TransactionTypeExpense).
		Group("child_id").Scan(&spentRows)
	for _, r := range spentRows {
		spent[r.ChildID] = r.Sum
	}

	taskStats := make(map[uint]TaskStats)
	type statRow struct {
		ChildID uint
		Status  int
		Cnt     int64
	}
	var statRows []statRow
	s.db.Model(&model.Task{}).
		Select("child_id, status, COUNT(*) as cnt").
		Where("child_id IN ?", childIDs).
		Group("child_id, status").Scan(&statRows)
	for _, r := range statRows {
		ts := taskStats[r.ChildID]
		ts.Total += r.Cnt
		switch r.Status {
		case model.TaskStatusCompleted:
			ts.Completed = r.Cnt
		case model.TaskStatusInProgress, model.TaskStatusSubmitted:
			ts.Pending += r.Cnt
		case model.TaskStatusRejected:
			ts.Rejected = r.Cnt
		}
		taskStats[r.ChildID] = ts
	}

	gcCount := make(map[uint]int64)
	var gcRows []sumRow
	s.db.Model(&model.GrowthCycle{}).
		Select("child_id, COUNT(*) as sum").
		Where("child_id IN ?", childIDs).
		Group("child_id").Scan(&gcRows)
	for _, r := range gcRows {
		gcCount[r.ChildID] = r.Sum
	}

	type scoreRow struct {
		ChildID        uint
		DimensionID    uint
		DimensionCode  string
		DimensionName  string
		DimensionColor string
		Score          int
	}
	var scoreRows []scoreRow
	s.db.Model(&model.ChildAbilityScore{}).
		Select("child_ability_scores.child_id, child_ability_scores.dimension_id, ability_dimensions.code as dimension_code, ability_dimensions.name as dimension_name, ability_dimensions.color as dimension_color, child_ability_scores.score").
		Joins("LEFT JOIN ability_dimensions ON ability_dimensions.id = child_ability_scores.dimension_id").
		Where("child_ability_scores.child_id IN ?", childIDs).
		Scan(&scoreRows)
	scores := make(map[uint][]AbilityScoreDTO)
	for _, r := range scoreRows {
		scores[r.ChildID] = append(scores[r.ChildID], AbilityScoreDTO{
			DimensionID:    r.DimensionID,
			DimensionCode:  r.DimensionCode,
			DimensionName:  r.DimensionName,
			DimensionColor: r.DimensionColor,
			Score:          float64(r.Score),
		})
	}

	result := make([]ChildDetailDTO, 0, len(users))
	for _, u := range users {
		fn := famNames[u.FamilyID]
		if fn == "" {
			fn = fallbackFamilyName
		}
		ts := taskStats[u.ID]
		result = append(result, ChildDetailDTO{
			ID:                u.ID,
			FamilyID:          u.FamilyID,
			Role:              u.Role,
			Nickname:          u.Nickname,
			Avatar:            u.Avatar,
			Gender:            u.Gender,
			Birthday:          u.Birthday,
			Grade:             u.Grade,
			GradeOverridden:   u.GradeOverridden,
			Age:               u.Age,
			Hobbies:           u.Hobbies,
			Balance:           u.Balance,
			CreatedAt:         u.CreatedAt,
			FamilyName:        fn,
			TotalPointsEarned: earned[u.ID],
			TotalPointsSpent:  spent[u.ID],
			TaskStats:         ts,
			GrowthCycleCount:  gcCount[u.ID],
			AbilityScores:     ifNilEmptyAbilityScores(scores[u.ID]),
		})
	}
	return result
}

func (s *AdminFamilyService) ToggleFamilyStatus(familyID uint, adminID uint, adminName string, reason string, ip string, userAgent string) (bool, error) {
	var family model.Family
	if err := s.db.First(&family, familyID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, errors.New("家庭不存在")
		}
		return false, err
	}

	newIsActive := !family.IsActive
	if err := s.db.Model(&family).Update("is_active", newIsActive).Error; err != nil {
		return false, err
	}

	detail, _ := json.Marshal(map[string]interface{}{
		"family_id":    familyID,
		"to_is_active": newIsActive,
		"reason":       reason,
	})
	if s.logService != nil {
		s.logService.RecordOperationLog(adminID, adminName, "family.toggle_status", "family", familyID, string(detail), ip, userAgent)
	}

	return newIsActive, nil
}

type ChildListStats struct {
	TaskTotal     int64    `json:"task_total"`
	TaskCompleted int64    `json:"task_completed"`
	RedeemCount   int64    `json:"redeem_count"`
	GrowthIndex   *float64 `json:"growth_index"`
}

type ChildListDTO struct {
	ID              uint         `json:"id"`
	FamilyID        uint         `json:"family_id"`
	FamilyName      string       `json:"family_name"`
	Role            string       `json:"role"`
	Nickname        string       `json:"nickname"`
	Avatar          string       `json:"avatar,omitempty"`
	Gender          *int         `json:"gender,omitempty"`
	Birthday        *time.Time   `json:"birthday,omitempty"`
	Grade           *int         `json:"grade,omitempty"`
	Age             *int         `json:"age,omitempty"`
	Hobbies         string       `json:"hobbies,omitempty"`
	Balance         int          `json:"balance"`
	CreatedAt       time.Time    `json:"created_at"`
	Stats           ChildListStats `json:"stats"`
}

func (s *AdminFamilyService) ListChildren(pag util.Pagination, search string, grade int, familyID uint) (*PaginationResult[ChildListDTO], error) {
	db := s.db.Model(&model.User{}).Where("role = ?", model.RoleChild)

	if search != "" {
		db = db.Where("nickname ILIKE ?", "%"+search+"%")
	}
	if grade > 0 {
		db = db.Where("grade = ?", grade)
	}
	if familyID > 0 {
		db = db.Where("family_id = ?", familyID)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	var childUsers []model.User
	if err := db.Order("created_at DESC").Offset(pag.Offset()).Limit(pag.Limit()).Find(&childUsers).Error; err != nil {
		return nil, err
	}

	if len(childUsers) == 0 {
		return NewPaginationResult[ChildListDTO]([]ChildListDTO{}, total, pag), nil
	}

	childIDs := make([]uint, 0, len(childUsers))
	famIDs := make([]uint, 0, len(childUsers))
	famSet := make(map[uint]struct{})
	for _, u := range childUsers {
		childIDs = append(childIDs, u.ID)
		if _, ok := famSet[u.FamilyID]; !ok {
			famSet[u.FamilyID] = struct{}{}
			famIDs = append(famIDs, u.FamilyID)
		}
	}

	famNames := make(map[uint]string)
	type famRow struct {
		ID   uint
		Name string
	}
	var fRows []famRow
	s.db.Model(&model.Family{}).Select("id, name").Where("id IN ?", famIDs).Scan(&fRows)
	for _, r := range fRows {
		famNames[r.ID] = r.Name
	}

	type cntRow struct {
		ChildID uint
		Cnt     int64
	}
	taskTotals := make(map[uint]int64)
	taskCompleteds := make(map[uint]int64)

	var tTotals []cntRow
	s.db.Model(&model.Task{}).
		Select("child_id, COUNT(*) as cnt").
		Where("child_id IN ?", childIDs).
		Group("child_id").Scan(&tTotals)
	for _, r := range tTotals {
		taskTotals[r.ChildID] = r.Cnt
	}
	var tCompleteds []cntRow
	s.db.Model(&model.Task{}).
		Select("child_id, COUNT(*) as cnt").
		Where("child_id IN ? AND status = ?", childIDs, model.TaskStatusCompleted).
		Group("child_id").Scan(&tCompleteds)
	for _, r := range tCompleteds {
		taskCompleteds[r.ChildID] = r.Cnt
	}

	redeemCounts := make(map[uint]int64)
	var rCounts []cntRow
	s.db.Model(&model.Redeem{}).
		Select("child_id, COUNT(*) as cnt").
		Where("child_id IN ?", childIDs).
		Group("child_id").Scan(&rCounts)
	for _, r := range rCounts {
		redeemCounts[r.ChildID] = r.Cnt
	}

	type idxRow struct {
		ChildID uint
		Avg     float64
	}
	growthIdx := make(map[uint]float64)
	var iRows []idxRow
	s.db.Model(&model.ChildAbilityScore{}).
		Select("child_id, AVG(score) as avg").
		Where("child_id IN ?", childIDs).
		Group("child_id").Scan(&iRows)
	for _, r := range iRows {
		growthIdx[r.ChildID] = r.Avg
	}

	result := make([]ChildListDTO, 0, len(childUsers))
	for _, u := range childUsers {
		dto := ChildListDTO{
			ID:        u.ID,
			FamilyID:  u.FamilyID,
			FamilyName: famNames[u.FamilyID],
			Role:      u.Role,
			Nickname:  u.Nickname,
			Avatar:    u.Avatar,
			Gender:    u.Gender,
			Birthday:  u.Birthday,
			Grade:     u.Grade,
			Age:       u.Age,
			Hobbies:   u.Hobbies,
			Balance:   u.Balance,
			CreatedAt: u.CreatedAt,
			Stats: ChildListStats{
				TaskTotal:     taskTotals[u.ID],
				TaskCompleted: taskCompleteds[u.ID],
				RedeemCount:   redeemCounts[u.ID],
			},
		}
		if v, ok := growthIdx[u.ID]; ok {
			dto.Stats.GrowthIndex = &v
		}
		result = append(result, dto)
	}

	return NewPaginationResult(result, total, pag), nil
}

func (s *AdminFamilyService) GetChildDetail(childID uint) (*ChildDetailDTO, error) {
	var user model.User
	if err := s.db.Where("id = ? AND role = ?", childID, model.RoleChild).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("孩子不存在")
		}
		return nil, err
	}
	dtos := s.buildChildDetailDTOs([]model.User{user}, "")
	if len(dtos) == 0 {
		return nil, errors.New("孩子不存在")
	}
	return &dtos[0], nil
}

func (s *AdminFamilyService) ListParents(pag util.Pagination, search string, familyID uint) (*PaginationResult[model.User], error) {
	db := s.db.Model(&model.User{}).Where("role = ?", model.RoleParent)
	if search != "" {
		db = db.Where("nickname ILIKE ?", "%"+search+"%")
	}
	if familyID > 0 {
		db = db.Where("family_id = ?", familyID)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	var users []model.User
	if err := db.Order("created_at DESC").Offset(pag.Offset()).Limit(pag.Limit()).Find(&users).Error; err != nil {
		return nil, err
	}

	for i := range users {
		users[i].Password = ""
	}

	return NewPaginationResult(users, total, pag), nil
}
