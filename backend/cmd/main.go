package main

import (
	"growpocket/internal/config"
	"growpocket/internal/database"
	"growpocket/internal/handler"
	"growpocket/internal/middleware"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	// 初始化数据库
	database.Init(cfg.DBPath)
	log.Printf("数据库初始化完成: %s", cfg.DBPath)

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
	}

	log.Printf("服务启动于端口 %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("启动服务失败: %v", err)
	}
}
