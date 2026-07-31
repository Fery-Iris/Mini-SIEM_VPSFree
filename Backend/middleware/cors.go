package middleware

import (
	"net/http"
	"os"
)

// CORSMiddleware adds CORS headers to all responses.
// Set CORS_ORIGIN env var to restrict origins in production (e.g. "https://yourdomain.vercel.app").
// Defaults to "*" for local development.
func CORSMiddleware(next http.Handler) http.Handler {
	allowedOrigin := os.Getenv("CORS_ORIGIN")
	if allowedOrigin == "" {
		allowedOrigin = "*"
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
