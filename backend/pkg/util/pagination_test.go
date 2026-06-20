package util

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func buildGinContext(url string) *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", url, nil)
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	return c
}

func TestGetPagination_Default(t *testing.T) {
	cases := []struct {
		name     string
		url      string
		wantPage int
		wantSize int
	}{
		{"无 query 参数", "/test", 1, 20},
		{"仅空值", "/test?page=&page_size=", 1, 20},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := buildGinContext(tc.url)
			p := GetPagination(c)
			if p.Page != tc.wantPage {
				t.Errorf("Page got %d want %d", p.Page, tc.wantPage)
			}
			if p.PageSize != tc.wantSize {
				t.Errorf("PageSize got %d want %d", p.PageSize, tc.wantSize)
			}
		})
	}
}

func TestGetPagination_ValidParams(t *testing.T) {
	cases := []struct {
		name     string
		url      string
		wantPage int
		wantSize int
	}{
		{"合法值", "/test?page=3&page_size=50", 3, 50},
		{"page 为 1", "/test?page=1&page_size=30", 1, 30},
		{"pageSize 边界 100", "/test?page=2&page_size=100", 2, 100},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := buildGinContext(tc.url)
			p := GetPagination(c)
			if p.Page != tc.wantPage {
				t.Errorf("Page got %d want %d", p.Page, tc.wantPage)
			}
			if p.PageSize != tc.wantSize {
				t.Errorf("PageSize got %d want %d", p.PageSize, tc.wantSize)
			}
		})
	}
}

func TestGetPagination_PageCorrection(t *testing.T) {
	cases := []struct {
		name string
		url  string
		want int
	}{
		{"page = 0", "/test?page=0", 1},
		{"page = -1", "/test?page=-1", 1},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := buildGinContext(tc.url)
			p := GetPagination(c)
			if p.Page != tc.want {
				t.Errorf("Page got %d want %d", p.Page, tc.want)
			}
		})
	}
}

func TestGetPagination_PageSizeCorrection(t *testing.T) {
	cases := []struct {
		name string
		url  string
		want int
	}{
		{"pageSize = 0", "/test?page_size=0", 20},
		{"pageSize = -1", "/test?page_size=-1", 20},
		{"pageSize = 101", "/test?page_size=101", 20},
		{"pageSize = 999", "/test?page_size=999", 20},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := buildGinContext(tc.url)
			p := GetPagination(c)
			if p.PageSize != tc.want {
				t.Errorf("PageSize got %d want %d", p.PageSize, tc.want)
			}
		})
	}
}

func TestPagination_Offset(t *testing.T) {
	cases := []struct {
		name   string
		page   int
		size   int
		offset int
	}{
		{"page=1 size=20", 1, 20, 0},
		{"page=2 size=20", 2, 20, 20},
		{"page=5 size=10", 5, 10, 40},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := Pagination{Page: tc.page, PageSize: tc.size}
			if p.Offset() != tc.offset {
				t.Errorf("Offset got %d want %d", p.Offset(), tc.offset)
			}
		})
	}
}

func TestParseInt(t *testing.T) {
	cases := []struct {
		name    string
		input   string
		def     int
		want    int
	}{
		{"正常整数", "123", 5, 123},
		{"空字符串使用默认", "", 5, 5},
		{"非数字使用默认", "abc", 5, 5},
		{"带字母的混合", "12a", 0, 0},
		{"纯 0 使用默认", "0", 7, 7},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ParseInt(tc.input, tc.def)
			if got != tc.want {
				t.Errorf("ParseInt(%q, %d) got %d want %d", tc.input, tc.def, got, tc.want)
			}
		})
	}
}
