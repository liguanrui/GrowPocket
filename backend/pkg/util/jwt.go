package util

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type JWTClaims struct {
	UserID    uint   `json:"user_id"`
	FamilyID  uint   `json:"family_id"`
	Nickname  string `json:"nickname"`
	Role      string `json:"role"`
	jwt.RegisteredClaims
}

func GenerateJWT(userID, familyID uint, nickname, role, secret string, durationHour int) (string, error) {
	claims := JWTClaims{
		UserID:   userID,
		FamilyID: familyID,
		Nickname: nickname,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(durationHour) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "growpocket",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseJWT(tokenStr, secret string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

type AdminJWTClaims struct {
	AdminID  uint   `json:"admin_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func GenerateAdminJWT(adminID uint, username, role, secret string, durationHour int) (string, error) {
	claims := AdminJWTClaims{
		AdminID:  adminID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(durationHour) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "growpocket-admin",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseAdminJWT(tokenStr, secret string) (*AdminJWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &AdminJWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*AdminJWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid admin token")
	}
	return claims, nil
}
