// Hand-authored transcendence support for paypal-txns-pp-cli.
//
// PayPal's Transaction Search endpoint (/v1/reporting/transactions) rejects any
// start_date..end_date interval longer than 31 days and paginates results. The
// helpers here split an arbitrary range into <=31-day windows, walk every page
// of each window, and de-duplicate by transaction_id so the income/history
// commands can accept a single natural range like "--since 5mo".

package cli

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"

	"paypal-txns-pp-cli/internal/client"
)

// windowDays is PayPal's hard per-call limit. Consecutive windows share their
// boundary instant; de-duplication by transaction_id removes any double count.
const windowDays = 31

// maxWindows bounds the number of API round trips so a careless multi-year
// range cannot fan out unbounded. ~120 windows ≈ 10 years, well past the
// 3-year searchable horizon PayPal exposes.
const maxWindows = 120

var sinceRe = regexp.MustCompile(`^(\d+)\s*(d|w|mo|m|y)$`)

// parseSince turns relative forms (30d, 4w, 5mo, 1y) into an absolute start time
// measured back from now. "m" is treated as months for convenience.
func parseSince(now time.Time, s string) (time.Time, error) {
	m := sinceRe.FindStringSubmatch(strings.ToLower(strings.TrimSpace(s)))
	if m == nil {
		return time.Time{}, fmt.Errorf("invalid --since %q (use forms like 30d, 4w, 5mo, 1y)", s)
	}
	n, _ := strconv.Atoi(m[1])
	switch m[2] {
	case "d":
		return now.AddDate(0, 0, -n), nil
	case "w":
		return now.AddDate(0, 0, -7*n), nil
	case "mo", "m":
		return now.AddDate(0, -n, 0), nil
	case "y":
		return now.AddDate(-n, 0, 0), nil
	}
	return time.Time{}, fmt.Errorf("invalid --since unit in %q", s)
}

// resolveRange picks the [start, end] window from the flag trio. --start/--end
// (YYYY-MM-DD) win over --since; with nothing set it defaults to the last month.
// end is clamped to now (PayPal rejects future end_date) and the end day is
// included in full.
func resolveRange(now time.Time, since, startStr, endStr string) (time.Time, time.Time, error) {
	var start, end time.Time

	if endStr != "" {
		t, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(endStr), time.UTC)
		if err != nil {
			return start, end, fmt.Errorf("invalid --end %q (want YYYY-MM-DD)", endStr)
		}
		end = t.AddDate(0, 0, 1) // include the whole end day
	} else {
		end = now
	}
	if end.After(now) {
		end = now
	}

	switch {
	case startStr != "":
		t, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(startStr), time.UTC)
		if err != nil {
			return start, end, fmt.Errorf("invalid --start %q (want YYYY-MM-DD)", startStr)
		}
		start = t
	case since != "":
		t, err := parseSince(now, since)
		if err != nil {
			return start, end, err
		}
		start = t
	default:
		start = now.AddDate(0, -1, 0)
	}

	if !start.Before(end) {
		return start, end, fmt.Errorf("start (%s) must be before end (%s)", start.Format("2006-01-02"), end.Format("2006-01-02"))
	}
	return start, end, nil
}

// buildWindows slices [start, end] into contiguous <=31-day spans.
func buildWindows(start, end time.Time) [][2]time.Time {
	var out [][2]time.Time
	for cur := start; cur.Before(end) && len(out) < maxWindows; {
		wEnd := cur.AddDate(0, 0, windowDays)
		if wEnd.After(end) {
			wEnd = end
		}
		out = append(out, [2]time.Time{cur, wEnd})
		cur = wEnd
	}
	return out
}

// ppTime formats a time the way PayPal's reporting API expects: ISO-8601 with a
// numeric offset, e.g. 2026-01-01T00:00:00-0000.
func ppTime(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05-0700")
}

// ppTxnResp is the slice of the transactions response we care about.
type ppTxnResp struct {
	TransactionDetails []json.RawMessage `json:"transaction_details"`
	Page               int               `json:"page"`
	TotalPages         int               `json:"total_pages"`
	TotalItems         int               `json:"total_items"`
}

// ppTxnDetail is the typed view of one transaction_details element used for
// de-duplication and income aggregation. history keeps the raw JSON instead.
type ppTxnDetail struct {
	TransactionInfo struct {
		TransactionID  string `json:"transaction_id"`
		InitiationDate string `json:"transaction_initiation_date"`
		Status         string `json:"transaction_status"`
		Amount         struct {
			Currency string `json:"currency_code"`
			Value    string `json:"value"`
		} `json:"transaction_amount"`
	} `json:"transaction_info"`
}

// fetchAllTransactions walks every window and every page, returning the raw
// transaction_details elements de-duplicated by transaction_id, plus the number
// of windows scanned. status/fields are optional passthrough filters.
func fetchAllTransactions(ctx context.Context, c *client.Client, start, end time.Time, status, fields string, pageSize int, warn io.Writer) ([]json.RawMessage, int, error) {
	if fields == "" {
		fields = "transaction_info"
	}
	if pageSize <= 0 || pageSize > 500 {
		pageSize = 500
	}
	windows := buildWindows(start, end)
	if len(windows) >= maxWindows && warn != nil {
		fmt.Fprintf(warn, "warning: range capped at %d windows (~%d days); narrow the range for complete coverage\n", maxWindows, maxWindows*windowDays)
	}

	out := make([]json.RawMessage, 0, 128)
	seen := make(map[string]struct{})

	for _, w := range windows {
		for page := 1; ; page++ {
			params := map[string]string{
				"start_date":                     ppTime(w[0]),
				"end_date":                       ppTime(w[1]),
				"fields":                         fields,
				"balance_affecting_records_only": "Y",
				"page_size":                      strconv.Itoa(pageSize),
				"page":                           strconv.Itoa(page),
			}
			if status != "" {
				params["transaction_status"] = status
			}
			data, err := c.Get(ctx, "/v1/reporting/transactions", params)
			if err != nil {
				return nil, len(windows), err
			}
			var resp ppTxnResp
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, len(windows), fmt.Errorf("parsing transactions page %d: %w", page, err)
			}
			for _, raw := range resp.TransactionDetails {
				var d ppTxnDetail
				_ = json.Unmarshal(raw, &d)
				id := d.TransactionInfo.TransactionID
				if id != "" {
					if _, dup := seen[id]; dup {
						continue
					}
					seen[id] = struct{}{}
				}
				out = append(out, raw)
			}
			if page >= resp.TotalPages || len(resp.TransactionDetails) == 0 {
				break
			}
		}
	}
	return out, len(windows), nil
}
