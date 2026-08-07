package util

import (
	"errors"
	"fmt"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

var allowedImageExts = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".gif":  true,
	".webp": true,
	".heic": true,
	".heif": true,
	".avif": true,
	".bmp":  true,
	".svg":  true,
}

var allowedVideoExts = map[string]bool{
	".mp4":  true,
	".mov":  true,
	".webm": true,
	".m4v":  true,
	".3gp":  true,
	".mkv":  true,
	".avi":  true,
}

const maxImageSize = 10 * 1024 * 1024  // 10MB
const maxVideoSize = 80 * 1024 * 1024  // 80MB，约覆盖手机 60 秒录像

// SaveUploadedImage 保存上传的图片（兼容旧调用）
func SaveUploadedImage(file *multipart.FileHeader, uploadDir string) (string, error) {
	return SaveUploadedMedia(file, uploadDir)
}

// SaveUploadedMedia 保存图片或视频，返回可访问路径（如 /uploads/xxx.mp4）
func SaveUploadedMedia(file *multipart.FileHeader, uploadDir string) (string, error) {
	ext := strings.ToLower(filepath.Ext(file.Filename))
	isImage := allowedImageExts[ext]
	isVideo := allowedVideoExts[ext]
	if !isImage && !isVideo {
		return "", fmt.Errorf("不支持的文件格式: %s（请上传图片或视频）", ext)
	}

	maxSize := int64(maxImageSize)
	if isVideo {
		maxSize = maxVideoSize
	}
	if file.Size > maxSize {
		if isVideo {
			return "", errors.New("视频大小不能超过 80MB（建议时长不超过 60 秒）")
		}
		return "", errors.New("图片大小不能超过 10MB")
	}

	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			return "", err
		}
	}

	randomName := uuid.New().String() + ext
	destPath := filepath.Join(uploadDir, randomName)

	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	dst, err := os.Create(destPath)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	if _, err := dst.ReadFrom(src); err != nil {
		return "", err
	}

	return "/uploads/" + randomName, nil
}

// IsVideoURL 根据 URL 扩展名判断是否为视频
func IsVideoURL(url string) bool {
	ext := strings.ToLower(filepath.Ext(strings.Split(url, "?")[0]))
	return allowedVideoExts[ext]
}
