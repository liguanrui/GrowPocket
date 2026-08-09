package main

import (
	"growpocket/internal/config"
	"growpocket/internal/database"
	"growpocket/internal/handler"
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/pkg/envloader"
	"log"
	"os"

	"github.com/gin-gonic/gin"
)

func main() {
	// 加载 .env 文件（若存在），不覆盖已存在的环境变量
	if err := envloader.Load(".env"); err != nil {
		log.Println("未找到 .env 文件，使用系统环境变量或默认值")
	}

	cfg := config.Load()

	// 初始化数据库
	database.Init(cfg.DBPath)
	log.Printf("数据库初始化完成: %s", cfg.DBPath)

	// 初始化成就数据
	if err := service.InitAchievements(); err != nil {
		log.Printf("初始化成就数据失败: %v", err)
	}

	// 任务模板重置：通过环境变量 RESET_TEMPLATES=true 触发，清除旧数据并重新插入最新模板
	if os.Getenv("RESET_TEMPLATES") == "true" {
		log.Printf("检测到 RESET_TEMPLATES=true，开始重置所有家庭任务模板...")
		if err := service.ReseedAllFamiliesTemplates(); err != nil {
			log.Printf("重置任务模板失败: %v", err)
		} else {
			log.Printf("任务模板重置完成")
		}
	}

	// 为已有家庭补齐默认任务模板（基础幂等初始化，旧33条兼容）
	if err := service.SeedAllFamiliesTemplates(); err != nil {
		log.Printf("补齐任务模板失败: %v", err)
	}
	// 任务模板 v2 扩充迁移：为老家庭补齐约 117 条新模板 + 旧模板 AbilityDimensionID 回填
	// 幂等：按 title 去重插入，已迁移过的家庭不会重复写入
	if err := service.SeedAllFamiliesTemplates_Expanded(); err != nil {
		log.Printf("扩充任务模板(v2)失败: %v", err)
	}
	// E 系统模板继承同步：将未自定义的系统模板字段更新为最新版本（保护家长已手动改过的模板）
	if err := service.SyncSystemTemplates(); err != nil {
		log.Printf("同步系统模板失败: %v", err)
	}

	// 初始化 AI 服务（文本 + 可选识图多模态）
	aiService := service.NewAIService(cfg.AIAPIKey, cfg.AIModel, cfg.AIBaseURL)
	aiService.SetVisionConfig(cfg.VisionAPIKey, cfg.VisionModel, cfg.VisionBaseURL)
	if cfg.VisionModel != "" {
		log.Printf("识图模型已配置: %s @ %s", cfg.VisionModel, cfg.VisionBaseURL)
	} else {
		log.Printf("未配置 VISION_MODEL：相册旁白将优先用画面描述缓存润色（DeepSeek 文本模型无法直接识图）")
	}

	// 启动 AI 每日任务生成定时器（v3）
	taskGenService := service.NewTaskGenerationService(aiService)
	taskGenService.StartDailyScheduler()

	// Gin
	r := gin.Default()

	// 中间件
	r.Use(middleware.CORS())
	r.Static("/uploads", cfg.UploadDir)

	// 公开路由（无需登录）
	public := r.Group("/api")
	{
		authHandler := handler.NewAuthHandler(cfg)
		public.POST("/auth/register", authHandler.Register)
		public.POST("/auth/login", authHandler.Login)

		// 健康检查
		public.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok"})
		})
	}

	// 需要登录的路由
	authorized := r.Group("/api")
	authorized.Use(middleware.JWTAuth(cfg.JWTSecret))
	{
		// 孩子档案
		childrenHandler := handler.NewChildrenHandler()
		authorized.POST("/children", childrenHandler.AddChild)
		authorized.GET("/children", childrenHandler.ListChildren)
		authorized.GET("/children/:id", childrenHandler.GetChild)
		authorized.PUT("/children/:id", childrenHandler.UpdateChild)
		authorized.DELETE("/children/:id", childrenHandler.DeleteChild)
		authorized.GET("/family", childrenHandler.GetFamily)
		authorized.PUT("/family/name", childrenHandler.UpdateFamilyName)
		authorized.POST("/family/share-code/regenerate", childrenHandler.RegenerateShareCode)

		// 任务
		taskHandler := handler.NewTaskHandler(cfg)
		authorized.POST("/tasks", taskHandler.CreateTask)
		authorized.GET("/tasks", taskHandler.ListTasks)
		authorized.GET("/tasks/:id", taskHandler.GetTask)
		authorized.PUT("/tasks/:id", taskHandler.UpdateTask)
		authorized.DELETE("/tasks/:id", taskHandler.DeleteTask)
		authorized.PUT("/tasks/:id/submit", taskHandler.SubmitTask)
		authorized.PUT("/tasks/:id/review", taskHandler.ReviewTask)

		// 通用媒体上传（任务成果图/视频等）
		uploadHandler := handler.NewUploadHandler(cfg)
		authorized.POST("/upload", uploadHandler.Upload)

		// AI 任务审核（v3）
		taskGenHandler := handler.NewTaskGenerationHandler().WithService(taskGenService)
		authorized.PUT("/tasks/:id/ai-review", taskGenHandler.ReviewAITask)
		authorized.POST("/tasks/ai-generate", taskGenHandler.GenerateToday)

		// 主题任务（父任务）+ 子任务大纲生成 + 分批实例化（Task 19）
		parentTaskHandler := handler.NewParentTaskHandler(service.NewParentTaskService(aiService))
		authorized.POST("/tasks/parent", parentTaskHandler.CreateParentTask)
		authorized.DELETE("/tasks/parent/:id", parentTaskHandler.DeleteParentTask)
		authorized.POST("/tasks/parent/:id/generate-children", parentTaskHandler.GenerateChildren)
		authorized.POST("/tasks/parent/:id/advance-batch", parentTaskHandler.AdvanceBatch)
		authorized.GET("/tasks/:id/children", parentTaskHandler.GetChildren)
		authorized.GET("/tasks/:id/parent", parentTaskHandler.GetParentByChildTask)

		// 积分
		scoreHandler := handler.NewScoreHandler(cfg)
		authorized.GET("/score/balance", scoreHandler.GetBalance)
		authorized.GET("/score/history", scoreHandler.GetHistory)
		authorized.GET("/score/monthly-stats", scoreHandler.GetMonthlyStats)
		authorized.POST("/score/add", scoreHandler.AddPoints)
		authorized.POST("/score/deduct", scoreHandler.DeductPoints)
		authorized.GET("/score/trend", scoreHandler.GetTrend)

		// 兑换商城
		redeemHandler := handler.NewRedeemHandler()
		authorized.POST("/redeem/items", redeemHandler.CreateItem)
		authorized.GET("/redeem/items", redeemHandler.ListItems)
		authorized.GET("/redeem/items/:id", redeemHandler.GetItem)
		authorized.PUT("/redeem/items/:id", redeemHandler.UpdateItem)
		authorized.DELETE("/redeem/items/:id", redeemHandler.DeleteItem)
		authorized.POST("/redeems", redeemHandler.Redeem)
		authorized.GET("/redeems", redeemHandler.GetRedeems)

		// 成长
		growthHandler := handler.NewGrowthHandler()
		authorized.GET("/growth/album", growthHandler.Album)
		authorized.GET("/growth/timeline", growthHandler.Timeline)

		// 成就勋章
		achievementHandler := handler.NewAchievementHandler()
		authorized.GET("/achievements", achievementHandler.GetAchievements)
		authorized.POST("/achievements/check", achievementHandler.CheckAndUnlock)
		authorized.GET("/achievements/awards", achievementHandler.GetAchievementAwards)
		authorized.POST("/achievements", achievementHandler.CreateAchievement)
		authorized.PUT("/achievements/:id", achievementHandler.UpdateAchievement)
		authorized.DELETE("/achievements/:id", achievementHandler.DeleteAchievement)

		// 能力维度（v3）
		abilityHandler := handler.NewAbilityHandler()
		authorized.GET("/abilities", abilityHandler.ListDimensions)
		authorized.GET("/abilities/scores/:child_id", abilityHandler.GetChildScores)
		authorized.GET("/abilities/growth-index/:child_id", abilityHandler.GetGrowthIndex)

		// 成长周期与目标（v3）
		growthCycleHandler := handler.NewGrowthCycleHandler()
		authorized.POST("/growth-cycles", growthCycleHandler.CreateCycle)
		authorized.PUT("/growth-cycles/:id", growthCycleHandler.UpdateCycle)
		authorized.POST("/growth/goals/batch", growthCycleHandler.SetGoalsBatch)
		authorized.GET("/growth-cycles/current/:child_id", growthCycleHandler.GetCurrentCycle)
		authorized.GET("/growth-cycles/cycle-stats", growthCycleHandler.GetCycleStats)

		// 任务模板
		taskTemplateHandler := handler.NewTaskTemplateHandler()
		authorized.POST("/task-templates", taskTemplateHandler.CreateTemplate)
		authorized.GET("/task-templates", taskTemplateHandler.ListTemplates)
		authorized.GET("/task-templates/:id", taskTemplateHandler.GetTemplate)
		authorized.PUT("/task-templates/:id", taskTemplateHandler.UpdateTemplate)
		authorized.DELETE("/task-templates/:id", taskTemplateHandler.DeleteTemplate)
		authorized.POST("/task-templates/:id/create-task", taskTemplateHandler.CreateTaskFromTemplate)
		// B 恢复系统默认模板（单条按 title / 全部恢复）
		authorized.POST("/task-template-actions/reset", taskTemplateHandler.ResetSystemTemplate)
		authorized.POST("/task-template-actions/restore-all", taskTemplateHandler.RestoreAllSystemTemplates)
		// C 按能力维度批量启停系统模板
		authorized.POST("/task-template-actions/batch-toggle", taskTemplateHandler.BatchToggleByDimension)
		// C 多选批量启停模板
		authorized.POST("/task-template-actions/batch-toggle-ids", taskTemplateHandler.BatchToggleByIDs)
		// D 模板广场（分享/浏览/导入）
		authorized.POST("/task-templates/:id/share", taskTemplateHandler.ShareToPlaza)
		authorized.GET("/task-template-plaza", taskTemplateHandler.ListPlaza)
		authorized.POST("/task-template-plaza/:id/import", taskTemplateHandler.ImportFromPlaza)

		// AI 智能推荐
		taskRecommendHandler := handler.NewTaskRecommendHandler()
		authorized.GET("/task-recommendations", taskRecommendHandler.GetRecommendations)

		// 循环任务配置
		taskRecurringHandler := handler.NewTaskRecurringHandler()
		authorized.POST("/task-recurring-configs", taskRecurringHandler.CreateRecurringConfig)
		authorized.GET("/task-recurring-configs", taskRecurringHandler.ListRecurringConfigs)
		authorized.GET("/task-recurring-configs/:id", taskRecurringHandler.GetRecurringConfig)
		authorized.PUT("/task-recurring-configs/:id", taskRecurringHandler.UpdateRecurringConfig)
		authorized.DELETE("/task-recurring-configs/:id", taskRecurringHandler.DeleteRecurringConfig)
		authorized.POST("/task-recurring-configs/generate", taskRecurringHandler.GenerateTasks)

		// 社区 - 分享
		communityHandler := handler.NewCommunityHandler()
		authorized.POST("/community/shares", communityHandler.CreateShare)
		authorized.GET("/community/shares", communityHandler.ListShares)
		authorized.GET("/community/shares/:id", communityHandler.GetShare)
		authorized.DELETE("/community/shares/:id", communityHandler.DeleteShare)
		authorized.POST("/community/shares/:id/like", communityHandler.ToggleLike)
		authorized.POST("/community/shares/:id/comments", communityHandler.AddComment)
		authorized.GET("/community/shares/:id/comments", communityHandler.ListComments)

		// 社区 - 公益项目
		authorized.GET("/community/charity-projects", communityHandler.ListProjects)
		authorized.POST("/community/charity-projects/:id/donate", communityHandler.CreateDonation)
		authorized.GET("/community/charity-projects/my", communityHandler.ListMyDonations)

		// 社区 - 公益活动
		activityHandler := handler.NewActivityHandler()
		authorized.POST("/community/activities", activityHandler.CreateActivity)
		authorized.GET("/community/activities", activityHandler.ListActivities)
		authorized.GET("/community/activities/:id", activityHandler.GetActivity)
		authorized.POST("/community/activities/:id/join", activityHandler.JoinActivity)
		authorized.POST("/community/activities/:id/complete", activityHandler.CompleteActivity)
		authorized.DELETE("/community/activities/:id", activityHandler.DeleteActivity)
		authorized.GET("/community/activities/my", activityHandler.ListMyActivities)

		// 系统消息（站内信）
		msgHandler := handler.NewSystemMessageHandler()
		authorized.GET("/messages", msgHandler.List)
		authorized.GET("/messages/unread-count", msgHandler.UnreadCount)
		authorized.POST("/messages/read-all", msgHandler.MarkAllRead)
		authorized.POST("/messages/:id/read", msgHandler.MarkRead)

		// AI 助理对话（v3）
		chatHandler := handler.NewChatHandler(service.NewChatService(aiService))
		authorized.POST("/chat/message", chatHandler.SendMessage)
		authorized.POST("/chat/message/confirm", chatHandler.ConfirmMessage)
		authorized.GET("/chat/history/:child_id", chatHandler.GetHistory)
		authorized.GET("/chat/sessions", chatHandler.ListSessions)
		authorized.POST("/chat/sessions", chatHandler.CreateSession)
		authorized.GET("/chat/sessions/search", chatHandler.SearchSessions)
		authorized.GET("/chat/sessions/:id/messages", chatHandler.GetSessionMessages)

		// 云端 TTS（小萌芽助手女声，Edge XiaoxiaoNeural）
		ttsHandler := handler.NewTTSHandler(service.NewTTSService())
		authorized.POST("/tts", ttsHandler.Synthesize)

		// 成长故事（v3）
		growthStoryHandler := handler.NewGrowthStoryHandler(service.NewGrowthStoryService(aiService))
		authorized.GET("/growth-stories", growthStoryHandler.ListStories)
		authorized.POST("/growth-stories/:cycle_id", growthStoryHandler.GenerateStory)
		// by-id 路由必须放在 :cycle_id 之前，避免 "by-id" 被误解析为 cycle_id 参数值
		authorized.GET("/growth-stories/by-id/:story_id", growthStoryHandler.GetStoryByID)
		authorized.POST("/growth-stories/by-id/:story_id/yearbook", growthStoryHandler.EnsureYearbookCopy)
		authorized.GET("/growth-stories/:cycle_id", growthStoryHandler.GetStory)
		authorized.GET("/growth-stories/:cycle_id/tasks", growthStoryHandler.GetCycleTasks)

		// 问卷（v3）
		questionnaireHandler := handler.NewQuestionnaireHandler()
		authorized.GET("/questionnaires/:stage", questionnaireHandler.GetByStage)
		authorized.POST("/questionnaires/submit", questionnaireHandler.Submit)

		// 大师挑战（V3.1 模块 B）
		masterChallengeHandler := handler.NewMasterChallengeHandler(service.NewMasterChallengeService(aiService))
		authorized.GET("/master-challenges/templates", masterChallengeHandler.GetTemplates)
		authorized.POST("/master-challenges/start", masterChallengeHandler.StartInstance)
		authorized.GET("/master-challenges/instances/:child_id", masterChallengeHandler.ListInstances)
		authorized.GET("/master-challenges/instances/detail/:instance_id", masterChallengeHandler.GetInstanceDetail)
		authorized.PUT("/master-challenges/stages/:stage_id", masterChallengeHandler.UpdateStage)
		authorized.POST("/master-challenges/submit/:instance_id", masterChallengeHandler.SubmitForReview)
		authorized.POST("/master-challenges/review/:submission_id", masterChallengeHandler.Review)

		// 学业双层结构（v3.1 模块 D：学业趋势档位 + 学业奖励池）
		academicHandler := handler.NewAcademicHandler()
		authorized.POST("/academic/milestones", academicHandler.RecordMilestone)
		authorized.GET("/academic/milestones/:child_id", academicHandler.GetMilestones)
		authorized.POST("/academic/trends", academicHandler.RecordTrend)
		authorized.GET("/academic/trends/:child_id", academicHandler.GetTrends)
		authorized.GET("/academic/allowed-types/:child_id", academicHandler.GetAllowedTypes)

		// 习惯库
		habitsGroup := authorized.Group("/habits")
		habitsGroup.GET("/preset", handler.GetPresetHabits)
		habitsGroup.POST("/custom", handler.CreateCustomHabit)
		habitsGroup.GET("/active", handler.GetActiveHabits)
		habitsGroup.GET("/:id/stats", handler.GetHabitStats)

		// 主题任务模板
		parentTaskTemplatesGroup := authorized.Group("/parent-task-templates")
		parentTaskTemplatesGroup.GET("/preset", handler.GetPresetParentTaskTemplates)
		parentTaskTemplatesGroup.POST("/custom", handler.CreateCustomParentTaskTemplate)

		// 调试接口：临时对生产开放（测完记得加回 APP_ENV=development 门禁）
		debugHandler := handler.NewDebugHandler(taskGenService)
		authorized.POST("/debug/advance-time", debugHandler.AdvanceTime)
		authorized.POST("/debug/reset-time", debugHandler.ResetTime)
		authorized.GET("/debug/time", debugHandler.GetTime)
	}

	// === 管理后台 Admin 路由 ===
	adminService := service.NewAdminAuthService(cfg)
	adminHandler := handler.NewAdminHandler(cfg).WithService(adminService)

	// admin 公开路由（无需登录）
	adminPublic := r.Group("/api/admin")
	{
		adminPublic.POST("/auth/login", adminHandler.Login)
	}

	// Dashboard Handler
	dashHandler := handler.NewAdminDashboardHandler(service.NewAdminDashboardService(), adminService)

	// admin 需登录路由
	adminAuthorized := r.Group("/api/admin")
	adminAuthorized.Use(middleware.AdminJWTAuth(cfg.AdminJWTSecret))
	{
		// Dashboard 统计
		adminAuthorized.GET("/dashboard/stats", dashHandler.GetOverview)
		adminAuthorized.GET("/dashboard/trends", dashHandler.GetTrends)
		adminAuthorized.GET("/dashboard/ability-radar", dashHandler.GetAbilityRadar)

		// 认证相关
		adminAuthorized.POST("/auth/refresh", adminHandler.Refresh)
		adminAuthorized.GET("/auth/me", adminHandler.Me)
		adminAuthorized.PUT("/auth/password", adminHandler.ChangePassword)

		// 管理员管理（super_admin 专属）
		adminUsers := adminAuthorized.Group("/users")
		adminUsers.Use(middleware.RequireAdminRole(model.AdminRoleSuperAdmin))
		{
			adminUsers.GET("", adminHandler.ListAdmins)
			adminUsers.POST("", adminHandler.CreateAdmin)
			adminUsers.PUT("/:id", adminHandler.UpdateAdmin)
			adminUsers.DELETE("/:id", adminHandler.DeleteAdmin)
		}

		// 系统日志
		adminAuthorized.GET("/system/logs", adminHandler.ListOperationLogs)

		// 模块 C：用户与家庭管理
		familyAdminHandler := handler.NewAdminFamilyHandler(service.NewAdminFamilyService(database.DB, adminService))
		adminAuthorized.GET("/families", familyAdminHandler.ListFamilies)
		adminAuthorized.GET("/families/:id", familyAdminHandler.GetFamilyDetail)
		adminAuthorized.PUT("/families/:id/status", familyAdminHandler.ToggleFamilyStatus)
		adminAuthorized.GET("/children", familyAdminHandler.ListChildren)
		adminAuthorized.GET("/children/:id", familyAdminHandler.GetChildDetail)
		adminAuthorized.GET("/parents", familyAdminHandler.ListParents)

		// 公益捐赠管理（取件确认 → 发放积分）
		donationAdminHandler := handler.NewAdminDonationHandler()
		adminAuthorized.GET("/donations", donationAdminHandler.List)
		adminAuthorized.POST("/donations/:id/confirm-received", donationAdminHandler.ConfirmReceived)
		adminAuthorized.POST("/donations/:id/complete", donationAdminHandler.Complete)
	}

	// 初始化超级管理员（空库时自动创建）
	if err := adminService.SeedInitialSuperAdmin(cfg.AdminInitPassword); err != nil {
		log.Fatalf("初始化超级管理员失败: %v", err)
	}

	log.Printf("服务启动于端口 %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("启动服务失败: %v", err)
	}
}
