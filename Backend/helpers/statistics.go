package helpers

import (
	"fmt"
	"math"
)

// PercentageResult holds the formatted percentage string and the associated UI color class.
type PercentageResult struct {
	Change   string
	ChangeBg string
}

// CalculatePercentageChange calculates the percentage change between today and yesterday.
// Edge cases:
// - yesterday == 0 && today > 0 -> 100%
// - yesterday == 0 && today == 0 -> 0%
// Colors:
// - positive -> text-emerald-500
// - negative -> text-red-500
// - zero/neutral -> text-slate-400
func CalculatePercentageChange(todayCount, yesterdayCount int) PercentageResult {
	if yesterdayCount == 0 {
		if todayCount > 0 {
			return PercentageResult{Change: "+100%", ChangeBg: "text-emerald-500"}
		}
		return PercentageResult{Change: "0%", ChangeBg: "text-slate-400"}
	}

	change := float64(todayCount-yesterdayCount) / float64(yesterdayCount) * 100

	// Round to 1 decimal place if not whole number, otherwise 0 decimal places
	roundedChange := math.Round(change*10) / 10

	var changeStr, changeBg string
	if roundedChange > 0 {
		changeStr = fmt.Sprintf("+%v%%", roundedChange)
		changeBg = "text-emerald-500"
	} else if roundedChange < 0 {
		changeStr = fmt.Sprintf("%v%%", roundedChange)
		changeBg = "text-red-500"
	} else {
		changeStr = "0%"
		changeBg = "text-slate-400"
	}

	return PercentageResult{
		Change:   changeStr,
		ChangeBg: changeBg,
	}
}
