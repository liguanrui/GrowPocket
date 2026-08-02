# 儿童基础信息与新手指引 V3 PRD

> 修订日期：2026-08-01
> 状态：待评审

## 0. 背景与现状梳理

基于现有代码的调研结论（**作为 PRD 事实锚点，避免与现状冲突**）：

### 0.1 数据模型现状
- 后端模型：`backend/internal/model/user.go#L10-L32` 的 `User` 表（role=child 为孩子档案）
  - 已有字段：`Birthday *time.Time`（✅ 生日字段已存在，但**未被 Onboarding 采集**）
  - 已有字段：`Age *int`（冗余字段，建议由 Birthday 动态推算）
  - 已有字段：`Grade *int`（1-6 年级，需与 Birthday 联动滚动）
  - 已有字段：`Hobbies string`（JSON 数组，已在 Onboarding 采集）
  - Balance 字段默认 0
- **当前状态**：Birthday 字段仅在「设置 → 家庭管理 → 手动添加/编辑孩子」时可录入，Onboarding 指引只采集 `age`（整数 6-12）和 `grade`（1-6），**未采集 Birthday，导致年龄和年级每年死停，不会自动滚动**。

### 0.2 新手指引（Onboarding）现状
- 前端：`frontend/src/pages/OnboardingPage.tsx`
- 现有步骤（6 步）：
  1. **Step 1 欢迎页**：仅显示"嗨！我是小萌芽🌱，一颗会陪着你一起长大的小种子"——**缺少平台简介，家长首次进入不知道"这平台是干嘛的"**
  2. Step 2 姓名：儿童昵称（`nickname`）
  3. Step 3 年龄/年级：手动点选 age(6-12) + grade(1-6)，**无 Birthday 日期选择**
  4. Step 4 爱好：多选兴趣标签 → 存 `Hobbies` JSON
  5. Step 5 问卷预告：告知题量 → 跳转 `/questionnaire`
  6. Step 6 问卷回归后：能力雷达图 → 阶段目标 → AI 任务生成 → 进入成长主页
- 积分发放：当前代码中 **Onboarding 全流程未对 balance 做任何加法**（`addChild` 服务、问卷 submit、Step 6 goalSave、任务 generate 均无"新手指引完成积分奖励"调用）—— 所以当前"完成指引不会加积分"符合用户要求，无需额外改动；需在 PRD 中**明确规定保持此行为，避免后续误加**。

### 0.3 家庭管理现状
- 前端：`frontend/src/pages/FamilySettingsPage.tsx`
- **添加孩子流程（+ 按钮）**：打开 `ChildForm` 弹窗（姓名、生日、性别 3 项），提交后调用 `handleAddChild` → `childService.addChild` → **直接跳转到 `/questionnaire?stage=register`**
  - ❌ **BUG/缺口**：当前添加孩子直接走"简单表单+问卷"，**不会触发 Onboarding 新手指引游戏化流程**（无 IP 互动、无爱好收集、无 Step 6 目标设置），体验差异极大
- **编辑孩子流程（铅笔按钮）**：打开 `ChildForm` 弹窗（同样只有 姓名/生日/性别 3 项）
  - ❌ **缺口**：无法修改 `grade`、`age`、`hobbies` 3 个核心基础字段
- 删除孩子：有（确认弹窗 + deleteChild）
- 孩子列表卡片：展示 `nickname + birthday + 性别emoji`

---

## 1. PRD 目标（用户 5 条需求逐条对应）

| # | 用户需求 | 对应实现章节 |
|---|---|---|
| 1 | 指引中应该录入**出生年月**，来推算年龄；这样每年的年龄和年级都会滚动 | 第 2 章 Birthday 化改造 + 第 4 章滚动逻辑 |
| 2 | 指引 Step 1 应该**简要介绍平台**，方便家长/儿童认知 | 第 3 章 Step 1 改版 |
| 3 | **指引完成之后不会增加积分** | 第 5 章：明确禁止项 + 防回归测试点 |
| 4 | 设置 → 管理家庭模块，可以**修改儿童基础信息**（完整字段） | 第 6 章：家庭管理「编辑孩子」弹窗扩展 |
| 5 | 设置中**添加一个孩子**，重新触发 Onboarding 指引流程 | 第 7 章：添加孩子路径改造 |

