// Package envloader 提供轻量级 .env 文件加载能力
// 不依赖第三方库，仅支持基本的 KEY=VALUE 格式
package envloader

import (
	"bufio"
	"os"
	"strings"
)

// Load 从指定路径加载 .env 文件到环境变量
// 已存在的环境变量不会被覆盖
// 文件不存在时返回错误，调用方可自行处理
func Load(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		// 跳过空行和注释
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		// 解析 KEY=VALUE
		idx := strings.Index(line, "=")
		if idx <= 0 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		val := strings.TrimSpace(line[idx+1:])
		// 去除两端引号（支持 KEY="value" 和 KEY='value'）
		if len(val) >= 2 {
			if (val[0] == '"' && val[len(val)-1] == '"') ||
				(val[0] == '\'' && val[len(val)-1] == '\'') {
				val = val[1 : len(val)-1]
			}
		}
		// 不覆盖已存在的环境变量
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, val)
		}
	}
	return scanner.Err()
}
