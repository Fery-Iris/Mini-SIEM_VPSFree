package handlers

import (
	"fmt"
	"log"
	"net/http"

	"github.com/FamilyJewelsRuined/mini-siem-be/database"
	"github.com/FamilyJewelsRuined/mini-siem-be/helpers"
	"github.com/FamilyJewelsRuined/mini-siem-be/middleware"
	"github.com/FamilyJewelsRuined/mini-siem-be/models"
)

// HandleDashboardStats returns stat cards derived from security_logs DB.
// GET /api/dashboard/stats  (admin_id extracted from JWT)
func HandleDashboardStats(store *models.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		adminID := middleware.GetAdminID(r)
		whereClause := ""
		var args []any
		if adminID != "" {
			whereClause = " WHERE admin_id = ?"
			args = []any{adminID}
		}

		// Helper function to query stats
		getCounts := func(condition string, isDistinctIP bool) (int, int, int) {
			var total, today, yesterday int
			var query string

			whereClauseCondition := condition
			var queryArgs []any
			if adminID != "" {
				whereClauseCondition += " AND admin_id = ?"
				queryArgs = append(queryArgs, adminID)
			}

			if isDistinctIP {
				query = fmt.Sprintf(`
					SELECT 
						COUNT(DISTINCT ip_address),
						COUNT(DISTINCT CASE WHEN DATE(created_at) = CURDATE() THEN ip_address END),
						COUNT(DISTINCT CASE WHEN DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN ip_address END)
					FROM security_logs 
					WHERE %s`, whereClauseCondition)
			} else {
				query = fmt.Sprintf(`
					SELECT 
						COUNT(*),
						COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END), 0),
						COALESCE(SUM(CASE WHEN DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN 1 ELSE 0 END), 0)
					FROM security_logs 
					WHERE %s`, whereClauseCondition)
			}

			database.DB.QueryRow(query, queryArgs...).Scan(&total, &today, &yesterday)
			return total, today, yesterday
		}

		// Attacks Blocked
		blockedTotal, blockedToday, blockedYesterday := getCounts("is_blocked = 1", false)
		blockedPct := helpers.CalculatePercentageChange(blockedToday, blockedYesterday)

		// Critical Threats
		criticalTotal, criticalToday, criticalYesterday := getCounts("severity = 'Critical'", false)
		criticalPct := helpers.CalculatePercentageChange(criticalToday, criticalYesterday)

		// Active Sources
		sourcesTotal, sourcesToday, sourcesYesterday := getCounts("is_blocked = 0", true)
		sourcesPct := helpers.CalculatePercentageChange(sourcesToday, sourcesYesterday)

		// Total events
		var totalLogs int
		database.DB.QueryRow("SELECT COUNT(*) FROM security_logs"+whereClause, args...).Scan(&totalLogs)

		stats := []models.StatCard{
			{
				Label: "Attacks Blocked", Value: fmt.Sprintf("%d", blockedTotal),
				Change: blockedPct.Change, Sub: "Last 24 Hours",
				Icon: "ShieldAlert", IconBg: "bg-red-50", IconColor: "text-red-400", ChangeBg: blockedPct.ChangeBg,
			},
			{
				Label: "Total Threats", Value: fmt.Sprintf("%d", criticalTotal),
				Change: criticalPct.Change, Sub: "Active Incidents",
				Icon: "AlertTriangle", IconBg: "bg-amber-50", IconColor: "text-amber-400", ChangeBg: criticalPct.ChangeBg,
			},
			{
				Label: "Active Sources", Value: fmt.Sprintf("%d", sourcesTotal),
				Change: sourcesPct.Change, Sub: "Unique IP Addresses",
				Icon: "Users", IconBg: "bg-cyan-50", IconColor: "text-cyan-500", ChangeBg: sourcesPct.ChangeBg,
			},
		}
		helpers.WriteJSON(w, http.StatusOK, map[string]any{"stats": stats, "totalEvents": totalLogs})
	}
}

// HandleDashboardLogs reads paginated logs from security_logs.
// GET /api/dashboard/logs?page=1&limit=10  (admin_id extracted from JWT)
func HandleDashboardLogs(w http.ResponseWriter, r *http.Request) {
	page := 1
	limit := 10
	fmt.Sscanf(r.URL.Query().Get("page"), "%d", &page)
	fmt.Sscanf(r.URL.Query().Get("limit"), "%d", &limit)
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}
	offset := (page - 1) * limit

	adminID := middleware.GetAdminID(r)
	whereClause := ""
	var queryArgs []any
	if adminID != "" {
		whereClause = " WHERE admin_id = ?"
		queryArgs = append(queryArgs, adminID)
	}

	query := `
		SELECT
		  id,
		  COALESCE(admin_id, ''),
		  COALESCE(user_identity, ''),
		  COALESCE(action, ''),
		  COALESCE(payload, ''),
		  COALESCE(severity, ''),
		  COALESCE(ip_address, ''),
		  COALESCE(country_code, ''),
		  COALESCE(user_agent, ''),
		  COALESCE(is_blocked, 0),
		  DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s')
		FROM security_logs` + whereClause + `
		ORDER BY created_at DESC, id DESC
		LIMIT ? OFFSET ?`
	queryArgs = append(queryArgs, limit, offset)

	rows, err := database.DB.Query(query, queryArgs...)
	if err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	var logs []models.LogEntry
	for rows.Next() {
		var e models.LogEntry
		var isBlockedInt int
		if err := rows.Scan(
			&e.ID, &e.AdminID, &e.UserIdentity, &e.Action, &e.Payload,
			&e.Severity, &e.IPAddress, &e.CountryCode, &e.UserAgent,
			&isBlockedInt, &e.CreatedAt,
		); err != nil {
			log.Printf("scan error: %v", err)
			continue
		}
		e.IsBlocked = isBlockedInt == 1
		e.Flag = helpers.CountryCodeToFlag(e.CountryCode)
		logs = append(logs, e)
	}

	var total int
	var countArgs []any
	if adminID != "" {
		countArgs = append(countArgs, adminID)
	}
	database.DB.QueryRow("SELECT COUNT(*) FROM security_logs"+whereClause, countArgs...).Scan(&total)

	helpers.WriteJSON(w, http.StatusOK, map[string]any{
		"logs":       logs,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": (total + limit - 1) / limit,
	})
}