---

## 2. 儿童基础信息 Birthday 化改造

### 2.1 唯一可信源（Single Source of Truth）

| 字段 | 作为可信源？ | 说明 |
|---|---|---|
| `Birthday (date)` | ✅ **唯一可信源** | 所有展示与下游服务均基于 Birthday 推算 |
| `Age (int)` | ⚠️ 冗余缓存 | 写操作废弃只读，读取时 Birthday 存在则优先 `computeAge(Birthday)` 实时算；Birthday 为空（历史老数据）才 fallback 到 Age 字段 |
| `Grade (int)` | ⚠️ 可覆盖缓存 | **默认由 Birthday 自动推算**（9 月 1 日入学规则，见 2.2）；当家长手动覆盖设置时以手动值为准，并记录 `grade_overridden=true` |

> 不删 Age/Grade 字段（向下兼容已有数据与 API），但在 UI 与新写入中统一以 Birthday 为主驱动。

### 2.2 年龄/年级自动推算规则（中国学制）

```
age = floor((today - birthday) / 365.25)        // 或用闰年安全的 time.Since 分年计算

// 年级推算（默认按"9/1 入学"规则）
入学年龄 = 6 岁
基准年 = 若 today.month >= 9  → 年 = today.year；否则 → today.year - 1
入学年 = birthday.year + 入学年龄
// 若生日月份在 9 月之后（下半年出生），则按规则实际下一年才入学，+1 年调整
diff_years = 基准年 - 入学年
if birthday.month >= 9: diff_years -= 1
grade = diff_years + 1
// 边界
grade = clamp(grade, 0, 6)   // 0=幼儿园/未入学，1-6=小学一至六年级
```

### 2.3 后端改造点
- **能力服务**：`task_generation_service.go#L142`（`computeAge`）已基于 Birthday 实现 ✅ 保留；新增对无 Birthday 记录时 fallback Age 字段的兼容逻辑
- **推荐服务**：`handler/task_recommend.go#L43` 已传 birthday ✅ 保留
- **列表 API**：`childrenService.getChildren / childStore` 响应时新增派生字段 `derived_age`、`derived_grade`、`grade_overridden`（由服务端计算好前端直接展示，避免两端算不一致）
- **写 API**：`children / POST / PATCH` 保存时：
  - 若收到 `birthday` → 回算并刷新 `age` 冗余字段、**grade 若未被覆盖则刷新为自动推算值**；
  - 若仅收到 `grade` 且无 birthday → 标记 `grade_overridden = true`（User 模型需新增字段或存 hobbies JSON 旁）

### 2.4 前端改造点（Onboarding Step 3 年龄/年级改版）
- 删掉 6-12 数字按钮（age 选择）
- 改为 **Birthday 日期选择器**（`<input type="date">`，限制 `max=今天`，合理 `min` 如 10 年前）
- 选好 Birthday 后：
  - 右侧/下方即时显示「当前 X 岁 · 小学 X 年级 · 今年 X 月 X 日过生日 🎂」
  - 年级区加一行小字「按 9/1 入学规则自动推算，**不对？手动调整**」链接，点展开 grade 1-6 覆盖选择（覆盖后存 `grade_overridden=true`）
- Step 5 问卷预告：`level` 档位由 `grade → gradeToLevel(grade)`（保持 6 档 L1-L6），不改动现有题库映射

---

## 3. Onboarding Step 1 改版：加入平台简介

### 3.1 内容（3 段式，暖橙/米色配色，配图为小萌芽 + 关键场景图标）

