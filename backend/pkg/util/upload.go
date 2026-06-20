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
}

const maxFileSize = 5 * 1024 * 1024 // 5MB

// SaveUploadedImage 保存上传的图片到 uploadDir，返回可访问的 URL 路径（如 /uploads/xxx.jpg）
func SaveUploadedImage(file *multipart.FileHeader, uploadDir string) (string, error) {
	if file.Size > maxFileSize {
		return "", errors.New("图片大小不能超过 5MB")
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedImageExts[ext] {
		return "", fmt.Errorf("不支持的图片格式: %s", ext)
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
