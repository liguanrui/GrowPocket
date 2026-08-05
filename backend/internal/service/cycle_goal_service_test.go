package service

import (
	"encoding/json"
	"growpocket/internal/model"
	"testing"
	"time"
)

// TestCycleGoalService_SetGoal 验证 SetGoal 写入 cycle_goal_setting 表并返回正确字段
func TestCycleGoalService_SetGoal(t *testing.T) {
	db, _, parent, child := setupCycleTestDB(t)
	svc := NewCycleGoalService()

	targetDate := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC) // 周一
	goal, err := svc.SetGoal(child.ID, parent.ID, targetDate, 2, []uint{1, 2}, 200, "G3")
	if err != nil {
		t.Fatalf("SetGoal 失败: %v", err)
	}
	if goal == nil {
		t.Fatal("返回的目标为空")
	}

	// 验证返回的字段
	if goal.CycleLengthWeeks != 2 {
		t.Errorf("CycleLengthWeeks got %d want 2", goal.CycleLengthWeeks)
	}
	if goal.FocusDims != "[1,2]" {
		t.Errorf("FocusDims got %s want [1,2]", goal.FocusDims)
	}
	if goal.PointsTarget != 200 {
		t.Errorf("PointsTarget got %d want 200", goal.PointsTarget)
	}
	if goal.IsDefault != false {
		t.Errorf("IsDefault got %v want false", goal.IsDefault)
	}
	if goal.ChildID != child.ID {
		t.Errorf("ChildID got %d want %d", goal.ChildID, child.ID)
	}
	if goal.ParentUserID != parent.ID {
		t.Errorf("ParentUserID got %d want %d", goal.ParentUserID, parent.ID)
	}
	if goal.PointsTargetGrade != "G3" {
		t.Errorf("PointsTargetGrade got %s want G3", goal.PointsTargetGrade)
	}

	// 验证从数据库读回来字段一致
	var dbGoal model.CycleGoalSetting
	if err := db.First(&dbGoal, goal.ID).Error; err != nil {
		t.Fatalf("从数据库查询失败: %v", err)
	}
	if dbGoal.CycleLengthWeeks != 2 {
		t.Errorf("DB CycleLengthWeeks got %d want 2", dbGoal.CycleLengthWeeks)
	}
	if dbGoal.FocusDims != "[1,2]" {
		t.Errorf("DB FocusDims got %s want [1,2]", dbGoal.FocusDims)
	}
	if dbGoal.PointsTarget != 200 {
		t.Errorf("DB PointsTarget got %d want 200", dbGoal.PointsTarget)
	}
	if dbGoal.IsDefault != false {
		t.Errorf("DB IsDefault got %v want false", dbGoal.IsDefault)
	}
}

// TestCycleGoalService_GetGoal 验证 GetGoal 按 child_id + target_cycle_start_date 查询
func TestCycleGoalService_GetGoal(t *testing.T) {
	_, _, parent, child := setupCycleTestDB(t)
	svc := NewCycleGoalService()

	targetDate := time.Date(2025, 2, 3, 0, 0, 0, 0, time.UTC) // 周一
	// 先写入
	_, err := svc.SetGoal(child.ID, parent.ID, targetDate, 3, []uint{2, 3}, 300, "G4")
	if err != nil {
		t.Fatalf("SetGoal 失败: %v", err)
	}

	// 查询
	got, err := svc.GetGoal(child.ID, targetDate)
	if err != nil {
		t.Fatalf("GetGoal 失败: %v", err)
	}
	if got == nil {
		t.Fatal("返回的目标为空")
	}
	if got.CycleLengthWeeks != 3 {
		t.Errorf("CycleLengthWeeks got %d want 3", got.CycleLengthWeeks)
	}
	if got.FocusDims != "[2,3]" {
		t.Errorf("FocusDims got %s want [2,3]", got.FocusDims)
	}
	if got.PointsTarget != 300 {
		t.Errorf("PointsTarget got %d want 300", got.PointsTarget)
	}
	if got.PointsTargetGrade != "G4" {
		t.Errorf("PointsTargetGrade got %s want G4", got.PointsTargetGrade)
	}
	if got.ChildID != child.ID {
		t.Errorf("ChildID got %d want %d", got.ChildID, child.ID)
	}
}

