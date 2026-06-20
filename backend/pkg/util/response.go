package util

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

const (
	CodeSuccess = 0
	CodeError   = 1
)

func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    CodeSuccess,
		Message: "success",
		Data:    data,
	})
}

func Fail(c *gin.Context, httpCode int, message string) {
	c.JSON(httpCode, Response{
		Code:    CodeError,
		Message: message,
	})
}

func FailBadRequest(c *gin.Context, message string) {
	Fail(c, http.StatusBadRequest, message)
}

func FailUnauthorized(c *gin.Context, message string) {
	Fail(c, http.StatusUnauthorized, message)
}

func FailForbidden(c *gin.Context, message string) {
	Fail(c, http.StatusForbidden, message)
}

func FailNotFound(c *gin.Context, message string) {
	Fail(c, http.StatusNotFound, message)
}

func FailInternal(c *gin.Context, message string) {
	Fail(c, http.StatusInternalServerError, message)
}