**顶部 IP 对话气泡（IPPAvatar + expression=happy，96px，弹跳呼吸动画）**：
> 嗨！我是小萌芽 🌱 一颗会和小朋友一起"长大"的小种子～

**主标题**：
> 童劳童得 · 陪孩子认真长大的家庭成长伙伴

**3 个能力卡片（横向滚动/竖排，每张卡片含图标 + 标题 + 一行简介）**：

| 图标 | 标题 | 简介 |
|---|---|---|
| 🎯 目标任务 | **任务·目标·积分** | 完成适合的小任务，积分兑换家庭小奖励 |
| 🌱 六维成长 | **AI 六维能力评估** | 专属问卷了解孩子，AI 个性化生成每日成长任务 |
| 📖 成长故事 | **阶段回顾·成长故事** | 每月回顾能力变化，生成可珍藏的成长故事绘本 |

**底部 CTA 按钮（保持不变文案）**：「开始我们的旅程 →」

> 字数与视觉密度要求：不超过一屏，移动端 400px 宽机型可完整显示无需滚动；配一张 IP 形象即可，不堆图。

---

## 4. 每年年龄/年级自动滚动（无感知）

### 4.1 触发点
**方案：懒计算（Lazy）+ 服务端派生，不做定时任务**
- 所有展示 Child 基础信息的位置：列表、任务页顶栏、成长页顶栏、兑换、设置 → **全部从服务端响应的 `derived_age / derived_grade` 取值**
- 每次 `children / GET` / `current child / GET` 时服务端按 2.2 规则实时计算并返回（毫秒级开销，远低于定时任务复杂度）

### 4.2 生日当天微彩蛋（可选 P1）
- 若 `today == MM-DD of Birthday`（忽略年份）：首页 IP 头像切换 expression=encourage + 头顶顶一行小字「🎂 今天是 {nickname} 的{age}岁生日！」
- 不发积分（不违反第 3 条；如需发请独立评审）

---

## 5. 明确约束：Onboarding 完成不增加积分

### 5.1 不可触发积分增量的动作清单（白名单制：以下不允许调用 balance++ 或发放积分 API）

| 动作 | 是否加积分 | 备注 |
|---|---|---|
| Onboarding Step 5 创建 Child 档案（addChild） | ❌ 明确禁止 | |
| Register 问卷提交完成 | ❌ 明确禁止 | 能力基线初始化，非任务奖励 |
| Step 6 阶段目标保存（goalSave） | ❌ 明确禁止 | |
| Step 6 AI 任务 generate 完成 | ❌ 明确禁止 | |
| Onboarding 走完 → 进入成长主页 | ❌ 明确禁止 | 本条即用户原需求 3 |
| 日常任务验收通过 | ✅ 保留现有 | 唯一合法的任务积分入口 |

### 5.2 回归测试点（开发/QA 时必检）
- 新建孩子后 `balance` 字段：DB 默认值 0，指引全部走完后查询仍为 0
- 不写入任何 Transaction（积分流水），类型不得含 `onboarding_bonus`、`welcome` 等欢迎奖励
- 若后续误加：需在 `balance update` 统一入口处 + "source类型白名单"守卫

---

## 6. 设置 → 家庭管理：编辑孩子基础信息（完整字段）

**文件**：`frontend/src/pages/FamilySettingsPage.tsx` 的 `ChildForm` 弹窗（当前仅 3 项：姓名/生日/性别）。

### 6.1 编辑弹窗扩展为 5 组字段

| 分组 | 字段 | 组件 | 约束 |
|---|---|---|---|
| 基本 | 姓名 `nickname` | text input | 2-20 字符，必填 |
| 基本 | 性别 `gender` | 2 选 1 胶囊 👦/👧 | 必填 |
| 年龄 | 生日 `birthday` | date picker | 必选；选后即时显示「X 岁 · 小学 X 年级 · 推算」 |
| 年龄 | 年级 `grade` | 1-6 年级选择器 + "按生日推算/手动覆盖"开关 | 默认禁用（推算值灰显），打开开关后可选，选后存覆盖标记 |
| 兴趣 | 爱好 `hobbies` | 12 标签多选（与 Onboarding Step 4 同一数据源 HOBBY_TAGS） | 可不选但建议选 1-6 项 |

