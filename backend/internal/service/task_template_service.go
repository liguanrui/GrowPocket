package service

import (
	"errors"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"log"
	"time"
)

type TaskTemplateService struct{}

func NewTaskTemplateService() *TaskTemplateService {
	return &TaskTemplateService{}
}

func (s *TaskTemplateService) CreateTemplate(familyID uint, createdBy uint, title, description, icon, category string, points, sortOrder int, minAge, maxAge, estimatedTime int, difficulty, frequency, tags string, abilityDimensionID uint, templateType string, estimatedDays int, keyMilestones string) (*model.TaskTemplate, error) {
	if title == "" {
		return nil, errors.New("任务模板标题不能为空")
	}
	if points < 0 {
		return nil, errors.New("积分值不能小于 0")
	}

	if category == "" {
		category = "学习"
	}
	if icon == "" {
		icon = "⭐"
	}
	if difficulty == "" {
		difficulty = "medium"
	}
	if frequency == "" {
		frequency = "once"
	}
	if minAge == 0 {
		minAge = 3
	}
	if maxAge == 0 {
		maxAge = 12
	}
	if templateType == "" {
		templateType = "daily"
	}

	template := &model.TaskTemplate{
		FamilyID:           familyID,
		CreatedBy:          createdBy,
		Title:              title,
		Description:        description,
		Icon:               icon,
		Category:           category,
		Points:             points,
		SortOrder:          sortOrder,
		IsActive:           true,
		MinAge:             minAge,
		MaxAge:             maxAge,
		Difficulty:         difficulty,
		Frequency:          frequency,
		EstimatedTime:      estimatedTime,
		Tags:               tags,
		AbilityDimensionID: abilityDimensionID,
		IsSystem:           false, // 家庭自建一律 false
		TemplateType:       templateType,
		EstimatedDays:      estimatedDays,
		KeyMilestones:      keyMilestones,
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}

	if err := database.DB.Create(template).Error; err != nil {
		return nil, errors.New("创建任务模板失败")
	}
	return template, nil
}

func (s *TaskTemplateService) UpdateTemplate(id uint, familyID uint, title, description, icon, category, difficulty, frequency, tags *string, points, sortOrder, minAge, maxAge, estimatedTime *int, isActive *bool, abilityDimensionID *uint, templateType *string, estimatedDays *int, keyMilestones *string) (*model.TaskTemplate, error) {
	template, err := s.GetTemplate(id, familyID)
	if err != nil {
		return nil, err
	}

	if title != nil {
		if *title == "" {
			return nil, errors.New("任务模板标题不能为空")
		}
		template.Title = *title
	}
	if description != nil {
		template.Description = *description
	}
	if icon != nil {
		template.Icon = *icon
	}
	if category != nil {
		template.Category = *category
	}
	if points != nil {
		if *points < 0 {
			return nil, errors.New("积分值不能小于 0")
		}
		template.Points = *points
	}
	if sortOrder != nil {
		template.SortOrder = *sortOrder
	}
	if isActive != nil {
		template.IsActive = *isActive
	}
	if minAge != nil {
		template.MinAge = *minAge
	}
	if maxAge != nil {
		template.MaxAge = *maxAge
	}
	if difficulty != nil {
		template.Difficulty = *difficulty
	}
	if frequency != nil {
		template.Frequency = *frequency
	}
	if estimatedTime != nil {
		template.EstimatedTime = *estimatedTime
	}
	if tags != nil {
		template.Tags = *tags
	}
	if abilityDimensionID != nil {
		template.AbilityDimensionID = *abilityDimensionID
	}
	if templateType != nil && *templateType != "" {
		template.TemplateType = *templateType
	}
	if estimatedDays != nil {
		template.EstimatedDays = *estimatedDays
	}
	if keyMilestones != nil {
		template.KeyMilestones = *keyMilestones
	}
	// E 同步：系统模板被修改后标记为已自定义，后续 SyncSystemTemplates 跳过
	if template.IsSystem {
		template.IsCustomized = true
	}

	template.UpdatedAt = time.Now()
	if err := database.DB.Save(template).Error; err != nil {
		return nil, errors.New("更新任务模板失败")
	}
	return template, nil
}

func (s *TaskTemplateService) DeleteTemplate(id uint, familyID uint) error {
	template, err := s.GetTemplate(id, familyID)
	if err != nil {
		return err
	}
	if err := database.DB.Delete(template).Error; err != nil {
		return errors.New("删除任务模板失败")
	}
	return nil
}

// TemplateFilter 模板列表筛选条件（所有字段可选，nil 表示不过滤）
type TemplateFilter struct {
	DimensionID  *uint
	IsSystem     *bool
	AgeMin       *int // 模板 MaxAge >= AgeMin（孩子年龄下限）
	AgeMax       *int // 模板 MinAge <= AgeMax（孩子年龄上限）
	Category     *string
	TemplateType *string // daily/habit/parent
}

func (s *TaskTemplateService) ListTemplates(familyID uint, filter *TemplateFilter) ([]model.TaskTemplate, error) {
	var templates []model.TaskTemplate
	q := database.DB.Where("family_id = ?", familyID)
	if filter != nil {
		if filter.DimensionID != nil {
			q = q.Where("ability_dimension_id = ?", *filter.DimensionID)
		}
		if filter.IsSystem != nil {
			q = q.Where("is_system = ?", *filter.IsSystem)
		}
		if filter.AgeMin != nil {
			q = q.Where("max_age >= ?", *filter.AgeMin)
		}
		if filter.AgeMax != nil {
			q = q.Where("min_age <= ?", *filter.AgeMax)
		}
		if filter.Category != nil && *filter.Category != "" {
			q = q.Where("category = ?", *filter.Category)
		}
		if filter.TemplateType != nil && *filter.TemplateType != "" {
			q = q.Where("template_type = ?", *filter.TemplateType)
		}
	}
	err := q.Order("is_system DESC, sort_order ASC, created_at ASC").
		Find(&templates).Error
	if err != nil {
		return nil, errors.New("查询任务模板列表失败")
	}
	return templates, nil
}

func (s *TaskTemplateService) GetTemplate(id uint, familyID uint) (*model.TaskTemplate, error) {
	var template model.TaskTemplate
	err := database.DB.Where("id = ? AND family_id = ?", id, familyID).First(&template).Error
	if err != nil {
		return nil, errors.New("任务模板不存在")
	}
	return &template, nil
}

