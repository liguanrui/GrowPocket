package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"time"

	"github.com/gin-gonic/gin"
)

type ChildrenHandler struct {
	service *service.ChildService
}

func NewChildrenHandler() *ChildrenHandler {
	return &ChildrenHandler{service: service.NewChildService()}
}

type addChildReq struct {
	Nickname        string  `json:"nickname" binding:"required"`
	Gender          *int    `json:"gender"`
	Birthday        *string `json:"birthday"` // RFC3339 或 YYYY-MM-DD 字符串
	Grade           *int    `json:"grade"`
	GradeOverridden *bool   `json:"grade_overridden"`
	Age             *int    `json:"age"`
	Hobbies         string  `json:"hobbies"`
}

// parseBirthday 兼容 "2006-01-02" 与 RFC3339 两种前端常见格式
func parseBirthday(s string) (*time.Time, error) {
	if s == "" {
		return nil, nil
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		// 日期归一到当地时区 12:00，避免跨时区差一天
		tt := time.Date(t.Year(), t.Month(), t.Day(), 12, 0, 0, 0, time.Local)
		return &tt, nil
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (h *ChildrenHandler) AddChild(c *gin.Context) {
	var req addChildReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	var birthday *time.Time
	if req.Birthday != nil {
		t, err := parseBirthday(*req.Birthday)
		if err != nil {
			util.FailBadRequest(c, "生日格式不正确，支持 YYYY-MM-DD")
			return
		}
		birthday = t
	}

	child, err := h.service.AddChild(service.AddChildInput{
		FamilyID:        middleware.GetFamilyID(c),
		Nickname:        req.Nickname,
		Gender:          req.Gender,
		Birthday:        birthday,
		Grade:           req.Grade,
		GradeOverridden: req.GradeOverridden,
		Age:             req.Age,
		Hobbies:         req.Hobbies,
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, enrichChild(child))
}

func (h *ChildrenHandler) ListChildren(c *gin.Context) {
	children, err := h.service.ListChildren(middleware.GetFamilyID(c))
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	enriched := make([]map[string]interface{}, 0, len(children))
	for i := range children {
		enriched = append(enriched, enrichChild(&children[i]))
	}
	util.OK(c, enriched)
}

func (h *ChildrenHandler) GetChild(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	child, err := h.service.GetChild(id, middleware.GetFamilyID(c))
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}

	util.OK(c, enrichChild(child))
}

type updateChildReq struct {
	Nickname        *string `json:"nickname"`
	Gender          *int    `json:"gender"`
	Birthday        *string `json:"birthday"`
	Avatar          *string `json:"avatar"`
	Grade           *int    `json:"grade"`
	GradeOverridden *bool   `json:"grade_overridden"`
	Age             *int    `json:"age"`
	Hobbies         *string `json:"hobbies"`
}

func (h *ChildrenHandler) UpdateChild(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	var req updateChildReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	var birthday *time.Time
	if req.Birthday != nil {
		t, err := parseBirthday(*req.Birthday)
		if err != nil {
			util.FailBadRequest(c, "生日格式不正确，支持 YYYY-MM-DD")
			return
		}
		birthday = t
	}

	child, err := h.service.UpdateChild(id, middleware.GetFamilyID(c), service.UpdateChildInput{
		Nickname:        req.Nickname,
		Gender:          req.Gender,
		Birthday:        birthday,
		Avatar:          req.Avatar,
		Grade:           req.Grade,
		GradeOverridden: req.GradeOverridden,
		Age:             req.Age,
		Hobbies:         req.Hobbies,
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, enrichChild(child))
}

func (h *ChildrenHandler) DeleteChild(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}
	if err := h.service.DeleteChild(id, middleware.GetFamilyID(c)); err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, nil)
}

type updateFamilyNameReq struct {
	Name string `json:"name" binding:"required"`
}

func (h *ChildrenHandler) UpdateFamilyName(c *gin.Context) {
	var req updateFamilyNameReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}
	family, err := h.service.UpdateFamilyName(middleware.GetFamilyID(c), req.Name)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, gin.H{"id": family.ID, "name": family.Name, "share_code": family.ShareCode})
}

func (h *ChildrenHandler) GetFamily(c *gin.Context) {
	info, err := h.service.GetFamily(middleware.GetFamilyID(c))
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, info)
}

func (h *ChildrenHandler) RegenerateShareCode(c *gin.Context) {
	info, err := h.service.RegenerateShareCode(middleware.GetFamilyID(c))
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, info)
}

// enrichChild 在 User 实体基础上追加 derived_age / derived_grade / grade_overridden，前端直接用
func enrichChild(child *model.User) map[string]interface{} {
	grade, overridden := service.ResolveGrade(child)
	age := service.ResolveAge(child)

	m := map[string]interface{}{
		"id":                  child.ID,
		"family_id":           child.FamilyID,
		"role":                child.Role,
		"nickname":            child.Nickname,
		"avatar":              child.Avatar,
		"gender":              child.Gender,
		"birthday":            child.Birthday,
		"grade":               child.Grade,
		"grade_overridden":    (child.GradeOverridden || overridden),
		"age":                 child.Age,
		"hobbies":             child.Hobbies,
		"balance":             child.Balance,
		"created_at":          child.CreatedAt,
		"updated_at":          child.UpdatedAt,
		"derived_age":         age,
		"derived_grade":       grade,
	}
	// 生日当天彩蛋标志（纯信息位，前端自由决定是否显示）
	if child.Birthday != nil {
		now := time.Now()
		if now.Month() == child.Birthday.Month() && now.Day() == child.Birthday.Day() {
			m["is_birthday_today"] = true
		} else {
			m["is_birthday_today"] = false
		}
	}

	// V3.1：追加各能力维度的派生字段（focus_level / cap / mastery_ready）
	m["ability_scores"] = buildChildAbilityScores(child, grade)

	return m
}

// buildChildAbilityScores 构造孩子的能力维度派生信息
// 每个维度追加 focus_level / cap / mastery_ready（score>=85 即视为可冲刺精通）
func buildChildAbilityScores(child *model.User, grade int) []map[string]interface{} {
	abilitySvc := service.NewAbilityService()
	dims, err := abilitySvc.ListDimensions()
	if err != nil {
		return []map[string]interface{}{}
	}
	scores, _ := abilitySvc.GetChildScores(child.ID, child.FamilyID)
	scoreMap := make(map[uint]int, len(scores))
	for _, s := range scores {
		scoreMap[s.DimensionID] = s.Score
	}
	result := make([]map[string]interface{}, 0, len(dims))
	for _, d := range dims {
		guide, _ := abilitySvc.GetGradeGuide(grade, d.ID)
		score := scoreMap[d.ID]
		result = append(result, map[string]interface{}{
			"dimension_id":    d.ID,
			"dimension_code":  d.Code,
			"dimension_name":  d.Name,
			"dimension_color": d.Color,
			"score":           score,
			"focus_level":     guide.FocusLevel,
			"cap":             guide.Cap,
			"mastery_ready":   score >= 85,
		})
	}
	return result
}

// 辅助函数：解析 uint ID
func parseUintID(s string) (uint, error) {
	if s == "" {
		return 0, nil
	}
	var id uint
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return 0, nil
		}
		id = id*10 + uint(ch-'0')
	}
	return id, nil
}
