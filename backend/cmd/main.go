package main

import (
	"growpocket/internal/config"
	"growpocket/internal/database"
	"growpocket/internal/handler"
	"growpocket/internal/middleware"
	"growpocket/internal/service"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
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

		// 勋章成就
		achievementHandler := handler.NewAchievementHandler()
		authorized.GET("/achievements", achievementHandler.GetAchievements)
		authorized.POST("/achievements/check", achievementHandler.CheckAndUnlock)
		authorized.GET("/achievements/awards", achievementHandler.GetAchievementAwards)
		authorized.POST("/achievements", achievementHandler.CreateAchievement)
		authorized.PUT("/achievements/:id", achievementHandler.UpdateAchievement)
		authorized.DELETE("/achievements/:id", achievementHandler.DeleteAchievement)

		// 任务模板
		taskTemplateHandler := handler.NewTaskTemplateHandler()
		authorized.POST("/task-templates", taskTemplateHandler.CreateTemplate)
		authorized.GET("/task-templates", taskTemplateHandler.ListTemplates)
		authorized.GET("/task-templates/:id", taskTemplateHandler.GetTemplate)
		authorized.PUT("/task-templates/:id", taskTemplateHandler.UpdateTemplate)
		authorized.DELETE("/task-templates/:id", taskTemplateHandler.DeleteTemplate)
		authorized.POST("/task-templates/:id/create-task", taskTemplateHandler.CreateTaskFromTemplate)

		// 社区 - 分享
		communityHandler := handler.NewCommunityHandler()
		authorized.POST("/community/shares", communityHandler.CreateShare)
		authorized.GET("/community/shares", communityHandler.ListShares)
		authorized.GET("/community/shares/:id", communityHandler.GetShare)
		authorized.DELETE("/community/shares/:id", communityHandler.DeleteShare)
		authorized.POST("/community/shares/:id/like", communityHandler.AddLike)
		authorized.DELETE("/community/shares/:id/like", communityHandler.RemoveLike)
		authorized.POST("/community/shares/:id/comments", communityHandler.AddComment)
		authorized.GET("/community/shares/:id/comments", communityHandler.ListComments)

		// 社区 - 公益项目
		authorized.GET("/community/charity-projects", communityHandler.ListProjects)
		authorized.POST("/community/charity-projects/:id/join", communityHandler.JoinProject)
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
	}

	log.Printf("服务启动于端口 %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("启动服务失败: %v", err)
	}
}
