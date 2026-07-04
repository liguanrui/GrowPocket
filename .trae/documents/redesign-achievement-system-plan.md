# 成就系统重新设计计划

## 当前状态分析

### 现有架构问题

当前成就系统存在以下核心问题：

1. **条件类型硬编码**：[achievement_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/service/achievement_service.go#L117-L143) 中的 `calculateCurrentValue` 使用 switch-case 硬编码了6种成就类型，新增类型需要修改代码

2. **缺少模板任务计数**：无法统计"完成某个模板任务的数量"

3. **缺少活动参与计数**：无法统计"累计参与活动的数量"

4. **无法重复获得**：[UserAchievement](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/model/achievement.go#L40-L48) 只有 `Unlocked` 标志，勋章只能获得一次

5. **手动触发**：需要调用 `CheckAndUnlock` API 才能检查成就，没有在数值变化时自动触发

6. **计数器与成就绑定**：每个成就都需要单独计算当前值，无法复用计数器

## 重新设计方案

### 核心设计思想

1. **抽象计数器层**：将系统内所有可累计的数值抽象为"计数器"，每个计数器独立管理
2. **事件驱动触发**：在关键业务操作后更新计数器，并自动检查相关成就
3. **支持重复获得**：成就达成后重置计数器，允许再次获得

### 新增/修改的数据模型

#### 1. CounterType 枚举（新增）

```go
const (
    CounterTypeTaskCount         = 1 // 完成任务的数量
    CounterTypeTemplateTaskCount = 2 // 完成某个模板任务的数量
    CounterTypeConsecutiveDays   = 3 // 连续完成任务的天数
    CounterTypeTotalPoints       = 4 // 累计获取积分数量
    CounterTypeActivityCount     = 5 // 累计参与活动的数量
)
```

#### 2. Achievement 模型修改

```go
type Achievement struct {
    ID            uint      `gorm:"primaryKey" json:"id"`
    FamilyID      uint      `gorm:"index" json:"family_id"`
    Name          string    `gorm:"size:50;not null" json:"name"`
    Description   string    `gorm:"size:200" json:"description"`
    Icon          string    `gorm:"size:100" json:"icon"`
    IconColor     string    `gorm:"size:20;default:'#FF9500'" json:"icon_color"`
    CounterType   int       `gorm:"not null" json:"counter_type"`       // 修改：使用计数器类型
    CounterTarget int       `gorm:"not null;default:0" json:"counter_target"` // 修改：计数器目标值
    TemplateID    uint      `gorm:"index" json:"template_id"`           // 新增：模板任务ID（CounterTypeTemplateTaskCount时必填）
    Points        int       `gorm:"not null;default:0" json:"points"`
    IsCustom      bool      `gorm:"not null;default:false" json:"is_custom"`
    CreatedBy     uint      `json:"created_by"`
    CreatedAt     time.Time `json:"created_at"`
    UpdatedAt     time.Time `json:"updated_at"`
}
```

**修改说明**：
- 将 `Type` → `CounterType`：使用统一的计数器类型
- 将 `TargetValue` → `CounterTarget`：计数器目标值
- 新增 `TemplateID`：用于筛选特定模板任务的计数

#### 3. UserCounter 模型（新增）

```go
type UserCounter struct {
    ID          uint      `gorm:"primaryKey" json:"id"`
    ChildID     uint      `gorm:"index;not null" json:"child_id"`
    CounterType int       `gorm:"not null;index" json:"counter_type"`
    TemplateID  uint      `gorm:"index" json:"template_id"`           // 模板任务ID（CounterTypeTemplateTaskCount时使用）
    CurrentValue int      `gorm:"not null;default:0" json:"current_value"`
    UpdatedAt   time.Time `json:"updated_at"`
}
```

**用途**：存储每个用户的各计数器当前值，避免重复计算

#### 4. AchievementAward 模型（新增）

```go
type AchievementAward struct {
    ID            uint      `gorm:"primaryKey" json:"id"`
    ChildID       uint      `gorm:"index;not null" json:"child_id"`
    AchievementID uint      `gorm:"not null;index" json:"achievement_id"`
    AwardedAt     time.Time `gorm:"not null" json:"awarded_at"`
    Points        int       `gorm:"not null;default:0" json:"points"`
    Achievement   Achievement `gorm:"foreignKey:AchievementID" json:"Achievement"`
}
```

**用途**：记录每次获得勋章的记录，支持重复获得

#### 5. UserAchievement 模型修改（可选）

保留用于展示进度，但新增 `AwardCount` 字段：

```go
type UserAchievement struct {
    ID            uint      `gorm:"primaryKey" json:"id"`
    ChildID       uint      `gorm:"index;not null" json:"child_id"`
    AchievementID uint      `gorm:"not null" json:"achievement_id"`
    AwardCount    int       `gorm:"not null;default:0" json:"award_count"` // 新增：获得次数
    CurrentValue  int       `gorm:"not null;default:0" json:"current_value"`
    Achievement   Achievement `gorm:"foreignKey:AchievementID" json:"Achievement"`
}
```

**修改说明**：
- 移除 `Unlocked` 和 `UnlockedAt`，改为 `AwardCount`
- 新增 `AwardCount`：记录获得次数

### 新增服务方法

#### 1. 计数器更新方法

```go
// IncrementCounter 增加计数器值
func (s *AchievementService) IncrementCounter(childID uint, counterType int, templateID uint, delta int) error

// ResetCounter 重置计数器值
func (s *AchievementService) ResetCounter(childID uint, counterType int, templateID uint) error

// GetCounterValue 获取计数器当前值
func (s *AchievementService) GetCounterValue(childID uint, counterType int, templateID uint) (int, error)
```

#### 2. 成就检查方法

```go
// CheckAchievements 检查并触发成就（内部方法）
func (s *AchievementService) CheckAchievements(childID uint, counterType int, templateID uint) ([]model.AchievementAward, error)

// AwardAchievement 颁发成就（内部方法）
func (s *AchievementService) AwardAchievement(childID uint, achievementID uint) (*model.AchievementAward, error)
```

#### 3. 查询方法

```go
// GetAchievementAwards 获取用户的成就获得记录
func (s *AchievementService) GetAchievementAwards(childID uint, achievementID uint) ([]model.AchievementAward, error)

// GetUserAchievements 获取用户成就进度（含获得次数）
func (s *AchievementService) GetUserAchievements(childID, familyID uint) ([]model.UserAchievement, error)
```

### 事件触发点

在以下业务操作后调用成就检查：

| 事件 | 计数器类型 | 触发位置 |
|------|-----------|---------|
| 任务完成 | CounterTypeTaskCount, CounterTypeTemplateTaskCount, CounterTypeConsecutiveDays | [task_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/service/task_service.go) ReviewTask |
| 积分获得 | CounterTypeTotalPoints | [score_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/service/score_service.go) Adjust |
| 活动参与 | CounterTypeActivityCount | [activity.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/handler/activity.go) 活动完成 |

### 连续天数计数器特殊处理

连续天数计数器需要特殊逻辑：
1. 每天首次完成任务时检查是否连续（与上一次完成日期比较）
2. 如果连续，增加计数器；否则重置为1
3. 在每日凌晨重置时，如果当天没有完成任务，连续天数重置为0

**实现方案**：
- 在 `UserCounter` 中增加 `LastUpdatedDate` 字段记录最后更新日期
- 任务完成时检查日期差，决定是否增加或重置

## 文件修改清单

### 1. 模型层

**修改**：[achievement.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/model/achievement.go)
- 修改 `Achievement` 结构体：`Type` → `CounterType`，`TargetValue` → `CounterTarget`，新增 `TemplateID`
- 修改 `UserAchievement` 结构体：移除 `Unlocked`/`UnlockedAt`，新增 `AwardCount`
- 新增 `CounterType` 常量枚举

**新增**：`counter.go`（或在 achievement.go 中）
- 新增 `UserCounter` 结构体
- 新增 `AchievementAward` 结构体

### 2. 服务层

**修改**：[achievement_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/service/achievement_service.go)
- 重写 `GetAchievements` → `GetUserAchievements`
- 删除 `CheckAndUnlock`，新增 `CheckAchievements`
- 删除 `calculateCurrentValue`，改用计数器机制
- 删除 `getConsecutiveDays`，改用计数器机制
- 新增 `IncrementCounter`、`ResetCounter`、`GetCounterValue`
- 新增 `AwardAchievement`、`GetAchievementAwards`
- 修改 `InitAchievements` 使用新的字段命名

**修改**：[task_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/service/task_service.go)
- 在 `ReviewTask` 任务通过后调用 `IncrementCounter` 更新相关计数器
- 调用 `CheckAchievements` 检查成就

**修改**：[score_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/service/score_service.go)
- 在 `Adjust` 增加积分后调用 `IncrementCounter` 更新积分计数器
- 调用 `CheckAchievements` 检查成就

**修改**：[community_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/service/community_service.go)
- 在 `JoinProject` 后调用 `IncrementCounter` 更新活动计数器
- 调用 `CheckAchievements` 检查成就

### 3. 处理器层

**修改**：[achievement.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/handler/achievement.go)
- 修改 `GetAchievements` 使用新方法
- 修改 `CheckAndUnlock` 使用新方法或标记为废弃
- 新增获取成就获得记录的接口

### 4. 数据库迁移

**新增**：`migrations/xxx_add_counter_tables.go`
- 创建 `user_counters` 表
- 创建 `achievement_awards` 表
- 修改 `achievements` 表：重命名字段、新增字段
- 修改 `user_achievements` 表：移除字段、新增字段

## 数据迁移策略

1. **旧数据迁移**：
   - 将旧的 `Type` → `CounterType`（直接映射）
   - 将旧的 `TargetValue` → `CounterTarget`（直接映射）
   - 将旧的 `UserAchievement.Unlocked` 转换为 `AwardCount`（true → 1, false → 0）
   - 根据现有数据初始化 `UserCounter`

2. **向后兼容**：
   - API 接口保持不变，内部逻辑迁移
   - 返回格式保持兼容，新增字段可选

## 风险与注意事项

1. **数据迁移风险**：需要确保迁移脚本正确执行，建议先备份数据
2. **事务一致性**：计数器更新和成就检查需要在同一事务中
3. **性能考虑**：计数器更新是高频操作，需要确保数据库索引优化
4. **连续天数重置**：需要考虑定时任务或在用户访问时检查重置

## 验证步骤

1. **编译验证**：`cd backend && go build ./...`
2. **数据库迁移**：执行迁移脚本
3. **单元测试**：编写计数器和成就检查的单元测试
4. **集成测试**：模拟任务完成、积分变动、活动参与，验证成就自动触发
5. **重复获得验证**：验证同一成就可以多次获得

---

## 实施步骤

### 阶段一：模型层重构（2天）
1. 修改 Achievement 模型
2. 修改 UserAchievement 模型
3. 新增 UserCounter 模型
4. 新增 AchievementAward 模型

### 阶段二：服务层重构（3天）
1. 实现计数器 CRUD 方法
2. 实现成就检查和颁发逻辑
3. 修改任务服务触发点
4. 修改积分服务触发点
5. 修改活动服务触发点

### 阶段三：处理器层调整（1天）
1. 修改现有 API 接口
2. 新增成就获得记录接口

### 阶段四：数据迁移与测试（2天）
1. 编写数据库迁移脚本
2. 编写单元测试
3. 集成测试验证