### 6.2 提交行为
- 走 `childStore.updateChild(id, {...allFields})`（**已有 API，直接复用** ✅ `childStore.ts#L26 updateChild` 支持全部字段）
- 保存成功 Toast：「儿童信息已更新」；若 grade 或 birthday 变更则追加一行小字提醒「问卷档位与任务生成偏好将在下次生成时调整」

### 6.3 孩子列表卡片信息丰富化
当前只显示 `nickname + birthday`；改为：
> {昵称}
> {X 岁} · {小学 X 年级} · {生日} · {性别}
> 爱好：{截取前 3 个，超 3 显示 +N}

---

## 7. 设置中添加一个孩子：触发 Onboarding 指引流程

**文件**：`FamilySettingsPage.tsx#L129-L141 handleAddChild`（当前：简单表单 → 直接跳问卷）。

### 7.1 新流程
1. 点击 `+` 按钮 / 「添加第一个孩子档案」卡片
2. ✅ **不再打开 ChildForm**
3. 跳转至 `/onboarding?mode=add_child`（保留 step=1、无 child_id）
4. 完整走完 Onboarding Step 1→6（平台简介 → 姓名 → 生日/年级 → 爱好 → 问卷预告 → 问卷 → Step 6 目标 → 任务生成）
5. Step 6 末尾「进入成长主页」按钮：
   - 若是 `add_child` 模式：跳回 `/settings/family`（回到家庭管理列表看新增的孩子）
   - 若是首次注册的默认模式：正常跳转 `/growth` 成长主页

### 7.2 兼容性处理
- 老版本 URL 保留：`/onboarding`（无参数）= 默认首次注册模式；`?mode=add_child` 决定 Step 6 末跳转目标
- 「家庭管理」添加孩子**仍保留一个紧急 fallback**：极端场景（如 Onboarding 挂了）下管理员可通过长按 + 按钮 3 秒打开原始精简 ChildForm 弹窗直接填（灰度开关，避免入口卡死）

---

## 8. 涉及改动清单（与现有代码一一对应，便于出 tasks/spec 时拆解）

| 模块 | 文件/位置 | 改动类型 | 影响 PRD 章节 |
|---|---|---|---|
| 后端模型 | `internal/model/user.go` | Grade 覆盖标记、冗余字段刷新规则 | 2.1 / 2.3 |
| 后端服务 | `internal/service/child_service.go` Create/Update | birthday→age/grade 回写、派生字段 | 2.3 / 6 |
| 后端 Handler | `internal/handler/children.go` GET 响应 | derived_age / derived_grade / grade_overridden 计算返回 | 4.1 |
| 前端 Onboarding | `pages/OnboardingPage.tsx` Step 1 | 平台简介三卡片改版 | 第 3 章 |
| 前端 Onboarding | `pages/OnboardingPage.tsx` Step 3 | age 按钮 → birthday 日期选择 + grade 推算/覆盖 UI | 2.4 |
| 前端 Onboarding | `pages/OnboardingPage.tsx` handleStartQuestionnaire | addChild payload 改为传 `birthday`，age/grade 由派生或覆盖传 | 2.4 |
| 前端 Onboarding | `pages/OnboardingPage.tsx` Step 6 末跳转 | 根据 `mode=add_child` 跳 settings/family 或 /growth | 7.1 |
| 前端家庭管理 | `pages/FamilySettingsPage.tsx` ChildForm | 扩展 grade + hobbies；birthday→推算联动 | 第 6 章 |
| 前端家庭管理 | `pages/FamilySettingsPage.tsx` handleAddChild | 删掉跳问卷，改为 navigate('/onboarding?mode=add_child') | 第 7 章 |
| 前端 childStore | `stores/childStore.ts` updateChild / addChild | 字段契约与后端一致（birthday 主，grade 覆盖标记） | 2.x / 6 / 7 |
| 全局积分入口 | balance update 统一入口 | source 白名单守卫禁止 onboarding 来源加积分 | 第 5 章 |
| 测试/编译 | tsc --noEmit / go build | 无类型错误、编译通过 | 全 PRD |

