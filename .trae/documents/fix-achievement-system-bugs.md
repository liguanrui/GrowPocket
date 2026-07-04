# 成就系统 BUG 修复计划

## 当前状态分析

经过对成就系统代码的全面审查，发现以下 BUG：

### BUG 1: `GetAchievements` 未按家庭过滤自定义成就（严重）

**文件**: [achievement_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/service/achievement_service.go#L14-L37)

`GetAchievements` 方法中，`database.DB.Find(&achievements)` 查询了**所有**成就记录，包括其他家庭的自定义勋章。这意味着孩子 A 可以看到孩子 B 所属家庭的自定义勋章。

**正确行为**: 应只返回系统预置成就（`family_id = 0`）+ 当前家庭的自定义成就。

### BUG 2: `CheckAndUnlock` 同样未按家庭过滤（严重）

**文件**: [achievement_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/service/achievement_service.go#L39-L86)

`CheckAndUnlock` 调用 `GetAchievements`，继承了 BUG 1 的问题，会检查和尝试解锁其他家庭的自定义成就。且该函数只接收 `childID`，没有 `familyID` 参数，无法正确过滤。

### BUG 3: `AchievementTypeFirstTask` 和 `AchievementTypeTaskCount` 逻辑重复（中等）

**文件**: [achievement_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/service/achievement_service.go#L117-L143)

`AchievementTypeFirstTask`（type=1）和 `AchievementTypeTaskCount`（type=4）的 `calculateCurrentValue` 逻辑完全相同——都是统计已完成任务数。这意味着"初露锋芒"（TargetValue=1）和"勤劳小蜜蜂"（TargetValue=10）其实可以用同一种类型来计算，type=1 是冗余的。

虽然不影响功能正确性，但 type=1 的初露锋芒成就完全可以用 type=4 替代。这不是严格的 BUG，暂不修复。

### BUG 4: 自定义成就的 `custom_type` 字段在模型中不存在（中等）

**文件**: [achievement.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/model/achievement.go#L14)

注释中提到了 `custom_type` 字段（1=任务完成次数, 2=累计积分, 3=连续天数, 4=兑换次数, 5=公益参与次数），但 `Achievement` 结构体中**没有定义这个字段**。自定义成就的 `Type` 字段可以填任意值，而 `calculateCurrentValue` 只处理了 1-6 的类型，如果自定义成就使用了 `custom_type` 语义的值，计算逻辑会走到 `default` 分支返回 0，永远无法解锁。

**影响**: 自定义勋章创建时，如果 type 值与系统预置类型 1-6 不同，将永远无法解锁。当前前端自定义勋章创建界面如果传了 custom_type 对应的值（如 1-5），会与系统类型冲突；如果不传或传其他值，则无法计算。

### BUG 5: `getConsecutiveDays` 连续天数计算有误（严重）

**文件**: [achievement_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/service/achievement_service.go#L146-L175)

问题：
1. **只取 31 条任务记录**：`Limit(31)` 意味着如果一天完成多个任务，31条记录可能只覆盖很短的天数，无法正确计算30天连续成就
2. **同一天多任务的处理有漏洞**：当 `diff == 0`（同一天）时被跳过，不增加连续天数，这是正确的。但循环只检查了 `diff == 1` 的情况，如果中间有一天完成了0个任务（diff > 1），直接 break。这个逻辑本身没问题，但结合 Limit(31) 的限制，可能导致计算不准确
3. **未考虑"今天"是否已完成任务**：连续天数应该从今天开始往前数，但代码没有验证最近一天是否是今天。如果用户昨天完成了任务但今天还没完成，按当前逻辑仍然会返回连续天数，这可能不符合"连续"的语义

### BUG 6: `addAchievementPoints` 中积分类型 `Type: 0` 使用了硬编码（低）

**文件**: [achievement_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/service/achievement_service.go#L97-L103)

Transaction 的 `Type: 0` 是硬编码，应使用 `model.TransactionTypeIncome` 常量。同样在 `calculateCurrentValue` 中 `type = 0` 也是硬编码（第127行）。

### BUG 7: `CheckAndUnlock` 中非解锁路径的 Update 未处理错误（低）

**文件**: [achievement_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/fix-check-achievement-system-bug-baiqPC/backend/internal/service/achievement_service.go#L81)

第81行 `database.DB.Model(...).Update(...)` 的返回错误被忽略了。

---

## 修复方案

### 修复 BUG 1 & 2: GetAchievements 和 CheckAndUnlock 按家庭过滤

1. `GetAchievements` 增加 `familyID` 参数，查询成就时加上 `family_id = 0 OR family_id = ?` 条件
2. `CheckAndUnlock` 增加 `familyID` 参数，传递给 `GetAchievements`
3. Handler 层从 JWT token 或请求参数中获取 `familyID` 并传递

**涉及文件**:
- `backend/internal/service/achievement_service.go`: 修改 `GetAchievements` 和 `CheckAndUnlock` 签名及查询逻辑
- `backend/internal/handler/achievement.go`: 从 context 获取 familyID 传入

### 修复 BUG 5: getConsecutiveDays 连续天数计算

1. 改为按日期去重后查询，而不是限制任务条数
2. 验证最近一天是否是今天或昨天（根据业务语义决定）
3. 正确处理同一天多任务的情况

**涉及文件**:
- `backend/internal/service/achievement_service.go`: 重写 `getConsecutiveDays` 方法

### 修复 BUG 6: 硬编码替换

将 `Type: 0` 和 `type = 0` 替换为 `model.TransactionTypeIncome`。

**涉及文件**:
- `backend/internal/service/achievement_service.go`: 第97行和第127行

### 修复 BUG 7: 错误处理

处理第81行 `Update` 返回的错误。

**涉及文件**:
- `backend/internal/service/achievement_service.go`: 第81行

### 暂不修复

- **BUG 3**: FirstTask 和 TaskCount 逻辑重复 — 功能正确，重构可后续考虑
- **BUG 4**: custom_type 字段缺失 — 需要更详细的产品设计讨论，且当前自定义勋章仍可使用 type 1-6

---

## 验证步骤

1. 确认修改后编译通过：`cd backend && go build ./...`
2. 运行现有测试：`cd backend && go test ./...`
3. 手动验证：
   - 家庭 A 的自定义勋章不会出现在家庭 B 的成就列表中
   - 连续天数成就能正确计算（包括一天多任务、跨天等场景）
   - 解锁成就后积分正确增加，Transaction 类型正确
