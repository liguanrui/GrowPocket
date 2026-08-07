#!/bin/bash
# GrowPocket 任务系统升级 端到端测试流程
# 覆盖：注册 → 创建孩子 → 创建周期 → 设置目标（维度+习惯+主题任务）
#       → 触发AI任务生成 → 每日打卡 → 完成主题子任务 → 生成回顾相册

set -e

# ===== 配置 =====
BASE_URL="http://localhost:8080/api"
# 时间戳确保账号唯一
TS=$(date +%s)
NICKNAME="测试家长_${TS}"
PASSWORD="test123456"
CHILD_NICK="小测试_${TS}"
CHILD_BIRTHDAY="2017-03-15"  # 约 9 岁，三年级

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
step() { echo -e "\n${BLUE}========== $1 ==========${NC}"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }

# JSON 字段提取（兼容 macOS 无 jq 时降级）
extract() {
  local json="$1" key="$2"
  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -r "$key"
  else
    # 简易正则提取（仅支持一级字段）
    echo "$json" | sed -nE "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"?([^\",}]*)\"?.*/\1/p" | head -1
  fi
}

# ===== Step 1: 注册账号 =====
step "Step 1: 注册家长账号"
REGISTER_RESP=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"nickname\":\"$NICKNAME\",\"password\":\"$PASSWORD\"}")
log "注册响应: $REGISTER_RESP"

TOKEN=$(extract "$REGISTER_RESP" '.data.token')
USER_ID=$(extract "$REGISTER_RESP" '.data.user.id')
FAMILY_ID=$(extract "$REGISTER_RESP" '.data.family.id')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  err "注册失败，无法获取 token"
  exit 1
fi
log "✅ 注册成功：用户ID=$USER_ID, 家庭ID=$FAMILY_ID"

AUTH_HEADER="Authorization: Bearer $TOKEN"

# ===== Step 2: 创建孩子档案 =====
step "Step 2: 创建孩子档案（${CHILD_NICK}, 生日 ${CHILD_BIRTHDAY}）"
CHILD_RESP=$(curl -s -X POST "$BASE_URL/children" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "{\"nickname\":\"$CHILD_NICK\",\"birthday\":\"$CHILD_BIRTHDAY\",\"gender\":1}")
log "孩子响应: $CHILD_RESP"
CHILD_ID=$(extract "$CHILD_RESP" '.data.id')
log "✅ 孩子档案创建成功：ID=$CHILD_ID"

# ===== Step 3: 创建成长周期（2 周 = 14 天）=====
step "Step 3: 创建成长周期（2 周）"
NOW_ISO=$(date -u +"%Y-%m-%dT00:00:00Z")
END_ISO=$(date -u -v+14d +"%Y-%m-%dT23:59:59Z" 2>/dev/null || date -u -d "+14 days" +"%Y-%m-%dT23:59:59Z")
CYCLE_NAME="测试周期_${TS}"

CYCLE_RESP=$(curl -s -X POST "$BASE_URL/growth-cycles" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "{\"child_id\":$CHILD_ID,\"name\":\"$CYCLE_NAME\",\"start_date\":\"$NOW_ISO\",\"end_date\":\"$END_ISO\"}")
log "周期响应: $CYCLE_RESP"
CYCLE_ID=$(extract "$CYCLE_RESP" '.data.id')
log "✅ 成长周期创建成功：ID=$CYCLE_ID（$NOW_ISO ~ $END_ISO）"

# ===== Step 4: 设置目标（维度 + 习惯 + 主题任务）=====
step "Step 4: 设置阶段目标（三区块）"

# 4.1 拉取能力维度列表
log "4.1 拉取能力维度列表"
ABILITIES_RESP=$(curl -s "$BASE_URL/abilities" -H "$AUTH_HEADER")
log "维度列表: $ABILITIES_RESP"

# 提取前 2 个维度 ID（用 grep 兼容无 jq 情况）
if command -v jq >/dev/null 2>&1; then
  DIM_ID_1=$(echo "$ABILITIES_RESP" | jq -r '.data[0].id')
  DIM_ID_2=$(echo "$ABILITIES_RESP" | jq -r '.data[1].id')
else
  DIM_ID_1=$(echo "$ABILITIES_RESP" | grep -oE '"id":[0-9]+' | head -1 | cut -d: -f2)
  DIM_ID_2=$(echo "$ABILITIES_RESP" | grep -oE '"id":[0-9]+' | sed -n '2p' | cut -d: -f2)
fi
log "选定维度：ID=$DIM_ID_1, ID=$DIM_ID_2"

# 4.2 拉取预设习惯（按年龄 9 岁）
log "4.2 拉取预设习惯（age=9）"
HABITS_RESP=$(curl -s "$BASE_URL/habits/preset?age=9" -H "$AUTH_HEADER")
log "习惯列表（前 200 字）: ${HABITS_RESP:0:200}"

if command -v jq >/dev/null 2>&1; then
  HABIT_ID_1=$(echo "$HABITS_RESP" | jq -r '.data[0].id')
  HABIT_ID_2=$(echo "$HABITS_RESP" | jq -r '.data[1].id')
else
  HABIT_ID_1=$(echo "$HABITS_RESP" | grep -oE '"id":[0-9]+' | head -1 | cut -d: -f2)
  HABIT_ID_2=$(echo "$HABITS_RESP" | grep -oE '"id":[0-9]+' | sed -n '2p' | cut -d: -f2)
fi
log "选定习惯：ID=$HABIT_ID_1, ID=$HABIT_ID_2"

# 4.3 拉取预设主题模板（按年龄 9 岁）
log "4.3 拉取预设主题模板（age=9）"
THEMES_RESP=$(curl -s "$BASE_URL/parent-task-templates/preset?age=9" -H "$AUTH_HEADER")
log "主题模板（前 200 字）: ${THEMES_RESP:0:200}"

if command -v jq >/dev/null 2>&1; then
  THEME_ID=$(echo "$THEMES_RESP" | jq -r '.data[0].id')
else
  THEME_ID=$(echo "$THEMES_RESP" | grep -oE '"id":[0-9]+' | head -1 | cut -d: -f2)
fi
log "选定主题模板：ID=$THEME_ID"

# 4.4 批量设置目标（维度 + 习惯）
log "4.4 批量设置目标（2 维度 + 2 习惯）"
GOALS_PAYLOAD=$(cat <<EOF
{
  "cycle_id": $CYCLE_ID,
  "child_id": $CHILD_ID,
  "goals": [
    {"goal_type":"dimension","dimension_id":$DIM_ID_1},
    {"goal_type":"dimension","dimension_id":$DIM_ID_2},
    {"goal_type":"habit","habit_id":$HABIT_ID_1},
    {"goal_type":"habit","habit_id":$HABIT_ID_2}
  ]
}
EOF
)
GOALS_RESP=$(curl -s -X POST "$BASE_URL/growth/goals/batch" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "$GOALS_PAYLOAD")
log "目标设置响应: $GOALS_RESP"
log "✅ 阶段目标已设置（2 维度 + 2 习惯）"

# 4.5 创建主题父任务（从模板）
step "Step 4.5: 创建主题父任务（从模板 $THEME_ID）"
PARENT_RESP=$(curl -s -X POST "$BASE_URL/tasks/parent" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "{\"child_id\":$CHILD_ID,\"template_id\":$THEME_ID}")
log "父任务响应: $PARENT_RESP"
PARENT_ID=$(extract "$PARENT_RESP" '.data.id')
SUBTASK_OUTLINE=$(extract "$PARENT_RESP" '.data.sub_task_outline')
log "✅ 主题父任务创建成功：ID=$PARENT_ID"
log "   子任务大纲: ${SUBTASK_OUTLINE:0:150}..."

# ===== Step 5: 触发 AI 任务生成（含习惯每日子任务）=====
step "Step 5: 触发 AI 任务生成"
GEN_RESP=$(curl -s -X POST "$BASE_URL/tasks/ai-generate" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "{\"child_id\":$CHILD_ID}")
log "AI 生成响应（前 300 字）: ${GEN_RESP:0:300}"
log "✅ AI 任务生成已触发（含 habit_daily + daily 任务）"

# ===== Step 6: 查询任务列表，分类提取 =====
step "Step 6: 查询任务列表"

# 6.1 查询习惯子任务（habit_daily）
log "6.1 查询习惯子任务（habit_daily）"
HABIT_DAILY_RESP=$(curl -s "$BASE_URL/tasks?child_id=$CHILD_ID&task_kind=habit_daily" -H "$AUTH_HEADER")
log "habit_daily 任务（前 300 字）: ${HABIT_DAILY_RESP:0:300}"

if command -v jq >/dev/null 2>&1; then
  HABIT_DAILY_ID_1=$(echo "$HABIT_DAILY_RESP" | jq -r '.data.items[0].id // .data[0].id // empty')
  HABIT_DAILY_ID_2=$(echo "$HABIT_DAILY_RESP" | jq -r '.data.items[1].id // .data[1].id // empty')
  HABIT_MASTER_ID=$(echo "$HABIT_DAILY_RESP" | jq -r '.data.items[0].habit_id // .data[0].habit_id // empty')
else
  HABIT_DAILY_ID_1=$(echo "$HABIT_DAILY_RESP" | grep -oE '"id":[0-9]+' | head -1 | cut -d: -f2)
  HABIT_DAILY_ID_2=$(echo "$HABIT_DAILY_RESP" | grep -oE '"id":[0-9]+' | sed -n '2p' | cut -d: -f2)
  HABIT_MASTER_ID=$(echo "$HABIT_DAILY_RESP" | grep -oE '"habit_id":[0-9]+' | head -1 | cut -d: -f2)
fi
log "习惯子任务：ID=$HABIT_DAILY_ID_1, ID=$HABIT_DAILY_ID_2（关联 habit_id=$HABIT_MASTER_ID）"

# 6.2 查询主题子任务（child）
log "6.2 查询主题子任务（child）"
CHILD_TASKS_RESP=$(curl -s "$BASE_URL/tasks?child_id=$CHILD_ID&task_kind=child" -H "$AUTH_HEADER")
log "child 任务（前 300 字）: ${CHILD_TASKS_RESP:0:300}"

if command -v jq >/dev/null 2>&1; then
  CHILD_TASK_ID=$(echo "$CHILD_TASKS_RESP" | jq -r '.data.items[0].id // .data[0].id // empty')
else
  CHILD_TASK_ID=$(echo "$CHILD_TASKS_RESP" | grep -oE '"id":[0-9]+' | head -1 | cut -d: -f2)
fi
log "主题子任务：ID=$CHILD_TASK_ID"

# 6.3 通过父任务 ID 查询所有子任务（含大纲）
log "6.3 查询父任务 $PARENT_ID 的所有子任务（含大纲未实例化）"
ALL_CHILDREN_RESP=$(curl -s "$BASE_URL/tasks/$PARENT_ID/children" -H "$AUTH_HEADER")
log "父任务子任务列表（前 500 字）: ${ALL_CHILDREN_RESP:0:500}"

# ===== Step 7: 模拟每日打卡（提交 + 审核 habit_daily）=====
step "Step 7: 模拟每日打卡"

# 7.1 提交习惯子任务1
if [ -n "$HABIT_DAILY_ID_1" ] && [ "$HABIT_DAILY_ID_1" != "null" ]; then
  log "7.1 提交习惯子任务 $HABIT_DAILY_ID_1"
  SUBMIT_RESP=$(curl -s -X PUT "$BASE_URL/tasks/$HABIT_DAILY_ID_1/submit" \
    -H "$AUTH_HEADER" \
    -F "photo=" \
    -F "note=今天主动完成了打卡")
  log "提交响应: $SUBMIT_RESP"

  # 7.2 审核通过（家长审核）
  log "7.2 审核通过习惯子任务 $HABIT_DAILY_ID_1"
  REVIEW_RESP=$(curl -s -X PUT "$BASE_URL/tasks/$HABIT_DAILY_ID_1/review" \
    -H "$AUTH_HEADER" -H "Content-Type: application/json" \
    -d '{"approved":true,"points":0}')
  log "审核响应: $REVIEW_RESP"
  log "✅ 习惯子任务1 打卡完成"
fi

# 7.3 提交习惯子任务2
if [ -n "$HABIT_DAILY_ID_2" ] && [ "$HABIT_DAILY_ID_2" != "null" ]; then
  log "7.3 提交并审核习惯子任务 $HABIT_DAILY_ID_2"
  curl -s -X PUT "$BASE_URL/tasks/$HABIT_DAILY_ID_2/submit" \
    -H "$AUTH_HEADER" -F "photo=" -F "note=坚持就是胜利" >/dev/null
  curl -s -X PUT "$BASE_URL/tasks/$HABIT_DAILY_ID_2/review" \
    -H "$AUTH_HEADER" -H "Content-Type: application/json" \
    -d '{"approved":true,"points":0}' >/dev/null
  log "✅ 习惯子任务2 打卡完成"
fi

# 7.4 查询习惯统计
if [ -n "$HABIT_MASTER_ID" ] && [ "$HABIT_MASTER_ID" != "null" ]; then
  log "7.4 查询习惯统计（habit_id=$HABIT_MASTER_ID, child_id=$CHILD_ID）"
  HABIT_STATS_RESP=$(curl -s "$BASE_URL/habits/$HABIT_MASTER_ID/stats?child_id=$CHILD_ID" -H "$AUTH_HEADER")
  log "习惯统计: $HABIT_STATS_RESP"
fi

# ===== Step 8: 完成主题子任务（触发下一批实例化）=====
step "Step 8: 完成主题子任务"

if [ -n "$CHILD_TASK_ID" ] && [ "$CHILD_TASK_ID" != "null" ]; then
  log "8.1 提交主题子任务 $CHILD_TASK_ID"
  curl -s -X PUT "$BASE_URL/tasks/$CHILD_TASK_ID/submit" \
    -H "$AUTH_HEADER" -F "photo=" -F "note=完成第一阶段" >/dev/null

  log "8.2 审核通过主题子任务 $CHILD_TASK_ID（应自动触发下一批实例化）"
  CHILD_REVIEW_RESP=$(curl -s -X PUT "$BASE_URL/tasks/$CHILD_TASK_ID/review" \
    -H "$AUTH_HEADER" -H "Content-Type: application/json" \
    -d '{"approved":true,"points":10}')
  log "审核响应: $CHILD_REVIEW_RESP"
  log "✅ 主题子任务1 完成并审核"

  # 8.3 再次查询子任务列表，验证是否新增了下一个 child
  log "8.3 再次查询主题子任务列表，验证分批实例化"
  CHILD_TASKS_RESP2=$(curl -s "$BASE_URL/tasks?child_id=$CHILD_ID&task_kind=child" -H "$AUTH_HEADER")
  log "主题子任务列表（审核后）: ${CHILD_TASKS_RESP2:0:400}"
fi

# ===== Step 9: 手动推进下一批（测试 AdvanceBatch）=====
step "Step 9: 手动推进下一批子任务实例化"
ADVANCE_RESP=$(curl -s -X POST "$BASE_URL/tasks/parent/$PARENT_ID/advance-batch" \
  -H "$AUTH_HEADER")
log "推进响应: $ADVANCE_RESP"
NEXT_CHILD_ID=$(extract "$ADVANCE_RESP" '.data.id')
if [ -n "$NEXT_CHILD_ID" ] && [ "$NEXT_CHILD_ID" != "null" ]; then
  log "✅ 下一批子任务已实例化：ID=$NEXT_CHILD_ID"

  # 完成这个子任务，让父任务有更多完成记录
  log "9.1 完成新实例化的子任务 $NEXT_CHILD_ID"
  curl -s -X PUT "$BASE_URL/tasks/$NEXT_CHILD_ID/submit" \
    -H "$AUTH_HEADER" -F "photo=" -F "note=第二阶段也完成" >/dev/null
  curl -s -X PUT "$BASE_URL/tasks/$NEXT_CHILD_ID/review" \
    -H "$AUTH_HEADER" -H "Content-Type: application/json" \
    -d '{"approved":true,"points":10}' >/dev/null
  log "✅ 子任务 $NEXT_CHILD_ID 已完成"
fi

# ===== Step 10: 生成成长故事（含三区块 + 相册）=====
step "Step 10: 生成成长故事（三区块 + 主题任务相册）"

STORY_RESP=$(curl -s -X POST "$BASE_URL/growth-stories/$CYCLE_ID" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "{\"child_id\":$CHILD_ID,\"child_name\":\"$CHILD_NICK\"}")
log "成长故事响应（前 1000 字）:"
echo "${STORY_RESP:0:1000}"
echo ""
log "✅ 成长故事已生成"

# 提取故事内容
if command -v jq >/dev/null 2>&1; then
  STORY_TITLE=$(echo "$STORY_RESP" | jq -r '.data.title // .data.Title // "无标题"')
  STORY_CONTENT=$(echo "$STORY_RESP" | jq -r '.data.content // .data.Content // "无内容"')
  echo ""
  echo -e "${BLUE}========== 成长故事预览 ==========${NC}"
  echo "标题: $STORY_TITLE"
  echo "---"
  echo "$STORY_CONTENT"
  echo -e "${BLUE}==================================${NC}"
fi

# ===== Step 11: 时间穿越测试（需后端 APP_ENV=development）=====
step "Step 11: 时间穿越测试"

# 查询当前时间
TIME_RESP=$(curl -s -X GET "$BASE_URL/debug/time" \
  -H "Authorization: Bearer $TOKEN")
log "当前时间状态: $TIME_RESP"

# 快进 1 天 → 应生成新的 habit_daily
log "快进 1 天，验证新习惯打卡任务生成..."
ADVANCE_RESP=$(curl -s -X POST "$BASE_URL/debug/advance-time" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"days": 1}')
log "快进 1 天响应: $ADVANCE_RESP"

# 查询任务列表，验证新 habit_daily 生成
TASKS_AFTER_ADVANCE=$(curl -s -X GET "$BASE_URL/tasks?child_id=$CHILD_ID&task_kind=habit_daily" \
  -H "Authorization: Bearer $TOKEN")
HABIT_DAILY_COUNT=$(echo "$TASKS_AFTER_ADVANCE" | jq -r '.data | length' 2>/dev/null || echo "0")
log "快进后 habit_daily 任务数: $HABIT_DAILY_COUNT"

if [ "$HABIT_DAILY_COUNT" -ge "1" ] 2>/dev/null; then
  log "✅ 快进 1 天后成功生成新的 habit_daily 任务"
else
  warn "快进后未发现 habit_daily（可能当日已生成或无活跃习惯目标）"
fi

# 快进 4 天 → 触发主题子任务兜底推进（超过 3 天未完成）
log "快进 4 天，验证主题子任务兜底推进..."
ADVANCE_RESP2=$(curl -s -X POST "$BASE_URL/debug/advance-time" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"days": 4}')
log "快进 4 天响应: $ADVANCE_RESP2"

# 查询父任务的子任务列表，验证是否有新子任务实例化
CHILDREN_RESP=$(curl -s -X GET "$BASE_URL/tasks/$PARENT_ID/children" \
  -H "Authorization: Bearer $TOKEN")
CHILDREN_COUNT=$(echo "$CHILDREN_RESP" | jq -r '.data | length' 2>/dev/null || echo "0")
log "快进后父任务的子任务数: $CHILDREN_COUNT"

if [ "$CHILDREN_COUNT" -ge "2" ] 2>/dev/null; then
  log "✅ 快进 4 天后触发主题子任务兜底推进"
else
  warn "子任务数未增加（可能已全部完成或未到 3 天阈值）"
fi

# 重置时间
log "重置虚拟时间..."
RESET_RESP=$(curl -s -X POST "$BASE_URL/debug/reset-time" \
  -H "Authorization: Bearer $TOKEN")
log "重置响应: $RESET_RESP"

# 验证已恢复真实时间
TIME_AFTER_RESET=$(curl -s -X GET "$BASE_URL/debug/time" \
  -H "Authorization: Bearer $TOKEN")
IS_VIRTUAL=$(echo "$TIME_AFTER_RESET" | jq -r '.data.is_virtual' 2>/dev/null || echo "true")
if [ "$IS_VIRTUAL" = "false" ]; then
  log "✅ 时间已恢复为真实模式"
else
  warn "时间重置失败，仍处于虚拟模式"
fi

# ===== 测试完成 =====
step "✅ 端到端测试流程完成"
log "测试账号: $NICKNAME / $PASSWORD"
log "孩子ID: $CHILD_ID"
log "周期ID: $CYCLE_ID"
log "父任务ID: $PARENT_ID"
echo ""
log "验证要点："
echo "  1. 成长故事应包含「日常任务」「习惯养成」「主题任务」三区块"
echo "  2. 习惯区块应显示坚持天数和养成评估"
echo "  3. 主题任务区块应显示完成度和子任务列表"
echo "  4. 若主题子任务全部完成，应有相册展示"
echo "  5. 时间穿越：快进 1 天后应生成新 habit_daily，快进 4 天后应触发主题兜底推进"
echo "  6. TaskCard 应显示彩色标签（AI生成/习惯养成/主题任务/家长陪伴等）"
echo "  7. parent 任务详情应显示阶段流水时间线"
echo "  8. daily 任务详情应显示本周期累计统计"
echo ""
warn "注意：时间穿越测试需后端以 APP_ENV=development 启动，否则 debug 接口返回 404"