---

## 9. 验收清单（Checklist，30 项）

### 9.1 Birthday 主驱动（2.1-2.4, 4.x）
- [ ] Onboarding Step 3 有 birthday 日期选择器（不再是 6-12 数字按钮）
- [ ] 选 birthday 后显示「X 岁 · 小学 X 年级 · X 月 X 日生日」
- [ ] Grade 默认推算 + "不对？手动调整"链接 → 手动覆盖可保存 grade_overridden
- [ ] 孩子列表展示 derived_age / derived_grade（不直接读 Age 字段）
- [ ] 过了生日 + 9/1 开学日后，无需手动修改，derived 字段自动跳变
- [ ] 后端 child GET 响应含 derived_age / derived_grade / grade_overridden 三个派生字段
- [ ] 历史老数据（无 Birthday 有 Age）列表正常显示不报错（fallback Age 字段）

### 9.2 Step 1 平台简介（第 3 章）
- [ ] Step 1 标题仍保留 IP 自我介绍气泡
- [ ] 下方出现「童劳童得 · 陪孩子认真长大的家庭成长伙伴」主标题
- [ ] 下方出现 3 张平台能力卡片：任务积分 / 六维成长 / 成长故事
- [ ] Step 1 总高度：一屏内（400px 宽 ≤ 680px 高机型）不滚动
- [ ] CTA 按钮文案仍为「开始我们的旅程」

### 9.3 指引不加积分（第 5 章）
- [ ] 完整走完 Onboarding(注册后) + 问卷 + Step 6 + 任务 generate：DB 查询 child.balance == 0
- [ ] Transaction 积分流水表不含 onboarding/welcome 类型记录
- [ ] 若手动添加"欢迎积分"代码，CI / 白名单守卫会拦截（PR 时验证）

### 9.4 家庭管理编辑孩子（第 6 章）
- [ ] 点击编辑（铅笔）打开的弹窗含：姓名/生日/性别/年级（含推算+覆盖开关）/爱好
- [ ] 爱好与 Onboarding Step 4 同标签库、已选状态正确回填
- [ ] 修改生日 → grade 推算值即时刷新；覆盖开关切换正常
- [ ] 保存后 toast 「儿童信息已更新」
- [ ] 修改生日/年级 → 下次 AI 任务生成时使用新年龄档位（可通过 DB 查 prompt 或日志验证）
- [ ] 孩子列表卡片显示「X 岁 · 小学 X 年级 · 生日 · 性别 · 前 3 个爱好 +N」

### 9.5 设置添加孩子 → 重走 Onboarding（第 7 章）
- [ ] 点「+ 按钮」或「添加第一个孩子」卡片 → 跳 /onboarding?mode=add_child（不打开 ChildForm 精简弹窗）
- [ ] mode=add_child 下 Onboarding Step 1-6 流程体验与首次注册完全一致
- [ ] Step 6 末"进入成长主页"按钮点击后跳回 `/settings/family`（而不是 /growth），能看到新增的孩子出现在列表首位
- [ ] 长按 + 按钮 3 秒 fallback：仍能打开精简 ChildForm（极端场景兜底，可测）

### 9.6 回归兼容
- [ ] `tsc --noEmit` 通过
- [ ] `go build ./...` 通过
- [ ] 老流程：注册成功 → 跳 Onboarding → 问卷 → Step 6 → /growth 仍完整可用（不回退）
- [ ] 旧数据：已创建的无 Birthday 孩子，列表/详情不报错、仍可编辑（编辑时首次填入 Birthday）

---

**— PRD 完 —**
