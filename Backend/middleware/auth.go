package middleware

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/FamilyJewelsRuined/mini-siem-be/helpers"
	"github.com/golang-jwt/jwt/v5"
)

// ────────────────────────────────────────────────────────────
// Context key used to store the authenticated admin_id
// ────────────────────────────────────────────────────────────

type ctxKey string

const adminIDKey ctxKey = "admin_id"

// jwtSecret used to sign & verify tokens.
// Falls back to a default for development; MUST be overridden in production
// via the JWT_SECRET environment variable.
var jwtSecret = []byte(func() string {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return s
	}
	return "xr-security-dev-secret-change-me"
}())

// ────────────────────────────────────────────────────────────
// Token Generation (called by login / register handlers)
// ────────────────────────────────────────────────────────────

// GenerateJWT creates a signed HS256 token containing the admin_id claim.
// The token expires after 24 hours.
func GenerateJWT(adminID int) (string, error) {
	claims := jwt.MapClaims{
		"admin_id": adminID,
		"iat":      time.Now().Unix(),
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// ────────────────────────────────────────────────────────────
// Auth Middleware — validates JWT and injects admin_id into ctx
// ────────────────────────────────────────────────────────────

// RequireAuth is an HTTP middleware that:
//  1. Reads the "Authorization: Bearer <token>" header.
//  2. Validates the JWT signature & expiry.
//  3. Extracts admin_id from claims.
//  4. Stores admin_id in request context so handlers can call GetAdminID(r).
//
// If the token is missing or invalid the request is rejected with 401.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Preflight (CORS) requests must pass through unauthenticated
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			helpers.WriteJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "missing or invalid Authorization header",
			})
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			log.Printf("⚠️  JWT validation failed: %v", err)
			helpers.WriteJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "invalid or expired token",
			})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			helpers.WriteJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "invalid token claims",
			})
			return
		}

		// admin_id may be float64 (JSON number) — convert to string for ctx
		adminIDRaw, exists := claims["admin_id"]
		if !exists {
			helpers.WriteJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "token missing admin_id claim",
			})
			return
		}

		var adminIDStr string
		switch v := adminIDRaw.(type) {
		case float64:
			adminIDStr = strconv.Itoa(int(v))
		case string:
			adminIDStr = v
		default:
			adminIDStr = fmt.Sprintf("%v", v)
		}

		// Inject admin_id into context
		ctx := context.WithValue(r.Context(), adminIDKey, adminIDStr)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ────────────────────────────────────────────────────────────
// Helper — extract admin_id from a request that passed RequireAuth
// ────────────────────────────────────────────────────────────

// GetAdminID retrieves the authenticated admin_id string from the
// request context.  Returns "" if not present (should not happen
// behind RequireAuth).
func GetAdminID(r *http.Request) string {
	v, _ := r.Context().Value(adminIDKey).(string)
	return v
}
