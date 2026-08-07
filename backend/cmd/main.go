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

	// 为已有家庭补齐默认任务模板
	if err := service.SeedAllFamiliesTemplates(); err != nil {
		log.Printf("补齐任务模板失败: %v", err)
	}

	// 初始化 AI 服务
	aiService := service.NewAIService(cfg.AIAPIKey, cfg.AIModel, cfg.AIBaseURL)

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
		authorized.PUT("/family/name", childrenHandler.UpdateFamilyName)

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

		// 能力维度（v3）
		abilityHandler := handler.NewAbilityHandler()
		authorized.GET("/abilities", abilityHandler.ListDimensions)
		authorized.GET("/abilities/scores/:child_id", abilityHandler.GetChildScores)
		authorized.GET("/abilities/growth-index/:child_id", abilityHandler.GetGrowthIndex)

		// 成长周期与目标（v3）
		growthCycleHandler := handler.NewGrowthCycleHandler()
		authorized.POST("/growth-cycles", growthCycleHandler.CreateCycle)
		authorized.PUT("/growth-cycles/:id", growthCycleHandler.UpdateCycle)
		authorized.POST("/growth-cycles/:id/goals", growthCycleHandler.SetGoal)
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

		// AI 助理对话（v3）
		chatHandler := handler.NewChatHandler(service.NewChatService(aiService))
		authorized.POST("/chat/message", chatHandler.SendMessage)
		authorized.POST("/chat/message/confirm", chatHandler.ConfirmMessage)
		authorized.GET("/chat/history/:child_id", chatHandler.GetHistory)
		authorized.GET("/chat/sessions", chatHandler.ListSessions)
		authorized.POST("/chat/sessions", chatHandler.CreateSession)
		authorized.GET("/chat/sessions/search", chatHandler.SearchSessions)
		authorized.GET("/chat/sessions/:id/messages", chatHandler.GetSessionMessages)

		// 成长故事（v3）
		growthStoryHandler := handler.NewGrowthStoryHandler(service.NewGrowthStoryService(aiService))
		authorized.GET("/growth-stories", growthStoryHandler.ListStories)
		authorized.POST("/growth-stories/:cycle_id", growthStoryHandler.GenerateStory)
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

		// 调试接口（仅开发环境，用于时间穿越测试）
		if os.Getenv("APP_ENV") == "development" {
			debugHandler := handler.NewDebugHandler(taskGenService)
			authorized.POST("/debug/advance-time", debugHandler.AdvanceTime)
			authorized.POST("/debug/reset-time", debugHandler.ResetTime)
			authorized.GET("/debug/time", debugHandler.GetTime)
		}
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