func (s *TaskTemplateService) CreateTaskFromTemplate(templateID uint, familyID uint, childID uint, childName string, createdBy uint) (*model.Task, error) {
	template, err := s.GetTemplate(templateID, familyID)
	if err != nil {
		return nil, err
	}

	task := &model.Task{
		FamilyID:    familyID,
		Title:       template.Title,
		Description: template.Description,
		Points:      template.Points,
		Status:      model.TaskStatusInProgress,
		ChildID:     childID,
		ChildName:   childName,
		CreatedBy:   createdBy,
		TemplateID:  templateID,
		Category:    template.Category,
		Difficulty:  template.Difficulty,
		Frequency:   template.Frequency,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := database.DB.Create(task).Error; err != nil {
		return nil, errors.New("从模板创建任务失败")
	}
	return task, nil
}

// buildDefaultTemplates 构造完整默认模板库（215条），按年龄优先分段组织：
// - daily 154条 | habit 25条 | parent 36条
// - 3-5岁 学前启蒙 | 6-8岁 低年级 | 8-10岁 中年级 | 10-12岁 高年级 | 13+岁 青少年
// - habit 聚焦21天可养成的重复性好习惯（非技能/非安全常识），与 daily 严格去重
// - 参考：小学生1-6年级好习惯一览表（学习/生活/健康/行为/交友五大类）
func buildDefaultTemplates(familyID, createdBy uint) []model.TaskTemplate {
	now := time.Now()
	DIM := struct{ Self, Ind, Hands, Learn, Soc, Hlth uint }{1, 2, 3, 4, 5, 6}

	// tpl 创建 daily 类型模板（日常任务，AI 召回池）
	tpl := func(
		title, desc, icon, category, difficulty, frequency, tags string,
		points, estimatedTime, minAge, maxAge, sortOrder int,
		dimID uint,
	) model.TaskTemplate {
		return model.TaskTemplate{
			FamilyID:           familyID,
			CreatedBy:          createdBy,
			Title:              title,
			Description:        desc,
			Icon:               icon,
			Category:           category,
			Points:             points,
			SortOrder:          sortOrder,
			IsActive:           true,
			MinAge:             minAge,
			MaxAge:             maxAge,
			Difficulty:         difficulty,
			Frequency:          frequency,
			EstimatedTime:      estimatedTime,
			Tags:               tags,
			IsSystem:           true,
			AbilityDimensionID: dimID,
			MasterTitle:        title,
			IsCustomized:       false,
			ShareStatus:        "private",
			TemplateType:       "daily",
			CreatedAt:          now,
			UpdatedAt:          now,
		}
	}

	// tplHabit 创建 habit 类型模板（习惯养成，长期打卡）
	tplHabit := func(title, desc, icon, category, tags string, points, minAge, maxAge, sortOrder int, dimID uint) model.TaskTemplate {
		return model.TaskTemplate{
			FamilyID:           familyID,
			CreatedBy:          createdBy,
			Title:              title,
			Description:        desc,
			Icon:               icon,
			Category:           category,
			Points:             points,
			SortOrder:          sortOrder,
			IsActive:           true,
			MinAge:             minAge,
			MaxAge:             maxAge,
			Difficulty:         "easy",
			Frequency:          "daily",
			EstimatedTime:      10,
			Tags:               tags,
			IsSystem:           true,
			AbilityDimensionID: dimID,
			MasterTitle:        title,
			IsCustomized:       false,
			ShareStatus:        "private",
			TemplateType:       "habit",
			CreatedAt:          now,
			UpdatedAt:          now,
		}
	}

	// tplParent 创建 parent 类型模板（主题任务，含里程碑）
	tplParent := func(title, desc, icon, category string, minAge, maxAge, estimatedDays, points, sortOrder int, keyMilestones string, dimID uint) model.TaskTemplate {
		return model.TaskTemplate{
			FamilyID:           familyID,
			CreatedBy:          createdBy,
			Title:              title,
			Description:        desc,
			Icon:               icon,
			Category:           category,
			Points:             points,
			SortOrder:          sortOrder,
			IsActive:           true,
			MinAge:             minAge,
			MaxAge:             maxAge,
			Difficulty:         "medium",
			Frequency:          "once",
			EstimatedTime:      0,
			Tags:               "主题任务",
			IsSystem:           true,
			AbilityDimensionID: dimID,
			MasterTitle:        title,
			IsCustomized:       false,
			ShareStatus:        "private",
			TemplateType:       "parent",
			EstimatedDays:      estimatedDays,
			KeyMilestones:      keyMilestones,
			CreatedAt:          now,
			UpdatedAt:          now,
		}
	}

	var t []model.TaskTemplate
	so := 0

	// ===== 3-5岁 学前启蒙 =====
	// --- 生活自理 ---
	t = append(t, tpl("自己穿衣服", "独立完成穿衣、穿袜子和鞋子，起床后叠好被子", "👕", "行为习惯", "easy", "daily", "自理能力", 10, 5, 3, 5, so, DIM.Self)); so++
	t = append(t, tpl("自己刷牙", "独立刷牙2分钟，刷干净每一颗牙齿", "🦷", "行为习惯", "easy", "daily", "卫生习惯", 10, 3, 3, 6, so, DIM.Self)); so++
	t = append(t, tpl("收拾玩具", "玩完玩具后分类放回对应收纳箱", "🧸", "行为习惯", "easy", "daily", "整理", 15, 10, 3, 5, so, DIM.Self)); so++
	t = append(t, tpl("独立如厕", "自己上厕所并冲水", "🚽", "行为习惯", "easy", "daily", "自理能力", 10, 5, 3, 5, so, DIM.Self)); so++
	t = append(t, tpl("洗手", "饭前便后认真洗手", "🖐️", "行为习惯", "easy", "daily", "卫生习惯", 5, 2, 3, 5, so, DIM.Self)); so++
	// --- 独立自主 ---
	t = append(t, tpl("随手关门", "进门后随手把门关好", "🚪", "行为习惯", "easy", "daily", "好习惯", 5, 1, 3, 5, so, DIM.Ind)); so++
	// --- 动手实践 ---
	t = append(t, tpl("摆碗筷", "吃饭前帮忙摆放碗筷", "🍽️", "家务", "easy", "daily", "家务", 10, 3, 3, 5, so, DIM.Hands)); so++

	// ===== 6-8岁 低年级 (G1-G2) =====
	// --- 生活自理 ---
	t = append(t, tpl("洗脸并擦干台面水渍", "独立洗脸洗手，擦干洗手盆和地面水渍", "🚿", "行为习惯", "easy", "daily", "个人卫生", 10, 3, 6, 7, so, DIM.Self)); so++
	t = append(t, tpl("学习扫地+垃圾分类", "用扫把扫地，尝试识别可回收/厨余/其他垃圾", "🧹", "家务", "easy", "daily", "劳动技能", 20, 10, 6, 7, so, DIM.Self)); so++
	t = append(t, tpl("削铅笔+包书皮", "用卷笔刀削铅笔，给新课本包书皮并写姓名", "📚", "学习", "easy", "daily", "学习用品管理", 20, 10, 6, 7, so, DIM.Self)); so++
	t = append(t, tpl("整理书包", "自己整理书包，课本/文具/作业分层摆放", "🎒", "学习", "easy", "daily", "学习习惯", 20, 10, 6, 8, so, DIM.Self)); so++
	t = append(t, tpl("学洗自己的袜子", "用肥皂搓洗袜子，冲干净并晾晒", "🧦", "家务", "easy", "daily", "衣物洗涤", 15, 8, 6, 8, so, DIM.Self)); so++
	t = append(t, tpl("整理房间", "整理床铺、叠好衣物、收拾书桌", "🏠", "家务", "medium", "daily", "整理", 50, 20, 6, 8, so, DIM.Self)); so++
	t = append(t, tpl("系鞋带+打绳结", "学会蝴蝶结/十字结系鞋带", "👟", "行为习惯", "easy", "daily", "精细动作", 15, 5, 7, 8, so, DIM.Self)); so++
	t = append(t, tpl("独立洗头洗澡", "独立完成洗头洗澡并清理浴室头发", "🛁", "行为习惯", "easy", "daily", "独立自理", 25, 15, 7, 8, so, DIM.Self)); so++
	t = append(t, tpl("修剪指甲+保持手部清洁", "独立修剪手指甲、脚趾甲", "💅", "行为习惯", "easy", "weekly", "个人卫生", 15, 5, 7, 8, so, DIM.Self)); so++
	// --- 独立自主 ---
	t = append(t, tpl("计划第二天穿搭", "睡前根据天气预报选好明天要穿的衣服", "👔", "行为习惯", "easy", "daily", "前瞻规划", 15, 3, 6, 8, so, DIM.Ind)); so++
	t = append(t, tpl("自己定闹钟起床", "设定闹钟，响铃后自己起床不赖床", "⏰", "行为习惯", "easy", "daily", "时间观念", 20, 0, 6, 8, so, DIM.Ind)); so++
	t = append(t, tpl("制定每日必做清单", "早上列出 3 件今天必做的事并打勾", "📋", "行为习惯", "easy", "daily", "执行能力", 20, 3, 7, 8, so, DIM.Ind)); so++
	t = append(t, tpl("保管自己的重要物品", "管理钥匙、公交卡、学生证不丢失", "🔑", "行为习惯", "easy", "daily", "责任感", 25, 2, 7, 8, so, DIM.Ind)); so++
	t = append(t, tpl("番茄钟专注训练", "使用 25 分钟番茄钟+5分钟休息完成作业", "🍅", "学习", "easy", "daily", "专注能力", 30, 30, 7, 12, so, DIM.Ind)); so++
	// --- 动手实践 ---
	t = append(t, tpl("倒垃圾", "把家里的垃圾倒到楼下垃圾桶", "🗑️", "家务", "easy", "daily", "家务", 15, 5, 6, 8, so, DIM.Hands)); so++
	t = append(t, tpl("擦桌子", "用餐后把桌子擦干净", "🧹", "家务", "easy", "daily", "家务", 15, 5, 6, 8, so, DIM.Hands)); so++
	t = append(t, tpl("洗碗", "饭后把碗筷洗干净并放好", "🍽️", "家务", "medium", "daily", "家务", 30, 15, 6, 8, so, DIM.Hands)); so++
	t = append(t, tpl("浇花", "给家里的植物浇水、换水、观察生长", "🌱", "家务", "easy", "daily", "家务", 20, 5, 6, 8, so, DIM.Hands)); so++
	t = append(t, tpl("手工：折纸作品", "折出千纸鹤/纸飞机/钢琴等并展示", "📄", "其他", "easy", "weekly", "精细动作", 20, 15, 6, 8, so, DIM.Hands)); so++
	t = append(t, tpl("手工：DIY 感恩贺卡", "给家人/老师手工做贺卡", "💌", "其他", "easy", "monthly", "感恩+创意", 25, 25, 6, 8, so, DIM.Hands)); so++
	t = append(t, tpl("科学小实验：火山爆发", "用小苏打+白醋+食用色素模拟火山", "🌋", "其他", "easy", "once", "科学实验", 30, 20, 7, 10, so, DIM.Hands)); so++
	t = append(t, tpl("科学小实验：彩虹雨", "用剃须泡+食用色素在水中做彩虹雨", "🌈", "其他", "easy", "once", "密度原理", 30, 15, 7, 10, so, DIM.Hands)); so++
	t = append(t, tpl("科学小实验：鸡蛋浮起来", "用盐水密度让鸡蛋漂浮并写观察记录", "🥚", "其他", "easy", "once", "浮力原理", 30, 20, 7, 11, so, DIM.Hands)); so++
	t = append(t, tpl("科学实验：种豆芽观察", "每天记录绿豆发芽长度，连续记录 7 天", "🌱", "学习", "medium", "weekly", "观察+记录", 40, 10, 7, 11, so, DIM.Hands)); so++
	// --- 学习认知 ---
	t = append(t, tpl("独立完成作业", "独立完成当天的作业，不拖延", "✏️", "学习", "medium", "daily", "学习", 50, 30, 6, 12, so, DIM.Learn)); so++
	t = append(t, tpl("作业规划清单", "放学回家后先列作业清单，按优先级排序，做好作业规划", "📝", "学习", "easy", "daily", "作业规划/检查清单", 25, 5, 6, 12, so, DIM.Learn)); so++
	t = append(t, tpl("检查清单自查", "做完作业后按检查清单逐项检查是否漏题、是否验算", "✅", "学习", "easy", "daily", "检查清单", 25, 5, 6, 12, so, DIM.Learn)); so++
	t = append(t, tpl("错题本整理", "把当天错题抄录进错题本，标注错误原因，养成错题订正习惯", "📔", "学习", "medium", "daily", "错题本/错题订正", 40, 15, 7, 12, so, DIM.Learn)); so++
	t = append(t, tpl("20 分钟晨读打卡", "早晨大声朗读课文/英语 20 分钟", "🌅", "学习", "easy", "daily", "语感培养", 25, 20, 6, 12, so, DIM.Learn)); so++
	t = append(t, tpl("学习桌 5 秒整理法", "学习结束后 5 秒内桌面恢复整洁", "🧹", "行为习惯", "easy", "daily", "学习环境", 15, 0, 6, 12, so, DIM.Learn)); so++
	t = append(t, tpl("阅读15分钟", "每天坚持阅读15分钟", "📚", "学习", "easy", "daily", "阅读", 20, 15, 5, 8, so, DIM.Learn)); so++
	t = append(t, tpl("英语单词卡片法", "用卡片法记 10 个新单词（正面英文反面中文）", "🃏", "学习", "easy", "daily", "记忆方法", 25, 15, 7, 12, so, DIM.Learn)); so++
	t = append(t, tpl("预习新课 3 步法", "读教材→标疑点→做课后 3 道题", "📖", "学习", "easy", "daily", "预习方法", 30, 15, 7, 12, so, DIM.Learn)); so++
	t = append(t, tpl("复习功课", "复习当天学过的内容", "📝", "学习", "medium", "daily", "学习", 30, 15, 7, 12, so, DIM.Learn)); so++
	t = append(t, tpl("费曼讲题：给家长讲题", "用自己的话把今天学的数学题讲给家长听", "👨‍🏫", "学习", "medium", "daily", "输出驱动", 40, 15, 7, 12, so, DIM.Learn)); so++
	t = append(t, tpl("考试技巧：读题两遍法", "考试/作业时读题两遍再动笔", "🔍", "学习", "easy", "daily", "审题习惯", 20, 3, 7, 12, so, DIM.Learn)); so++
	t = append(t, tpl("查字典/查资料练习", "遇到生字独立用部首查字法查字典", "📖", "学习", "easy", "weekly", "学习工具", 20, 10, 7, 8, so, DIM.Learn)); so++
	t = append(t, tpl("背古诗：画面联想法", "给古诗配一幅画帮助记忆", "🎨", "学习", "easy", "weekly", "多感官记忆", 25, 15, 6, 12, so, DIM.Learn)); so++
	t = append(t, tpl("阅读输出：3 句话复述", "读完故事后用 3 句话复述开头/中间/结尾", "💬", "学习", "easy", "weekly", "理解+表达", 20, 10, 6, 8, so, DIM.Learn)); so++
	t = append(t, tpl("背诵课文分段法", "把长文分成 3 段逐段背，最后连起来", "🧠", "学习", "medium", "weekly", "拆分策略", 40, 30, 7, 12, so, DIM.Learn)); so++
	// --- 社交情感 ---
	t = append(t, tpl("情绪识别贴标签", "当生气/难过时，说出我现在是___情绪", "🎭", "行为习惯", "easy", "daily", "情绪觉察", 20, 2, 6, 8, so, DIM.Soc)); so++
	t = append(t, tpl("盒子呼吸法", "吸气4秒→憋4秒→呼4秒→憋4秒，循环3轮（心理韧性训练）", "🫁", "运动", "easy", "daily", "心理韧性/情绪调节", 15, 2, 6, 12, so, DIM.Soc)); so++
	t = append(t, tpl("5-4-3-2-1 感官安抚", "焦虑时说出看到的5件/摸到的4件/听到3件/闻到2件/尝到1件，用于情绪调节", "👁️", "行为习惯", "easy", "daily", "情绪调节", 25, 3, 7, 12, so, DIM.Soc)); so++
	t = append(t, tpl("设置冷静角+使用方法", "生气时主动到冷静角待 2 分钟再沟通", "🛋️", "行为习惯", "easy", "daily", "情绪管理", 25, 2, 6, 8, so, DIM.Soc)); so++
	t = append(t, tpl("情绪日记：画表情+写原因", "睡前画今天的情绪脸谱+1句话原因", "😀", "学习", "easy", "daily", "自我觉察", 25, 5, 7, 8, so, DIM.Soc)); so++
	t = append(t, tpl("正念 1 分钟静坐", "闭眼静坐 1 分钟，只把注意力放在呼吸上（静心训练）", "🧘", "运动", "easy", "daily", "静心训练", 20, 1, 7, 12, so, DIM.Soc)); so++
	t = append(t, tpl("向家人真诚说谢谢", "具体地感谢某人做了某件事（不是泛泛的）", "🙏", "行为习惯", "easy", "daily", "感恩表达", 20, 1, 6, 12, so, DIM.Soc)); so++
	t = append(t, tpl("同理心：猜猜他的感受", "看故事图片时说出你觉得他现在是什么心情？为什么？", "💭", "学习", "easy", "weekly", "换位思考", 25, 5, 6, 8, so, DIM.Soc)); so++
	t = append(t, tpl("主动帮助家人一件事", "观察家人需要什么，主动提供帮助", "🤝", "行为习惯", "easy", "daily", "关怀行动", 20, 10, 6, 12, so, DIM.Soc)); so++
	t = append(t, tpl("倾听练习：不打断别人", "和家人对话时做到不插话、听完再说", "👂", "行为习惯", "easy", "weekly", "倾听能力", 25, 10, 7, 8, so, DIM.Soc)); so++
	t = append(t, tpl("分享自己最喜欢的东西", "在亲友面前分享自己最爱的玩具/书（2分钟）", "🎁", "其他", "easy", "weekly", "表达+分享", 25, 2, 6, 8, so, DIM.Soc)); so++
	t = append(t, tpl("自我介绍练习（30秒版）", "准备一段 30 秒~2 分钟自我介绍并演练", "🙋", "学习", "easy", "weekly", "表达自信", 25, 2, 6, 12, so, DIM.Soc)); so++
	t = append(t, tpl("求助练习：正确问问题", "模拟向老师/同学问问题（具体说清卡在哪）", "❓", "学习", "easy", "weekly", "求助技能", 25, 5, 7, 8, so, DIM.Soc)); so++
	t = append(t, tpl("赞美同学 3 条优点", "当面说出同学的 3 个具体优点", "🌟", "行为习惯", "medium", "weekly", "肯定他人", 35, 5, 7, 12, so, DIM.Soc)); so++
	t = append(t, tpl("角色扮演：被拒绝怎么办", "和家长模拟邀请同学玩被拒绝的场景", "🎭", "其他", "medium", "monthly", "挫折应对", 40, 15, 7, 11, so, DIM.Soc)); so++
	t = append(t, tpl("角色扮演：和朋友吵架后和好", "模拟道歉、原谅、和好的对话", "🤗", "其他", "medium", "monthly", "冲突修复", 40, 15, 7, 11, so, DIM.Soc)); so++
	t = append(t, tpl("写一封感谢信", "给帮助过自己的人手写/画一封感谢信", "✉️", "学习", "medium", "monthly", "感恩+书写", 40, 30, 7, 12, so, DIM.Soc)); so++
	t = append(t, tpl("勇敢说出来：倾诉练习", "遇到不开心找家长/朋友说出来，不憋在心里", "💬", "行为习惯", "medium", "weekly", "求助意识", 35, 5, 7, 12, so, DIM.Soc)); so++
	t = append(t, tpl("主动问候长辈", "见到长辈主动打招呼", "👋", "行为习惯", "easy", "daily", "礼貌", 10, 1, 6, 12, so, DIM.Soc)); so++
	// --- 身心健康 ---
	t = append(t, tpl("户外运动", "每天户外活动至少1小时", "⚽", "运动", "medium", "daily", "运动", 40, 60, 6, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("跳绳100个", "连续跳绳100个", "🪢", "运动", "medium", "daily", "运动", 25, 10, 6, 8, so, DIM.Hlth)); so++
	t = append(t, tpl("眼保健操认真做", "每天 2 次眼保健操，动作标准到位", "👀", "运动", "easy", "daily", "视力保护", 15, 5, 6, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("视力远眺休息", "每用眼 30 分钟，远眺窗外 6 米以上 20 秒", "🏞️", "行为习惯", "easy", "daily", "近视防控", 10, 1, 6, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("开合跳 × 50 个", "标准开合跳 50 个，中间可休息 1 次", "🤸", "运动", "easy", "daily", "心肺", 20, 5, 6, 8, so, DIM.Hlth)); so++
	t = append(t, tpl("坐位体前屈拉伸", "做坐位体前屈，保持 10 秒 × 3 组", "🧘", "运动", "easy", "daily", "柔韧", 20, 3, 6, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("平衡练习：单脚站立 30 秒", "左右脚各闭眼单脚站立 30 秒", "🦩", "运动", "easy", "daily", "平衡能力", 20, 1, 6, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("每天喝水 8 杯打卡", "用打卡表记录今天喝了多少水", "💧", "行为习惯", "easy", "daily", "健康习惯", 10, 1, 6, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("多吃蔬菜挑战", "今天每餐主动吃蔬菜，不挑食", "🥦", "行为习惯", "easy", "daily", "均衡营养", 20, 0, 6, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("早睡打卡（不看屏幕）", "按约定时间上床，睡前 30 分钟不看电子产品", "🌙", "行为习惯", "easy", "daily", "睡眠质量", 25, 0, 3, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("站姿/坐姿端正训练", "每天刻意保持挺胸收腹 5 次，每次 5 分钟", "🧍", "行为习惯", "easy", "daily", "脊柱健康", 20, 5, 6, 8, so, DIM.Hlth)); so++
	t = append(t, tpl("仰卧起坐计时 1 分钟", "1 分钟内做尽量多仰卧起坐，打卡记录", "💪", "运动", "medium", "daily", "核心力量", 30, 3, 7, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("高抬腿 × 30 个 × 3 组", "高抬腿跑 30 个/组，共 3 组", "🏃", "运动", "medium", "daily", "爆发力", 35, 5, 7, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("深蹲 × 20 个 × 2 组", "标准深蹲，膝盖不过脚尖", "🦵", "运动", "medium", "daily", "下肢力量", 30, 5, 7, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("5 分钟放松拉伸", "运动后跟随视频做 5 分钟拉伸放松", "🤸‍♀️", "运动", "easy", "daily", "恢复防伤", 20, 5, 7, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("学习一套健身操/舞蹈", "跟视频学一套 2 分钟操并录制", "💃", "运动", "medium", "weekly", "协调+节奏感", 45, 20, 7, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("周末家庭徒步/爬山", "全家一起徒步 1 小时以上", "⛰️", "运动", "medium", "weekly", "自然+家庭", 50, 60, 6, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("成长记录：这周我进步了", "写下/画出本周自己相比之前的 1 个小进步（自我效能感）", "🚀", "学习", "easy", "weekly", "自我效能感", 25, 10, 6, 12, so, DIM.Hlth)); so++

	// ===== 8-10岁 中年级 (G3-G4) =====
	// --- 生活自理 ---
	t = append(t, tpl("擦皮鞋/运动鞋", "给皮鞋擦鞋油，刷洗运动鞋鞋面", "👞", "家务", "medium", "weekly", "物品养护", 25, 15, 8, 9, so, DIM.Self)); so++
	t = append(t, tpl("缝纽扣", "穿针引线，钉牢一颗衬衫纽扣", "🧵", "动手实践", "medium", "weekly", "精细动作", 40, 20, 8, 10, so, DIM.Self)); so++
	t = append(t, tpl("清洗书包", "用刷子清洗书包内外并晾晒", "🎒", "家务", "medium", "monthly", "个人卫生", 30, 20, 9, 10, so, DIM.Self)); so++
	t = append(t, tpl("清洗马桶", "戴手套用马桶刷清洁马桶内外", "🚽", "家务", "medium", "weekly", "清洁技能", 40, 15, 9, 10, so, DIM.Self)); so++
	t = append(t, tpl("洗衣服", "自己洗小件衣物（袜子、内衣等）", "👕", "家务", "hard", "weekly", "家务", 50, 30, 8, 12, so, DIM.Self)); so++
	// --- 独立自主 ---
	t = append(t, tpl("照顾宠物", "给宠物喂食、换水、清理卫生", "🐶", "家务", "medium", "daily", "责任", 30, 15, 8, 12, so, DIM.Ind)); so++
	t = append(t, tpl("认识家里水电煤开关", "知道水阀、电闸、燃气总开关位置及用法", "🔌", "行为习惯", "easy", "weekly", "安全常识", 20, 5, 8, 10, so, DIM.Ind)); so++
	t = append(t, tpl("购买文具/郊游物品", "带清单在家长陪同下在超市独立选购", "🛍️", "行为习惯", "medium", "weekly", "规划执行", 30, 25, 8, 9, so, DIM.Ind)); so++
	t = append(t, tpl("选购+包装生日礼物", "挑选、包装同学或家人生日礼物", "🎁", "行为习惯", "medium", "monthly", "用心+预算意识", 40, 40, 8, 9, so, DIM.Ind)); so++
	t = append(t, tpl("银行开户/认识储蓄", "家长陪同下了解银行基本功能，开设儿童账户", "🏦", "学习", "easy", "once", "财商启蒙", 30, 60, 9, 10, so, DIM.Ind)); so++
	t = append(t, tpl("一周零花钱记账", "记录一周零花钱收支，分类汇总", "📒", "学习", "medium", "weekly", "财商/记账", 40, 15, 9, 10, so, DIM.Ind)); so++
	t = append(t, tpl("制定零花钱预算", "月初规划本月零花钱分配（储蓄/花费/捐赠）", "💰", "学习", "medium", "monthly", "财商/预算", 45, 20, 9, 11, so, DIM.Ind)); so++
	t = append(t, tpl("制定周学习计划", "用表格列出本周学习任务并分配到每天", "🗓️", "学习", "medium", "weekly", "时间管理", 45, 20, 9, 12, so, DIM.Ind)); so++
	// --- 动手实践 ---
	t = append(t, tpl("拖地", "用拖把把地面拖干净", "🧹", "家务", "medium", "weekly", "家务", 40, 20, 8, 12, so, DIM.Hands)); so++
	t = append(t, tpl("整理书架", "把书架上的书整理分类", "📚", "家务", "medium", "weekly", "整理", 30, 20, 8, 12, so, DIM.Hands)); so++
	t = append(t, tpl("做三明治", "用面包+火腿+生菜+酱料独立制作三明治", "🥪", "家务", "easy", "weekly", "烹饪入门", 30, 15, 8, 10, so, DIM.Hands)); so++
	t = append(t, tpl("用豆浆机做米糊/豆浆", "量取豆子，操作豆浆机，完成后清洗", "🥛", "家务", "medium", "weekly", "家电使用", 35, 20, 8, 9, so, DIM.Hands)); so++
	t = append(t, tpl("用微波炉加热自制菜肴", "安全用微波炉加热/做简单菜肴", "🍱", "家务", "easy", "weekly", "家电使用", 25, 10, 8, 10, so, DIM.Hands)); so++
	t = append(t, tpl("家务：缝沙包+内装豆子", "剪布+缝合+装豆类，制作传统沙包", "🪡", "动手实践", "medium", "once", "手工+怀旧", 45, 30, 8, 10, so, DIM.Hands)); so++
	t = append(t, tpl("组装乐高/家具小件", "独立看懂说明书，组装复杂模型", "🧩", "其他", "medium", "once", "空间理解", 40, 40, 8, 10, so, DIM.Hands)); so++
	t = append(t, tpl("手工：废物利用笔筒", "用旧塑料瓶/纸筒做创意笔筒", "🖊️", "其他", "medium", "once", "环保+创意", 35, 30, 8, 11, so, DIM.Hands)); so++
	t = append(t, tpl("蒸鸡蛋羹+煎荷包蛋", "掌握蒸和简单煎的烹饪方法", "🍳", "家务", "medium", "weekly", "烹饪", 45, 20, 9, 10, so, DIM.Hands)); so++
	t = append(t, tpl("做水果拼盘", "切水果摆成图案造型", "🍉", "家务", "medium", "weekly", "创意+刀工", 40, 20, 9, 10, so, DIM.Hands)); so++
	t = append(t, tpl("包水饺", "擀皮+包馅+捏合", "🥟", "家务", "medium", "weekly", "传统美食", 45, 40, 9, 10, so, DIM.Hands)); so++
	t = append(t, tpl("做蛋炒饭/炒面", "从准备食材到出锅独立完成", "🍚", "家务", "medium", "weekly", "烹饪基础", 50, 30, 9, 10, so, DIM.Hands)); so++
	t = append(t, tpl("种植和养护土培植物", "播种、浇水、施肥，观察生长日记", "🌱", "家务", "medium", "weekly", "生命科学", 40, 20, 9, 10, so, DIM.Hands)); so++
	t = append(t, tpl("科学小实验：自制净水器", "用砂石+活性炭+棉花做简易过滤", "🚰", "其他", "medium", "once", "环保科学", 50, 40, 9, 11, so, DIM.Hands)); so++
	t = append(t, tpl("手工：编织手绳/手链", "用编织绳做简单结手链", "📿", "其他", "medium", "once", "耐心+精细", 40, 40, 9, 12, so, DIM.Hands)); so++
	t = append(t, tpl("准备早餐", "自己准备简单的早餐", "🍳", "家务", "hard", "weekly", "自理能力", 60, 30, 9, 12, so, DIM.Hands)); so++
	// --- 学习认知 ---
	t = append(t, tpl("阅读30分钟", "阅读课外书籍30分钟", "📚", "学习", "medium", "daily", "阅读", 40, 30, 8, 12, so, DIM.Learn)); so++
	t = append(t, tpl("周错题复习循环", "每周日重新做一遍本周错题本的题目，做对的划掉", "🗓️", "学习", "medium", "weekly", "间隔重复", 50, 30, 7, 12, so, DIM.Learn)); so++
	t = append(t, tpl("阅读输出：写读书笔记", "读完一章后写 3 条收获 + 1 个疑问", "📓", "学习", "medium", "weekly", "深度阅读", 40, 20, 8, 12, so, DIM.Learn)); so++
	t = append(t, tpl("英语日记 3 句话", "每天用英语写 3 句话日记", "📔", "学习", "easy", "daily", "输出训练", 25, 10, 8, 12, so, DIM.Learn)); so++
	t = append(t, tpl("绘制课文思维导图", "用思维导图梳理今天语文课结构", "🗺️", "学习", "medium", "weekly", "结构化思维", 40, 25, 8, 12, so, DIM.Learn)); so++
	t = append(t, tpl("速读训练：计时 5 分钟", "5 分钟快速阅读，读后写 5 个关键词", "⚡", "学习", "medium", "weekly", "阅读速度", 35, 5, 8, 12, so, DIM.Learn)); so++
	t = append(t, tpl("写一篇周记", "记录本周最难忘的一件事（200字以上）", "🖊️", "学习", "medium", "weekly", "写作+反思", 45, 30, 8, 12, so, DIM.Learn)); so++
	t = append(t, tpl("单元复习：出题互考", "给家长出 5 道本单元重点题并批改", "📃", "学习", "medium", "weekly", "以考促学", 45, 30, 8, 12, so, DIM.Learn)); so++
	t = append(t, tpl("数学错题归因 3 类", "粗心/不会/步骤错，给错题打标签", "🏷️", "学习", "medium", "weekly", "元认知", 40, 15, 8, 12, so, DIM.Learn)); so++
	t = append(t, tpl("口头作文 1 分钟", "随机抽一个主题，连续说 1 分钟不中断", "🎙️", "学习", "medium", "weekly", "口头表达", 40, 5, 8, 12, so, DIM.Learn)); so++
	t = append(t, tpl("整理本周知识卡片", "把本周各科知识点做成卡片贴在墙上", "🗂️", "学习", "medium", "weekly", "知识体系化", 45, 30, 9, 12, so, DIM.Learn)); so++
	t = append(t, tpl("时间日志记录一天", "记录一天每项活动用了多长时间，睡前复盘", "⏱️", "学习", "medium", "once", "时间感知", 50, 10, 9, 12, so, DIM.Learn)); so++
	t = append(t, tpl("写一篇作文", "独立完成一篇作文", "✍️", "学习", "hard", "weekly", "写作", 60, 45, 9, 12, so, DIM.Learn)); so++
	// --- 社交情感 ---
	t = append(t, tpl("小组合作完成手工/任务", "在学校和同学合作一项作业并记录分工", "👥", "学习", "medium", "weekly", "团队协作", 45, 30, 8, 12, so, DIM.Soc)); so++
	t = append(t, tpl("家庭分享会：当主持人", "主持 1 次家庭分享会，定主题+请每人发言", "🎤", "其他", "medium", "monthly", "组织能力", 45, 30, 8, 12, so, DIM.Soc)); so++
	t = append(t, tpl("说不练习（礼貌拒绝）", "模拟礼貌拒绝别人的不合理要求（3 种说法）", "🙅", "其他", "medium", "monthly", "边界感", 40, 10, 8, 12, so, DIM.Soc)); so++
	t = append(t, tpl("家庭会议：提 1 条建议", "在家庭会议上提出 1 条建设性建议并说明理由", "📢", "其他", "medium", "monthly", "参与感", 40, 20, 8, 12, so, DIM.Soc)); so++
	t = append(t, tpl("给弟弟妹妹讲故事", "给比自己小的孩子讲一个完整故事", "📖", "学习", "medium", "weekly", "耐心+表达", 45, 15, 8, 12, so, DIM.Soc)); so++
	// --- 身心健康 ---
	t = append(t, tpl("平板支撑计时挑战", "保持平板支撑姿势 20/30/60 秒", "🧱", "运动", "medium", "daily", "核心稳定", 30, 2, 8, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("立定跳远练习+记录", "测 3 次立定跳远，记录最好成绩", "🐸", "运动", "medium", "weekly", "爆发力", 35, 10, 8, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("跑步 800 米/1 公里", "绕小区或操场慢跑 800 米以上", "🏃‍♀️", "运动", "medium", "weekly", "有氧耐力", 45, 15, 8, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("开合跳+跳绳组合循环", "1 分钟跳绳 + 1 分钟开合跳，循环 2 轮", "🪀", "运动", "hard", "weekly", "耐力+协调", 50, 15, 8, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("学习一种球类基础", "篮球运球/羽毛球颠球/乒乓球对墙打 基础动作", "🏀", "运动", "medium", "weekly", "专项入门", 45, 30, 8, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("跳绳进阶：双摇尝试", "尝试学习双摇（跳过一次绳摇两圈）", "🪢", "运动", "hard", "weekly", "进阶技能", 55, 20, 9, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("感恩记录：3 件好事", "睡前写下今天发生的 3 件好事（积极心理学）", "🌟", "学习", "easy", "daily", "积极心理", 20, 5, 8, 12, so, DIM.Hlth)); so++
	t = append(t, tpl("家庭运动会策划", "策划一次家庭迷你运动会（3~5 个项目）", "🏆", "其他", "hard", "monthly", "组织能力", 65, 40, 9, 12, so, DIM.Hlth)); so++

	// ===== 10-12岁 高年级 (G5-G6) =====
	// --- 生活自理 ---
	t = append(t, tpl("打扫卫生间", "清洁洗手台、镜子、地面、马桶外围", "🧽", "家务", "medium", "weekly", "深度清洁", 50, 25, 10, 11, so, DIM.Self)); so++
	t = append(t, tpl("擦洗自行车", "用湿布擦洗自行车车身、链条加油", "🚲", "家务", "medium", "weekly", "物品保养", 40, 20, 10, 11, so, DIM.Self)); so++
	t = append(t, tpl("整理鞋柜", "按季节/类型整理鞋柜，擦净灰尘", "👠", "家务", "medium", "weekly", "分类整理", 35, 20, 11, 12, so, DIM.Self)); so++
	t = append(t, tpl("整理厨房", "整理碗柜、台面，调料瓶归位", "🍴", "家务", "medium", "weekly", "秩序感", 50, 30, 11, 12, so, DIM.Self)); so++
	// --- 独立自主 ---
	t = append(t, tpl("电子支付+购物后分类", "独立扫码付款，回家按用途分类物品", "💳", "行为习惯", "medium", "weekly", "现代生活技能", 35, 25, 10, 11, so, DIM.Ind)); so++
	t = append(t, tpl("自己整理郊游物品", "出游前列清单，独立打包行李", "🎒", "行为习惯", "medium", "once", "准备能力", 35, 25, 10, 12, so, DIM.Ind)); so++
	t = append(t, tpl("ATM 自助存取款", "家长陪同下使用 ATM 存款、取款、查余额", "🏧", "学习", "medium", "monthly", "财商/金融素养", 45, 30, 10, 11, so, DIM.Ind)); so++
	t = append(t, tpl("做选择时列出利弊清单", "面对选择时（如报兴趣班）写 pros/cons", "📝", "学习", "medium", "once", "决策能力", 40, 20, 10, 12, so, DIM.Ind)); so++
	t = append(t, tpl("独立完成看病流程", "家长陪同下，挂号、候诊、向医生描述病情", "🏥", "行为习惯", "medium", "once", "社会适应", 50, 45, 10, 12, so, DIM.Ind)); so++
	t = append(t, tpl("独立乘坐公交/地铁", "家长陪同下独立完成刷卡、换乘、下车", "🚇", "行为习惯", "hard", "once", "社会适应", 60, 60, 10, 12, so, DIM.Ind)); so++
	t = append(t, tpl("规划使用压岁钱", "制定压岁钱三分法：储蓄/消费/公益", "🧧", "学习", "hard", "once", "财商/长期规划", 60, 30, 11, 12, so, DIM.Ind)); so++
	// --- 动手实践 ---
	t = append(t, tpl("凉拌黄瓜/凉拌土豆丝", "切菜+调料拌匀", "🥗", "家务", "medium", "weekly", "凉拌菜", 45, 25, 10, 11, so, DIM.Hands)); so++
	t = append(t, tpl("炒土豆丝/炒时蔬", "掌握炒菜火候与调味", "🥘", "家务", "hard", "weekly", "烹饪进阶", 60, 30, 10, 11, so, DIM.Hands)); so++
	t = append(t, tpl("发面包包子馒头", "和面、发酵、塑形、蒸制全流程", "🍞", "家务", "hard", "weekly", "发酵面食", 70, 90, 10, 11, so, DIM.Hands)); so++
	t = append(t, tpl("家务：保养小电器", "清洁电风扇、电饭煲外表面等", "💨", "家务", "easy", "monthly", "家电养护", 25, 20, 10, 11, so, DIM.Hands)); so++

	// ===== habit 习惯养成模板（25条，聚焦21天可养成的重复性好习惯）=====
	// 原则：每天/每次都要做的重复行为，非技能/非安全常识/非一次性任务
	// 参考：小学生1-6年级好习惯一览表（学习/生活/健康/行为/交友五大类）
	// 已与 daily 去重：刷牙/洗手/早睡/阅读/做作业/整理等由 daily 覆盖
	// --- 3-5岁 学前 ---
	t = append(t, tplHabit("饭后漱口", "每顿饭后用温水漱口，保持口腔清洁", "🥛", "行为习惯", "卫生习惯", 5, 3, 5, so, DIM.Self)); so++
	t = append(t, tplHabit("不挑食不剩饭", "尝试吃每种蔬菜，吃多少盛多少不浪费", "🥦", "行为习惯", "饮食习惯", 5, 3, 5, so, DIM.Hlth)); so++
	t = append(t, tplHabit("见人主动问好", "见到熟人主动打招呼说你好", "👋", "行为习惯", "礼貌习惯", 5, 3, 5, so, DIM.Soc)); so++
	t = append(t, tplHabit("说请和谢谢", "请求帮助说请，接受帮助说谢谢", "🙏", "行为习惯", "礼貌用语", 5, 3, 5, so, DIM.Soc)); so++
	t = append(t, tplHabit("按时午睡", "每天中午按时午休，恢复精力", "😴", "行为习惯", "作息习惯", 5, 3, 5, so, DIM.Hlth)); so++
	// --- 6-8岁 低年级 ---
	t = append(t, tplHabit("每天按时吃早餐", "起床后按时吃早餐，不拖拉不漏餐", "🍳", "行为习惯", "饮食习惯", 5, 6, 8, so, DIM.Hlth)); so++
	t = append(t, tplHabit("正确读写姿势", "保持眼离书一尺、胸离桌一拳、手离笔尖一寸", "📏", "行为习惯", "学习习惯", 5, 6, 8, so, DIM.Hlth)); so++
	t = append(t, tplHabit("课前准备用品", "每节课前把课本和文具摆好，铃响即坐好", "📚", "行为习惯", "学习习惯", 5, 6, 8, so, DIM.Learn)); so++
	t = append(t, tplHabit("不乱扔垃圾", "垃圾扔进垃圾桶，见到地上纸屑主动捡起", "🗑️", "行为习惯", "环保习惯", 5, 6, 8, so, DIM.Soc)); so++
	t = append(t, tplHabit("公共场合轻声细语", "在图书馆、医院、教室等场所轻声说话不打扰他人", "🤫", "行为习惯", "文明习惯", 5, 6, 8, so, DIM.Soc)); so++
	t = append(t, tplHabit("随手关灯关水", "离开房间关灯，用完水龙头拧紧不滴水", "💡", "行为习惯", "节约习惯", 5, 6, 8, so, DIM.Ind)); so++
	t = append(t, tplHabit("爱护书本", "不在课本上乱涂画，保持书本整洁不卷角", "📖", "行为习惯", "爱护物品", 5, 6, 8, so, DIM.Learn)); so++
	// --- 8-10岁 中年级 ---
	t = append(t, tplHabit("坚持写日记", "每天用几句话记录今天发生的一件事或心情", "📔", "行为习惯", "表达习惯", 5, 8, 10, so, DIM.Learn)); so++
	t = append(t, tplHabit("勤洗澡勤换衣", "每天洗澡换干净衣物，保持身体清爽", "🚿", "行为习惯", "卫生习惯", 5, 8, 10, so, DIM.Self)); so++
	t = append(t, tplHabit("主动排队守秩序", "乘车、打饭、如厕时自觉排队不插队", "🚶", "行为习惯", "文明习惯", 5, 8, 10, so, DIM.Soc)); so++
	t = append(t, tplHabit("文明用语不说脏话", "用文明语言与人交流，不说脏话不起绰号", "💬", "行为习惯", "文明习惯", 5, 8, 10, so, DIM.Soc)); so++
	t = append(t, tplHabit("节约粮食不浪费", "吃多少盛多少，光盘行动不剩饭菜", "🍚", "行为习惯", "节约习惯", 5, 8, 10, so, DIM.Ind)); so++
	// --- 10-12岁 高年级 ---
	t = append(t, tplHabit("每日反思总结", "睡前回顾今天做得好与不好的事，想想如何改进", "🤔", "行为习惯", "思考习惯", 5, 10, 12, so, DIM.Learn)); so++
	t = append(t, tplHabit("真诚待人守信", "答应别人的事努力做到，做不到及时说明并道歉", "🤝", "行为习惯", "诚信习惯", 5, 10, 12, so, DIM.Soc)); so++
	t = append(t, tplHabit("感恩父母做家务", "每天为家人做一件力所能及的小事表达感恩", "❤️", "行为习惯", "感恩习惯", 5, 10, 12, so, DIM.Soc)); so++
	t = append(t, tplHabit("积极乐观不抱怨", "遇到困难先想解决办法，不抱怨不放弃", "🌟", "行为习惯", "心态习惯", 5, 10, 12, so, DIM.Soc)); so++
	// --- 13+ 青少年 ---
	t = append(t, tplHabit("时间管理列计划", "每天早晨列出今日待办清单并按优先级执行", "📋", "学习", "时间管理", 5, 13, 99, so, DIM.Ind)); so++
	t = append(t, tplHabit("坚持健身打卡", "每周锻炼3次以上，每次不少于30分钟", "💪", "运动", "健身习惯", 5, 13, 99, so, DIM.Hlth)); so++
	t = append(t, tplHabit("零花钱记账", "记录每笔零花钱的收入与支出，每月复盘一次", "📊", "学习", "财商习惯", 5, 13, 99, so, DIM.Learn)); so++
	t = append(t, tplHabit("参与公益志愿", "每月参与一次社区服务或公益志愿活动", "🤲", "行为习惯", "社会责任", 5, 13, 99, so, DIM.Soc)); so++

	// ===== parent 主题任务模板（36条，含里程碑）=====
	// --- 3-4岁 ---
	t = append(t, tplParent("我的小花园", "在阳台用小花盆种下易于生长的植物，每日浇水观察", "🌻", "其他", 3, 4, 14, 0, so, `[{"title":"准备花盆与种子","days":1,"is_key":true},{"title":"播种","days":2,"is_key":true},{"title":"第一次浇水","days":3,"is_key":false},{"title":"发芽观察","days":7,"is_key":false},{"title":"开花/收获","days":14,"is_key":true}]`, DIM.Hands)); so++
	t = append(t, tplParent("家庭照片墙", "与家长一起挑选照片并布置一面家庭照片墙", "🖼️", "其他", 3, 4, 7, 0, so, `[{"title":"挑选照片","days":1,"is_key":true},{"title":"冲洗打印","days":3,"is_key":false},{"title":"布置照片墙","days":5,"is_key":true},{"title":"分享故事","days":7,"is_key":false}]`, DIM.Soc)); so++
	t = append(t, tplParent("树叶贴画", "收集不同形状的落叶，拼贴成一幅创意画", "🍂", "其他", 3, 4, 7, 0, so, `[{"title":"收集树叶","days":1,"is_key":true},{"title":"整理压平","days":3,"is_key":false},{"title":"拼贴创作","days":5,"is_key":true},{"title":"作品展示","days":7,"is_key":false}]`, DIM.Hands)); so++
	t = append(t, tplParent("亲子手印画", "用亲子手印组合创作一幅纪念画并装裱", "🖐️", "其他", 3, 4, 7, 0, so, `[{"title":"准备颜料","days":1,"is_key":true},{"title":"按手印","days":2,"is_key":true},{"title":"添画装饰","days":4,"is_key":false},{"title":"装裱完成","days":7,"is_key":true}]`, DIM.Hands)); so++
	t = append(t, tplParent("零食存钱罐", "用一周时间把零食钱省下并存入存钱罐，培养储蓄意识", "🐷", "学习", 3, 4, 14, 0, so, `[{"title":"准备存钱罐","days":1,"is_key":true},{"title":"第一次存入","days":2,"is_key":true},{"title":"中途记录","days":7,"is_key":false},{"title":"清点总额","days":14,"is_key":true}]`, DIM.Learn)); so++
	t = append(t, tplParent("邻居小朋友分享会", "邀请邻居小朋友来家里分享玩具与零食", "🎉", "行为习惯", 3, 4, 7, 0, so, `[{"title":"制作邀请卡","days":1,"is_key":true},{"title":"准备分享物","days":3,"is_key":false},{"title":"分享会进行","days":5,"is_key":true},{"title":"感谢与回顾","days":7,"is_key":false}]`, DIM.Soc)); so++
	// --- 5-6岁 ---
	t = append(t, tplParent("阳台小花圃", "在阳台规划一小块花圃，种植2-3种植物并记录生长", "🌷", "其他", 5, 6, 14, 0, so, `[{"title":"规划花圃","days":1,"is_key":true},{"title":"播种与培土","days":2,"is_key":true},{"title":"日常养护","days":7,"is_key":false},{"title":"生长记录","days":14,"is_key":true}]`, DIM.Hands)); so++
	t = append(t, tplParent("家庭绘本共创", "孩子口述故事，家长配文，孩子配图，共同完成一本绘本", "📖", "其他", 5, 6, 14, 0, so, `[{"title":"构思故事","days":1,"is_key":true},{"title":"分页脚本","days":3,"is_key":false},{"title":"绘制插画","days":7,"is_key":true},{"title":"装订成册","days":14,"is_key":true}]`, DIM.Soc)); so++
	t = append(t, tplParent("旧玩具义卖", "整理闲置玩具，在小区义卖并将所得捐给公益", "🧸", "行为习惯", 5, 6, 7, 0, so, `[{"title":"整理玩具","days":1,"is_key":true},{"title":"定价与海报","days":2,"is_key":false},{"title":"义卖进行","days":5,"is_key":true},{"title":"捐赠与复盘","days":7,"is_key":true}]`, DIM.Soc)); so++
	t = append(t, tplParent("零花钱日记", "用两周时间记录零花钱收入与支出，学习基本记账", "💵", "学习", 5, 6, 14, 0, so, `[{"title":"准备记账本","days":1,"is_key":true},{"title":"每日记录","days":2,"is_key":false},{"title":"中期汇总","days":7,"is_key":true},{"title":"期末复盘","days":14,"is_key":true}]`, DIM.Learn)); so++
	t = append(t, tplParent("纸盒小屋", "利用废旧纸盒搭建一座小屋模型，可作玩偶之家", "📦", "其他", 5, 6, 14, 0, so, `[{"title":"收集纸盒","days":1,"is_key":true},{"title":"设计草图","days":2,"is_key":false},{"title":"搭建结构","days":7,"is_key":true},{"title":"装饰完成","days":14,"is_key":true}]`, DIM.Hands)); so++
	t = append(t, tplParent("自然声音收集", "用手机录制身边的自然声音，制作一份声音地图", "🎙️", "其他", 5, 6, 7, 0, so, `[{"title":"准备设备","days":1,"is_key":true},{"title":"户外录音","days":2,"is_key":true},{"title":"整理分类","days":5,"is_key":false},{"title":"声音展示","days":7,"is_key":true}]`, DIM.Hands)); so++
	// --- 7-8岁 ---
	t = append(t, tplParent("社区图书角", "在楼栋或社区筹建一个共享图书角，制定借阅规则", "📚", "行为习惯", 7, 8, 21, 0, so, `[{"title":"选址与征集","days":1,"is_key":true},{"title":"书目整理","days":5,"is_key":false},{"title":"制定规则","days":10,"is_key":true},{"title":"正式开放","days":14,"is_key":true},{"title":"运营复盘","days":21,"is_key":false}]`, DIM.Soc)); so++
	t = append(t, tplParent("零花钱记账", "每日记录零花钱收支并分类，月末输出一份简单报表", "📊", "学习", 7, 8, 14, 0, so, `[{"title":"建立账本","days":1,"is_key":true},{"title":"每日记账","days":2,"is_key":false},{"title":"中期分类","days":7,"is_key":true},{"title":"月度报表","days":14,"is_key":true}]`, DIM.Learn)); so++
	t = append(t, tplParent("阳台种植", "在阳台种植番茄或辣椒，全程记录从播种到结果", "🍅", "家务", 7, 8, 21, 0, so, `[{"title":"选种与播种","days":1,"is_key":true},{"title":"发芽观察","days":5,"is_key":false},{"title":"移栽定植","days":10,"is_key":true},{"title":"开花结果","days":21,"is_key":true}]`, DIM.Hands)); so++
	t = append(t, tplParent("家庭厨艺日", "每周一次家庭厨艺日，孩子负责一道简单菜品", "👨‍🍳", "其他", 7, 8, 7, 0, so, `[{"title":"选定菜谱","days":1,"is_key":true},{"title":"采购食材","days":2,"is_key":false},{"title":"下厨烹饪","days":5,"is_key":true},{"title":"家人品评","days":7,"is_key":false}]`, DIM.Soc)); so++
	t = append(t, tplParent("手工贺卡", "为节日或家人制作一套手工贺卡并赠送", "💌", "其他", 7, 8, 7, 0, so, `[{"title":"设计贺卡","days":1,"is_key":true},{"title":"准备材料","days":2,"is_key":false},{"title":"制作贺卡","days":4,"is_key":true},{"title":"赠送亲友","days":7,"is_key":true}]`, DIM.Hands)); so++
	t = append(t, tplParent("短视频日记", "用手机拍摄一周生活短视频，剪辑成一支日记短片", "📱", "其他", 7, 8, 14, 0, so, `[{"title":"策划主题","days":1,"is_key":true},{"title":"每日拍摄","days":2,"is_key":false},{"title":"剪辑成片","days":10,"is_key":true},{"title":"家庭首映","days":14,"is_key":true}]`, DIM.Hands)); so++
	// --- 9-10岁 ---
	t = append(t, tplParent("家庭运动会策划", "孩子主导策划一场家庭趣味运动会，含项目设计与颁奖", "🏅", "其他", 9, 10, 14, 0, so, `[{"title":"项目设计","days":1,"is_key":true},{"title":"场地与道具","days":3,"is_key":false},{"title":"规则手册","days":5,"is_key":true},{"title":"运动会执行","days":10,"is_key":true},{"title":"颁奖复盘","days":14,"is_key":false}]`, DIM.Soc)); so++
	t = append(t, tplParent("校园公益义卖", "在校园内发起一次公益义卖，所得捐赠指定项目", "🏫", "行为习惯", 9, 10, 21, 0, so, `[{"title":"方案与立项","days":1,"is_key":true},{"title":"物资募集","days":5,"is_key":false},{"title":"宣传推广","days":10,"is_key":true},{"title":"义卖执行","days":15,"is_key":true},{"title":"捐赠与复盘","days":21,"is_key":true}]`, DIM.Soc)); so++
	t = append(t, tplParent("储蓄目标计划", "为一件心仪物品制定3周储蓄计划并完成兑换", "🎯", "学习", 9, 10, 21, 0, so, `[{"title":"设定目标","days":1,"is_key":true},{"title":"储蓄计划","days":2,"is_key":false},{"title":"中期检查","days":10,"is_key":true},{"title":"达成兑换","days":21,"is_key":true}]`, DIM.Learn)); so++
	t = append(t, tplParent("阳台菜园初体验", "在阳台种植生菜与小葱，体验从种植到餐桌", "🥬", "家务", 9, 10, 21, 0, so, `[{"title":"选种与播种","days":1,"is_key":true},{"title":"日常养护","days":7,"is_key":false},{"title":"间苗与施肥","days":14,"is_key":true},{"title":"采摘食用","days":21,"is_key":true}]`, DIM.Hands)); so++
	t = append(t, tplParent("手工编织", "学习简单编织技巧，完成一条围巾或杯垫", "🧶", "其他", 9, 10, 14, 0, so, `[{"title":"学习基础针法","days":1,"is_key":true},{"title":"起针练习","days":3,"is_key":false},{"title":"正式编织","days":7,"is_key":true},{"title":"收针完成","days":14,"is_key":true}]`, DIM.Hands)); so++
	t = append(t, tplParent("家乡美食地图", "调研并绘制一张家乡美食地图，配图文介绍", "🗺️", "其他", 9, 10, 14, 0, so, `[{"title":"美食调研","days":1,"is_key":true},{"title":"实地探访","days":5,"is_key":false},{"title":"绘制地图","days":10,"is_key":true},{"title":"图文成册","days":14,"is_key":true}]`, DIM.Hands)); so++
	// --- 11-12岁 ---
	t = append(t, tplParent("家庭厨艺周", "用一周时间为家人准备每日一道菜，并完成一本家庭菜谱", "🍲", "其他", 11, 12, 14, 0, so, `[{"title":"菜单设计","days":1,"is_key":true},{"title":"采购与备料","days":2,"is_key":false},{"title":"每日一菜","days":7,"is_key":true},{"title":"菜谱整理","days":14,"is_key":true}]`, DIM.Soc)); so++
	t = append(t, tplParent("手工义卖", "制作手工制品进行义卖，所得捐赠公益机构", "🎨", "行为习惯", 11, 12, 28, 0, so, `[{"title":"作品设计","days":1,"is_key":true},{"title":"批量制作","days":7,"is_key":false},{"title":"宣传预售","days":14,"is_key":true},{"title":"义卖执行","days":21,"is_key":true},{"title":"捐赠复盘","days":28,"is_key":true}]`, DIM.Soc)); so++
	t = append(t, tplParent("储蓄计划", "制定3周零花钱储蓄计划，并尝试简单的预算分配", "💰", "学习", 11, 12, 21, 0, so, `[{"title":"预算制定","days":1,"is_key":true},{"title":"分类储蓄","days":2,"is_key":false},{"title":"中期复盘","days":10,"is_key":true},{"title":"期末结算","days":21,"is_key":true}]`, DIM.Learn)); so++
	t = append(t, tplParent("屋顶花园", "在屋顶或阳台搭建一处花园，种植观赏与食用植物", "🌱", "家务", 11, 12, 28, 0, so, `[{"title":"空间规划","days":1,"is_key":true},{"title":"搭建花架","days":5,"is_key":false},{"title":"分批种植","days":10,"is_key":true},{"title":"养护记录","days":21,"is_key":false},{"title":"开花结果","days":28,"is_key":true}]`, DIM.Hands)); so++
	t = append(t, tplParent("木工小制作", "学习基础木工，完成一件实用的小木制品", "🔨", "其他", 11, 12, 21, 0, so, `[{"title":"学习工具","days":1,"is_key":true},{"title":"设计图纸","days":3,"is_key":false},{"title":"加工制作","days":10,"is_key":true},{"title":"打磨上漆","days":21,"is_key":true}]`, DIM.Hands)); so++
	t = append(t, tplParent("城市观察笔记", "连续3周观察并记录城市某一角落的变化，输出图文笔记", "🏙️", "其他", 11, 12, 21, 0, so, `[{"title":"选定主题","days":1,"is_key":true},{"title":"每周观察","days":7,"is_key":false},{"title":"资料整理","days":14,"is_key":true},{"title":"笔记成册","days":21,"is_key":true}]`, DIM.Hands)); so++
	// --- 13+岁 ---
	t = append(t, tplParent("阳台菜园", "在阳台搭建系统化菜园，实现4周内自给部分蔬菜", "🥗", "家务", 13, 99, 28, 0, so, `[{"title":"系统设计","days":1,"is_key":true},{"title":"搭建与播种","days":5,"is_key":true},{"title":"养护管理","days":14,"is_key":false},{"title":"首次采收","days":21,"is_key":true},{"title":"持续优化","days":28,"is_key":false}]`, DIM.Hands)); so++
	t = append(t, tplParent("短视频记录家乡", "围绕家乡主题拍摄并剪辑一支3-5分钟短视频", "🎬", "其他", 13, 99, 21, 0, so, `[{"title":"选题与脚本","days":1,"is_key":true},{"title":"实地拍摄","days":7,"is_key":true},{"title":"剪辑初版","days":14,"is_key":true},{"title":"发布分享","days":21,"is_key":true}]`, DIM.Hands)); so++
	t = append(t, tplParent("社区志愿服务", "在社区开展为期3周的志愿服务，如敬老陪伴或环境维护", "🤝", "行为习惯", 13, 99, 21, 0, so, `[{"title":"联系机构","days":1,"is_key":true},{"title":"制定计划","days":3,"is_key":false},{"title":"每周服务","days":7,"is_key":true},{"title":"中期反馈","days":14,"is_key":false},{"title":"总结报告","days":21,"is_key":true}]`, DIM.Soc)); so++
	t = append(t, tplParent("家庭月度预算", "主导制定家庭一月预算方案并跟踪执行情况", "📋", "其他", 13, 99, 21, 0, so, `[{"title":"预算方案","days":1,"is_key":true},{"title":"分类明细","days":3,"is_key":false},{"title":"执行跟踪","days":7,"is_key":true},{"title":"中期调整","days":14,"is_key":false},{"title":"月度复盘","days":21,"is_key":true}]`, DIM.Soc)); so++
	t = append(t, tplParent("个人理财规划", "制定4周个人理财规划，含储蓄、预算与简单投资模拟", "📈", "学习", 13, 99, 28, 0, so, `[{"title":"财务盘点","days":1,"is_key":true},{"title":"规划制定","days":3,"is_key":false},{"title":"执行储蓄","days":7,"is_key":true},{"title":"投资模拟","days":14,"is_key":true},{"title":"期末复盘","days":28,"is_key":true}]`, DIM.Learn)); so++
	t = append(t, tplParent("手工皮具制作", "学习基础皮艺，完成一件皮具作品如卡包或钥匙扣", "👜", "其他", 13, 99, 28, 0, so, `[{"title":"学习基础","days":1,"is_key":true},{"title":"设计与裁切","days":5,"is_key":false},{"title":"缝制成型","days":14,"is_key":true},{"title":"打磨封边","days":21,"is_key":false},{"title":"成品完成","days":28,"is_key":true}]`, DIM.Hands)); so++

	return t
}

// SeedInitialTemplates 为单个家庭初始化默认任务模板（幂等：已有模板则跳过）
// 模板库 v7：215 条（154 daily + 25 habit + 36 parent），统一管理三类任务模板
func (s *TaskTemplateService) SeedInitialTemplates(familyID, createdBy uint) error {
	var count int64
	if err := database.DB.Model(&model.TaskTemplate{}).Where("family_id = ?", familyID).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	defaults := buildDefaultTemplates(familyID, createdBy)

	for i := range defaults {
		if err := database.DB.Create(&defaults[i]).Error; err != nil {
			log.Printf("初始化任务模板失败(family=%d, title=%s): %v", familyID, defaults[i].Title, err)
			return err
		}
	}
	log.Printf("已为家庭 %d 初始化 %d 个任务模板(v2)", familyID, len(defaults))
	return nil
}

// SeedAllFamiliesTemplates 为所有家庭执行基础初始化（原有逻辑保留）
func SeedAllFamiliesTemplates() error {
	var families []model.Family
	if err := database.DB.Find(&families).Error; err != nil {
		return err
	}
	s := NewTaskTemplateService()
	for _, f := range families {
		if err := s.SeedInitialTemplates(f.ID, 0); err != nil {
			log.Printf("为家庭 %d 补齐任务模板失败: %v", f.ID, err)
		}
	}
	return nil
}

// ReseedAllFamiliesTemplates 清除所有家庭的任务模板数据并重新插入最新版本
// 警告：会删除所有家庭自建的模板（is_system=false），仅保留系统模板的最新版本
// 通过环境变量 RESET_TEMPLATES=true 触发，避免误操作
func ReseedAllFamiliesTemplates() error {
	// 1. 删除所有任务模板
	if err := database.DB.Where("1 = 1").Delete(&model.TaskTemplate{}).Error; err != nil {
		return fmt.Errorf("清除旧模板失败: %w", err)
	}
	log.Printf("[Reseed] 已清除所有旧任务模板")

	// 2. 为每个家庭重新插入最新模板
	var families []model.Family
	if err := database.DB.Find(&families).Error; err != nil {
		return fmt.Errorf("查询家庭列表失败: %w", err)
	}
	totalInserted := 0
	for _, f := range families {
		// 直接调用 buildDefaultTemplates + 批量插入（跳过 SeedInitialTemplates 的幂等检查）
		defaults := buildDefaultTemplates(f.ID, 0)
		for i := range defaults {
			if err := database.DB.Create(&defaults[i]).Error; err != nil {
				log.Printf("[Reseed] 家庭 %d 插入模板失败 title=%s: %v", f.ID, defaults[i].Title, err)
				continue
			}
			totalInserted++
		}
		log.Printf("[Reseed] 家庭 %d 已插入 %d 条最新模板", f.ID, len(defaults))
	}
	log.Printf("[Reseed] 全局共为 %d 个家庭插入 %d 条最新模板", len(families), totalInserted)
	return nil
}

// SeedAllFamiliesTemplates_Expanded 为已存在的家庭补齐 v7 版扩充模板
// 幂等：只插入该家庭中标题尚不存在的模板，避免重复
// 适用：已运行过旧版系统的家庭，补齐 habit/parent 模板 + 赋予维度ID
func SeedAllFamiliesTemplates_Expanded() error {
	var families []model.Family
	if err := database.DB.Find(&families).Error; err != nil {
		return err
	}
	totalInserted := 0
	for _, f := range families {
		// 读取该家庭现有标题集合（用于幂等去重）
		var existingTitles []string
		if err := database.DB.Model(&model.TaskTemplate{}).
			Where("family_id = ?", f.ID).
			Pluck("title", &existingTitles).Error; err != nil {
			log.Printf("[SeedExpanded] 家庭 %d 读取现有模板失败: %v", f.ID, err)
			continue
		}
		titleSet := make(map[string]bool, len(existingTitles))
		for _, t := range existingTitles {
			titleSet[t] = true
		}

		// 用占位 createdBy=0 生成完整模板库
		full := buildDefaultTemplates(f.ID, 0)
		inserted := 0
		for i := range full {
			if titleSet[full[i].Title] {
				continue // 同家庭标题已存在，跳过
			}
			if err := database.DB.Create(&full[i]).Error; err != nil {
				log.Printf("[SeedExpanded] 家庭 %d 插入模板失败 title=%s: %v", f.ID, full[i].Title, err)
				continue
			}
			inserted++
		}
		if inserted > 0 {
			log.Printf("[SeedExpanded] 家庭 %d 新增 %d 条扩充模板（原有%d条）", f.ID, inserted, len(existingTitles))
		}
		totalInserted += inserted
	}
	log.Printf("[SeedExpanded] 全局共新增 %d 条扩充模板", totalInserted)
	return nil
}

// ===== B 恢复系统默认模板 =====

// ResetSystemTemplate 按标题将系统模板恢复为默认版本（B 恢复单条）
// 从 buildDefaultTemplates 找到原版，覆盖该家庭下同标题系统模板的字段
func (s *TaskTemplateService) ResetSystemTemplate(familyID uint, title string) error {
	defaults := buildDefaultTemplates(0, 0)
	var master *model.TaskTemplate
	for i := range defaults {
		if defaults[i].Title == title {
			master = &defaults[i]
			break
		}
	}
	if master == nil {
		return errors.New("未找到该标题的系统默认模板")
	}
	return database.DB.Model(&model.TaskTemplate{}).
		Where("family_id = ? AND title = ? AND is_system = ?", familyID, title, true).
		Updates(map[string]interface{}{
			"description":          master.Description,
			"icon":                 master.Icon,
			"category":             master.Category,
			"points":               master.Points,
			"min_age":              master.MinAge,
			"max_age":              master.MaxAge,
			"difficulty":           master.Difficulty,
			"frequency":            master.Frequency,
			"estimated_time":       master.EstimatedTime,
			"tags":                 master.Tags,
			"ability_dimension_id": master.AbilityDimensionID,
			"is_active":            true,
			"is_customized":        false,
			"updated_at":           time.Now(),
		}).Error
}

// RestoreAllSystemTemplates 恢复所有已删除/已停用的系统模板（B 恢复全部）
// 已存在的系统模板恢复启用+重置为默认；已删除的重新插入
func (s *TaskTemplateService) RestoreAllSystemTemplates(familyID uint) (int, error) {
	defaults := buildDefaultTemplates(familyID, 0)
	var existingTitles []string
	database.DB.Model(&model.TaskTemplate{}).Where("family_id = ?", familyID).Pluck("title", &existingTitles)
	titleSet := make(map[string]bool, len(existingTitles))
	for _, t := range existingTitles {
		titleSet[t] = true
	}
	restored := 0
	for i := range defaults {
		if titleSet[defaults[i].Title] {
			// 已存在，恢复启用+重置为默认
			database.DB.Model(&model.TaskTemplate{}).
				Where("family_id = ? AND title = ? AND is_system = ?", familyID, defaults[i].Title, true).
				Updates(map[string]interface{}{
					"is_active":     true,
					"is_customized": false,
					"updated_at":    time.Now(),
				})
			continue
		}
		// 不存在，重新插入
		if err := database.DB.Create(&defaults[i]).Error; err != nil {
			log.Printf("恢复系统模板失败 title=%s: %v", defaults[i].Title, err)
			continue
		}
		restored++
	}
	return restored, nil
}

// ===== C 按维度批量启停 =====

// BatchToggleByDimension 按能力维度批量启停系统模板（C 批量停用）
func (s *TaskTemplateService) BatchToggleByDimension(familyID uint, dimensionID uint, isActive bool) (int64, error) {
	result := database.DB.Model(&model.TaskTemplate{}).
		Where("family_id = ? AND is_system = ? AND ability_dimension_id = ?", familyID, true, dimensionID).
		Update("is_active", isActive)
	return result.RowsAffected, result.Error
}

// BatchToggleByIDs 按 ID 列表批量启停模板（C 多选批量操作）
func (s *TaskTemplateService) BatchToggleByIDs(familyID uint, ids []uint, isActive bool) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	result := database.DB.Model(&model.TaskTemplate{}).
		Where("family_id = ? AND id IN ?", familyID, ids).
		Update("is_active", isActive)
	return result.RowsAffected, result.Error
}

// ===== D 模板广场（分享/浏览/导入） =====

// ShareToPlaza 将家庭模板分享到模板广场（D 分享）
// 创建一条 family_id=0, share_status=shared 的副本到公共池
func (s *TaskTemplateService) ShareToPlaza(familyID, templateID, sharedBy uint) (*model.TaskTemplate, error) {
	tpl, err := s.GetTemplate(templateID, familyID)
	if err != nil {
		return nil, err
	}
	// 检查广场是否已存在同标题
	var count int64
	database.DB.Model(&model.TaskTemplate{}).
		Where("family_id = 0 AND title = ? AND share_status = ?", tpl.Title, "shared").
		Count(&count)
	if count > 0 {
		return nil, errors.New("该模板已分享到广场")
	}
	plazaCopy := model.TaskTemplate{
		FamilyID:           0, // 0 = 广场公共池
		CreatedBy:          sharedBy,
		Title:              tpl.Title,
		Description:        tpl.Description,
		Icon:               tpl.Icon,
		Category:           tpl.Category,
		Points:             tpl.Points,
		SortOrder:          0,
		IsActive:           true,
		MinAge:             tpl.MinAge,
		MaxAge:             tpl.MaxAge,
		Difficulty:         tpl.Difficulty,
		Frequency:          tpl.Frequency,
		EstimatedTime:      tpl.EstimatedTime,
		Tags:               tpl.Tags,
		IsSystem:           false,
		AbilityDimensionID: tpl.AbilityDimensionID,
		MasterTitle:        tpl.Title,
		ShareStatus:        "shared",
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}
	if err := database.DB.Create(&plazaCopy).Error; err != nil {
		return nil, errors.New("分享到广场失败")
	}
	// 标记原模板为已分享
	database.DB.Model(tpl).Update("share_status", "shared")
	return &plazaCopy, nil
}

// ListPlaza 浏览模板广场（D 浏览）
func (s *TaskTemplateService) ListPlaza(dimensionID *uint, page, size int) ([]model.TaskTemplate, int64, error) {
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 50 {
		size = 20
	}
	q := database.DB.Where("family_id = 0 AND share_status = ?", "shared")
	if dimensionID != nil {
		q = q.Where("ability_dimension_id = ?", *dimensionID)
	}
	var total int64
	q.Model(&model.TaskTemplate{}).Count(&total)
	var list []model.TaskTemplate
	err := q.Order("created_at DESC").
		Offset((page - 1) * size).Limit(size).
		Find(&list).Error
	return list, total, err
}

// ImportFromPlaza 从广场导入模板到家庭（D 导入）
func (s *TaskTemplateService) ImportFromPlaza(familyID, createdBy, plazaID uint) (*model.TaskTemplate, error) {
	var plaza model.TaskTemplate
	if err := database.DB.Where("id = ? AND family_id = 0 AND share_status = ?", plazaID, "shared").First(&plaza).Error; err != nil {
		return nil, errors.New("广场模板不存在")
	}
	var count int64
	database.DB.Model(&model.TaskTemplate{}).
		Where("family_id = ? AND title = ?", familyID, plaza.Title).
		Count(&count)
	if count > 0 {
		return nil, errors.New("家庭已有同标题模板，请先删除或重命名")
	}
	imported := model.TaskTemplate{
		FamilyID:           familyID,
		CreatedBy:          createdBy,
		Title:              plaza.Title,
		Description:        plaza.Description,
		Icon:               plaza.Icon,
		Category:           plaza.Category,
		Points:             plaza.Points,
		SortOrder:          0,
		IsActive:           true,
		MinAge:             plaza.MinAge,
		MaxAge:             plaza.MaxAge,
		Difficulty:         plaza.Difficulty,
		Frequency:          plaza.Frequency,
		EstimatedTime:      plaza.EstimatedTime,
		Tags:               plaza.Tags,
		IsSystem:           false,
		AbilityDimensionID: plaza.AbilityDimensionID,
		MasterTitle:        plaza.Title,
		ShareStatus:        "imported",
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}
	if err := database.DB.Create(&imported).Error; err != nil {
		return nil, errors.New("导入模板失败")
	}
	return &imported, nil
}

// ===== E 系统模板继承同步 =====

// SyncSystemTemplates 同步系统模板更新（E 继承同步）
// 遍历所有家庭，对 IsSystem=true 且 IsCustomized=false 的模板，
// 按 MasterTitle 从 buildDefaultTemplates 找到最新原版并覆盖字段。
// 已被家庭自定义的模板跳过，保护家长手动修改。
func SyncSystemTemplates() error {
	var families []model.Family
	if err := database.DB.Find(&families).Error; err != nil {
		return err
	}
	defaults := buildDefaultTemplates(0, 0)
	masterMap := make(map[string]*model.TaskTemplate, len(defaults))
	for i := range defaults {
		masterMap[defaults[i].Title] = &defaults[i]
	}
	totalSynced := 0
	for _, f := range families {
		var templates []model.TaskTemplate
		database.DB.Where("family_id = ? AND is_system = ? AND is_customized = ?", f.ID, true, false).Find(&templates)
		for _, t := range templates {
			master, ok := masterMap[t.MasterTitle]
			if !ok {
				continue // 母版已不存在（可能已下架）
			}
			database.DB.Model(&model.TaskTemplate{}).
				Where("id = ?", t.ID).
				Updates(map[string]interface{}{
					"description":          master.Description,
					"icon":                 master.Icon,
					"category":             master.Category,
					"points":               master.Points,
					"min_age":              master.MinAge,
					"max_age":              master.MaxAge,
					"difficulty":           master.Difficulty,
					"frequency":            master.Frequency,
					"estimated_time":       master.EstimatedTime,
					"tags":                 master.Tags,
					"ability_dimension_id": master.AbilityDimensionID,
					"updated_at":           time.Now(),
				})
			totalSynced++
		}
	}
	if totalSynced > 0 {
		log.Printf("[SyncSystemTemplates] 共同步 %d 条未自定义的系统模板", totalSynced)
	}
	return nil
}