// TestCycleGoalService_CalculateDefaultGoal 验证默认目标推算(CycleLengthWeeks=2 / 本年级主维 / 积分档位合理 / IsDefault=true)
func TestCycleGoalService_CalculateDefaultGoal(t *testing.T) {
	_, _, parent, child := setupCycleTestDB(t)
	svc := NewCycleGoalService()

	targetDate := time.Date(2025, 3, 3, 0, 0, 0, 0, time.UTC) // 周一
	goal, err := svc.CalculateDefaultGoal(child.ID, parent.ID, targetDate, "G3")
	if err != nil {
		t.Fatalf("CalculateDefaultGoal 失败: %v", err)
	}
	if goal == nil {
		t.Fatal("返回的默认目标为空")
	}

	// CycleLengthWeeks 固定为 2
	if goal.CycleLengthWeeks != 2 {
		t.Errorf("CycleLengthWeeks got %d want 2", goal.CycleLengthWeeks)
	}

	// FocusDims 含本年级主维(G3 主维为 [2])
	var dims []uint
	if err := json.Unmarshal([]byte(goal.FocusDims), &dims); err != nil {
		t.Fatalf("解析 FocusDims 失败: %v", err)
	}
	if len(dims) == 0 {
		t.Fatal("FocusDims 为空")
	}
	// G3 PRIMARY_DIMS = [2]
	expectedG3Primary := uint(2)
	found := false
	for _, d := range dims {
		if d == expectedG3Primary {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("FocusDims %v 不含 G3 主维 %d", dims, expectedG3Primary)
	}

	// PointsTarget 在合理范围 50-500 且必须为 50/100/200/300/500 档位
	validPoints := map[int]bool{50: true, 100: true, 200: true, 300: true, 500: true}
	if goal.PointsTarget < 50 || goal.PointsTarget > 500 {
		t.Errorf("PointsTarget got %d 超出 50-500 范围", goal.PointsTarget)
	}
	if !validPoints[goal.PointsTarget] {
		t.Errorf("PointsTarget got %d 不在 50/100/200/300/500 档位中", goal.PointsTarget)
	}

	// IsDefault 必须为 true
	if goal.IsDefault != true {
		t.Errorf("IsDefault got %v want true", goal.IsDefault)
	}
}

// TestCycleGoalService_ValidateGoal 验证目标参数合法性校验
func TestCycleGoalService_ValidateGoal(t *testing.T) {
	svc := NewCycleGoalService()

	cases := []struct {
		name             string
		cycleLengthWeeks uint
		focusDims        []uint
		pointsTarget     int
		expectError      bool
	}{
		{
			name:             "cycle_length_weeks=5(必须 1/2/3/4)",
			cycleLengthWeeks: 5,
			focusDims:        []uint{1, 2},
			pointsTarget:     200,
			expectError:      true,
		},
		{
			name:             "focus_dims 长度 4(必须 1-3 个)",
			cycleLengthWeeks: 2,
			focusDims:        []uint{1, 2, 3, 4},
			pointsTarget:     200,
			expectError:      true,
		},
		{
			name:             "focus_dims 长度 0(必须 1-3 个)",
			cycleLengthWeeks: 2,
			focusDims:        []uint{},
			pointsTarget:     200,
			expectError:      true,
		},
		{
			name:             "points_target=150(必须 50/100/200/300/500)",
			cycleLengthWeeks: 2,
			focusDims:        []uint{1, 2},
			pointsTarget:     150,
			expectError:      true,
		},
		{
			name:             "合法用例(2 周 / 2 维 / 200 分)",
			cycleLengthWeeks: 2,
			focusDims:        []uint{1, 2},
			pointsTarget:     200,
			expectError:      false,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := svc.ValidateGoal(c.cycleLengthWeeks, c.focusDims, c.pointsTarget)
			if c.expectError && err == nil {
				t.Errorf("期望返回 error 但得到 nil")
			}
			if !c.expectError && err != nil {
				t.Errorf("期望无 error 但得到: %v", err)
			}
		})
	}
}
