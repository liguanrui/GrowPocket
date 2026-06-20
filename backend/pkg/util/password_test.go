package util

import (
	"testing"
)

func TestHashPassword_NotEmpty(t *testing.T) {
	hashed, err := HashPassword("my-secret-password")
	if err != nil {
		t.Fatalf("哈希密码失败: %v", err)
	}
	if hashed == "" {
		t.Fatal("哈希后字符串为空")
	}
	if hashed == "my-secret-password" {
		t.Fatal("哈希后字符串未加密")
	}
}

func TestCheckPassword_Correct(t *testing.T) {
	password := "hello-world-123"
	hashed, err := HashPassword(password)
	if err != nil {
		t.Fatalf("哈希密码失败: %v", err)
	}

	if !CheckPassword(hashed, password) {
		t.Error("正确密码校验返回 false")
	}
}

func TestCheckPassword_Wrong(t *testing.T) {
	hashed, err := HashPassword("correct-password")
	if err != nil {
		t.Fatalf("哈希密码失败: %v", err)
	}

	if CheckPassword(hashed, "wrong-password") {
		t.Error("错误密码校验不应返回 true")
	}
}

func TestHashPassword_DifferentResults(t *testing.T) {
	// bcrypt 每次哈希都会生成不同的 salt，所以相同密码多次哈希结果不同
	hashed1, err := HashPassword("same-password")
	if err != nil {
		t.Fatalf("哈希密码失败: %v", err)
	}

	hashed2, err := HashPassword("same-password")
	if err != nil {
		t.Fatalf("哈希密码失败: %v", err)
	}

	if hashed1 == hashed2 {
		t.Error("同一密码两次哈希结果不应相同")
	}

	// 两个哈希值都能正确校验原密码
	if !CheckPassword(hashed1, "same-password") {
		t.Error("hashed1 无法校验原密码")
	}
	if !CheckPassword(hashed2, "same-password") {
		t.Error("hashed2 无法校验原密码")
	}
}
