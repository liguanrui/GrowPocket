package util

import (
	"testing"
	"time"
)

const testSecret = "test-secret-123"

func TestGenerateJWT(t *testing.T) {
	token, err := GenerateJWT(1, 10, "小明", testSecret, 24)
	if err != nil {
		t.Fatalf("生成 JWT 失败: %v", err)
	}
	if token == "" {
		t.Fatal("JWT token 为空")
	}
}

func TestParseJWT_Valid(t *testing.T) {
	token, err := GenerateJWT(42, 99, "小明", testSecret, 24)
	if err != nil {
		t.Fatalf("生成 JWT 失败: %v", err)
	}

	claims, err := ParseJWT(token, testSecret)
	if err != nil {
		t.Fatalf("解析 JWT 失败: %v", err)
	}
	if claims.UserID != 42 {
		t.Errorf("UserID 不匹配: got %d want 42", claims.UserID)
	}
	if claims.FamilyID != 99 {
		t.Errorf("FamilyID 不匹配: got %d want 99", claims.FamilyID)
	}
	if claims.Nickname != "小明" {
		t.Errorf("Nickname 不匹配: got %s want 小明", claims.Nickname)
	}
	if claims.ExpiresAt == nil {
		t.Error("ExpiresAt 为空")
	}
	// 过期时间应约等于 24 小时后
	expected := time.Now().Add(24 * time.Hour)
	diff := expected.Sub(claims.ExpiresAt.Time)
	if diff < -time.Minute || diff > time.Minute {
		t.Errorf("过期时间偏差过大: %v", diff)
	}
}

func TestParseJWT_WrongSecret(t *testing.T) {
	token, err := GenerateJWT(1, 1, "小明", testSecret, 24)
	if err != nil {
		t.Fatalf("生成 JWT 失败: %v", err)
	}

	_, err = ParseJWT(token, "wrong-secret")
	if err == nil {
		t.Fatal("使用错误密钥应该返回错误")
	}
}

func TestParseJWT_Expired(t *testing.T) {
	// 生成一个已经过期的 token（durationHour 为负数）
	token, err := GenerateJWT(1, 1, "小明", testSecret, -1)
	if err != nil {
		t.Fatalf("生成 JWT 失败: %v", err)
	}

	_, err = ParseJWT(token, testSecret)
	if err == nil {
		t.Fatal("过期 token 解析应该返回错误")
	}
}

func TestParseJWT_Forged(t *testing.T) {
	// 伪造一个随机字符串
	forged := "this.is.not.a.valid.jwt.token.at.all"
	_, err := ParseJWT(forged, testSecret)
	if err == nil {
		t.Fatal("伪造 token 解析应该返回错误")
	}
}
