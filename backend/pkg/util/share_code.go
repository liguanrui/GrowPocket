package util

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
)

// 排除易混字符 0 O 1 I
const shareCodeCharset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// GenerateShareCode 生成 n 位家庭分享码
func GenerateShareCode(n int) (string, error) {
	if n <= 0 {
		n = 8
	}
	var b strings.Builder
	b.Grow(n)
	max := big.NewInt(int64(len(shareCodeCharset)))
	for i := 0; i < n; i++ {
		idx, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", fmt.Errorf("生成分享码失败: %w", err)
		}
		b.WriteByte(shareCodeCharset[idx.Int64()])
	}
	return b.String(), nil
}

// NormalizeShareCode 规范化用户输入的分享码
func NormalizeShareCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}
