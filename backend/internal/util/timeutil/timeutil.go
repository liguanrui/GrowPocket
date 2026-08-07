package timeutil

import (
	"sync"
	"time"
)

var (
	mu          sync.RWMutex
	virtualTime *time.Time // nil 表示用真实时间
)

// Now 返回当前时间（虚拟模式下返回虚拟时间，否则返回 time.Now()）
func Now() time.Time {
	mu.RLock()
	defer mu.RUnlock()
	if virtualTime == nil {
		return time.Now()
	}
	return *virtualTime
}

// SetVirtualTime 设置虚拟时间
func SetVirtualTime(t time.Time) {
	mu.Lock()
	defer mu.Unlock()
	virtualTime = &t
}

// AdvanceTime 推进虚拟时间 N 天（若未设置虚拟时间，则以当前真实时间为起点）
func AdvanceTime(days int) {
	mu.Lock()
	defer mu.Unlock()
	if virtualTime == nil {
		now := time.Now()
		virtualTime = &now
	}
	next := virtualTime.AddDate(0, 0, days)
	virtualTime = &next
}

// ResetTime 清除虚拟时间，恢复为真实时间
func ResetTime() {
	mu.Lock()
	defer mu.Unlock()
	virtualTime = nil
}

// IsVirtual 是否处于虚拟时间模式
func IsVirtual() bool {
	mu.RLock()
	defer mu.RUnlock()
	return virtualTime != nil
}

// GetVirtualTime 返回当前虚拟时间（IsVirtual=false 时返回 time.Now()）
func GetVirtualTime() time.Time {
	mu.RLock()
	defer mu.RUnlock()
	if virtualTime == nil {
		return time.Now()
	}
	return *virtualTime
}

// Today 返回今天的 00:00:00（基于 Now()）
func Today() time.Time {
	now := Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
}

// Tomorrow 返回明天的 00:00:00（基于 Now()）
func Tomorrow() time.Time {
	return Today().Add(24 * time.Hour)
}
