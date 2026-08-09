package service

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
)

// visionSidecar 图片画面描述缓存（.vision.json），用于：
// 1) 多模态识图成功后落盘，避免重复调用
// 2) 文本模型（如 DeepSeek）不支持识图时，用已有画面描述润色旁白
type visionSidecar struct {
	Description string `json:"description"`
	Caption     string `json:"caption,omitempty"`
	Source      string `json:"source,omitempty"` // vision | manual | polish
}

func uploadDir() string {
	if d := os.Getenv("UPLOAD_DIR"); d != "" {
		return d
	}
	return "./uploads"
}

func resolveUploadFile(photoURL string) string {
	u := strings.TrimSpace(photoURL)
	if u == "" {
		return ""
	}
	// /uploads/xxx.jpg 或完整 URL 的 path
	if i := strings.Index(u, "/uploads/"); i >= 0 {
		u = u[i:]
	}
	u = strings.TrimPrefix(u, "/uploads/")
	u = strings.TrimPrefix(u, "uploads/")
	if u == "" || strings.Contains(u, "..") {
		return ""
	}
	return filepath.Join(uploadDir(), filepath.Base(u))
}

func visionSidecarPath(imagePath string) string {
	return imagePath + ".vision.json"
}

func readVisionSidecar(imagePath string) *visionSidecar {
	data, err := os.ReadFile(visionSidecarPath(imagePath))
	if err != nil {
		return nil
	}
	var sc visionSidecar
	if json.Unmarshal(data, &sc) != nil {
		return nil
	}
	if strings.TrimSpace(sc.Description) == "" && strings.TrimSpace(sc.Caption) == "" {
		return nil
	}
	return &sc
}

func writeVisionSidecar(imagePath string, sc visionSidecar) {
	data, err := json.MarshalIndent(sc, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(visionSidecarPath(imagePath), data, 0644)
}

// generatePhotoCaptionsFromImages 按相册顺序为每张照片生成短旁白（以画面内容为准，不以任务标题为准）。
// 优先级：多模态识图 → 已有 sidecar 画面描述 + 文本润色 → 通用兜底。
func (s *GrowthStoryService) generatePhotoCaptionsFromImages(photoURLs []string, taskHints []string) []string {
	out := make([]string, 0, len(photoURLs))
	for i, url := range photoURLs {
		hint := ""
		if i < len(taskHints) {
			hint = taskHints[i]
		}
		cap := s.captionOnePhoto(url, hint)
		out = append(out, cap)
	}
	return out
}

func (s *GrowthStoryService) captionOnePhoto(photoURL, taskHint string) string {
	path := resolveUploadFile(photoURL)
	if path == "" {
		return "定格这一刻的小小闪光"
	}
	if _, err := os.Stat(path); err != nil {
		log.Printf("[GrowthStory] 照片文件不存在 url=%s path=%s", photoURL, path)
		return "定格这一刻的小小闪光"
	}

	// 1) 多模态识图（真正看图）
	if s.aiService != nil {
		if cap, err := s.aiService.CaptionImage(path, "", taskHint); err == nil && strings.TrimSpace(cap) != "" {
			writeVisionSidecar(path, visionSidecar{Description: cap, Caption: cap, Source: "vision"})
			log.Printf("[GrowthStory] 识图配文成功 file=%s caption=%s", filepath.Base(path), cap)
			return cap
		} else if err != nil {
			log.Printf("[GrowthStory] 识图失败 file=%s: %v（将尝试画面描述润色）", filepath.Base(path), err)
		}
	}

	// 2) sidecar 画面描述 → 文本模型润色成旁白
	if sc := readVisionSidecar(path); sc != nil {
		if strings.TrimSpace(sc.Caption) != "" && sc.Source == "vision" {
			return truncateRunes(sc.Caption, 28)
		}
		desc := strings.TrimSpace(sc.Description)
		if desc != "" {
			if polished := s.polishCaptionFromDescription(desc); polished != "" {
				sc.Caption = polished
				sc.Source = "polish"
				writeVisionSidecar(path, *sc)
				return polished
			}
			// 润色失败时，直接截断描述当旁白
			return truncateRunes(desc, 28)
		}
	}

	// 3) 兜底：绝不用任务标题冒充画面（避免「洗盘子配文却写舀豆豆」）
	return "定格这一刻的小小闪光"
}

// polishCaptionFromDescription 用文本模型把「画面描述」压成短旁白（不看图，但至少基于描述而非任务名）
func (s *GrowthStoryService) polishCaptionFromDescription(description string) string {
	if s.aiService == nil || strings.TrimSpace(description) == "" {
		return ""
	}
	prompt := "你是儿童成长记录师。下面是一张照片的画面描述，请改写成一句给孩子听的中文旁白。\n" +
		"要求：12～24字；口语温暖；只保留画面里有的内容；不要出现任务名、积分、日期。\n" +
		"只返回这一句旁白。\n\n画面描述：\n" + description
	reply, err := s.aiService.Chat(prompt, nil, "请输出旁白")
	if err != nil || strings.TrimSpace(reply) == "" {
		return ""
	}
	line := strings.TrimSpace(reply)
	line = strings.Trim(line, "\"“”'")
	if i := strings.IndexAny(line, "\n。"); i > 0 && i < 40 {
		// 若多句，取首句（保留句号前内容）
		if strings.Contains(line[:i+1], "。") {
			line = line[:i+1]
		}
	}
	line = strings.ReplaceAll(line, "\n", "")
	return truncateRunes(line, 28)
}

// applyVisionCaptionsToYearbook 用识图旁白覆盖 yearbook.photo_captions（权威来源）
func applyVisionCaptionsToYearbook(yearbookJSON string, captions []string) string {
	if len(captions) == 0 {
		return yearbookJSON
	}
	var y aiYearbookCopy
	if yearbookJSON != "" {
		_ = json.Unmarshal([]byte(yearbookJSON), &y)
	}
	y.PhotoCaptions = captions
	if strings.TrimSpace(y.Photos) == "" {
		y.Photos = "这些画面，把成长留住了"
	}
	return marshalYearbookCopy(normalizeYearbookCopy(&y))
}
