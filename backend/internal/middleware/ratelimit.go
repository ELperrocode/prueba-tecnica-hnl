package middleware

import (
	"net/http"
	"sync"
	"time"
)

type ipBucket struct {
	times []time.Time
}

type rateLimiter struct {
	mu     sync.Mutex
	store  map[string]*ipBucket
	limit  int
	window time.Duration
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		store:  make(map[string]*ipBucket),
		limit:  limit,
		window: window,
	}
	// Background cleanup to avoid unbounded memory growth
	go func() {
		ticker := time.NewTicker(window * 2)
		for range ticker.C {
			rl.mu.Lock()
			cutoff := time.Now().Add(-window)
			for ip, bucket := range rl.store {
				fresh := bucket.times[:0]
				for _, t := range bucket.times {
					if t.After(cutoff) {
						fresh = append(fresh, t)
					}
				}
				if len(fresh) == 0 {
					delete(rl.store, ip)
				} else {
					bucket.times = fresh
				}
			}
			rl.mu.Unlock()
		}
	}()
	return rl
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	bucket, ok := rl.store[ip]
	if !ok {
		bucket = &ipBucket{}
		rl.store[ip] = bucket
	}

	// Evict old entries
	fresh := bucket.times[:0]
	for _, t := range bucket.times {
		if t.After(cutoff) {
			fresh = append(fresh, t)
		}
	}
	bucket.times = fresh

	if len(bucket.times) >= rl.limit {
		return false
	}

	bucket.times = append(bucket.times, now)
	return true
}

// RateLimit returns a chi-compatible middleware that limits requests per IP.
// limit = max requests allowed within the window duration.
func RateLimit(limit int, window time.Duration) func(http.Handler) http.Handler {
	rl := newRateLimiter(limit, window)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Prefer X-Real-IP set by nginx/proxy, fallback to RemoteAddr
			ip := r.Header.Get("X-Real-IP")
			if ip == "" {
				ip = r.RemoteAddr
			}

			if !rl.allow(ip) {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", window.String())
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"too many requests, please slow down"}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
