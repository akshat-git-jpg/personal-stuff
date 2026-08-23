// Hand-authored transcendence command for paypal-txns-pp-cli. Not generated.
//
// `history` returns every transaction across an arbitrary date range as one
// list, transparently splitting the range into PayPal's required <=31-day
// windows and walking every page (see paypal_windows.go).

package cli

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/spf13/cobra"
)

type historyView struct {
	Transactions []json.RawMessage `json:"transactions"`
	Count        int               `json:"count"`
	Windows      int               `json:"windows"`
	Start        string            `json:"start"`
	End          string            `json:"end"`
}

func newNovelHistoryCmd(flags *rootFlags) *cobra.Command {
	var flagSince, flagStart, flagEnd, flagStatus, flagFields string

	cmd := &cobra.Command{
		Use:   "history",
		Short: "Fetch every transaction across an arbitrary date range",
		Long: "Fetch every transaction across a date range as a single list.\n\n" +
			"Handles PayPal's 31-day-per-call window limit and pagination automatically and\n" +
			"de-duplicates by transaction_id. Use --since (30d, 4w, 5mo, 1y) or --start/--end\n" +
			"(YYYY-MM-DD). Optional --status filters by PayPal status code (S success, P pending,\n" +
			"V reversed, D denied). --fields all returns the full transaction detail.",
		Example: "  paypal-txns-pp-cli history --since 1mo --json\n" +
			"  paypal-txns-pp-cli history --start 2026-01-01 --end 2026-03-31 --status S --json",
		Annotations: map[string]string{"mcp:read-only": "true"},
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 && cmd.Flags().NFlag() == 0 {
				return cmd.Help()
			}
			if dryRunOK(flags) {
				fmt.Fprintln(cmd.OutOrStdout(), "would fetch all transactions across the resolved date range")
				return nil
			}

			now := time.Now()
			start, end, err := resolveRange(now, flagSince, flagStart, flagEnd)
			if err != nil {
				_ = cmd.Usage()
				return usageErr(err)
			}

			fields := flagFields
			if fields == "" {
				fields = "transaction_info"
			}

			c, err := flags.newClient()
			if err != nil {
				return err
			}

			details, windows, err := fetchAllTransactions(cmd.Context(), c, start, end, flagStatus, fields, 500, cmd.ErrOrStderr())
			if err != nil {
				return classifyAPIError(err, flags)
			}

			view := historyView{
				Transactions: details,
				Count:        len(details),
				Windows:      windows,
				Start:        start.Format("2006-01-02"),
				End:          end.Format("2006-01-02"),
			}
			if view.Transactions == nil {
				view.Transactions = make([]json.RawMessage, 0)
			}

			if !wantsHumanTable(cmd.OutOrStdout(), flags) {
				return printJSONFiltered(cmd.OutOrStdout(), view, flags)
			}

			w := cmd.OutOrStdout()
			fmt.Fprintf(w, "%d transaction(s) %s → %s across %d window(s)\n\n", view.Count, view.Start, view.End, view.Windows)
			if view.Count == 0 {
				fmt.Fprintln(w, "No transactions in this range.")
				return nil
			}
			fmt.Fprintf(w, "%-24s  %-10s  %3s  %14s\n", "DATE", "STATUS", "CUR", "AMOUNT")
			for _, raw := range view.Transactions {
				var d ppTxnDetail
				_ = json.Unmarshal(raw, &d)
				date := d.TransactionInfo.InitiationDate
				if len(date) >= 19 {
					date = date[:19]
				}
				fmt.Fprintf(w, "%-24s  %-10s  %3s  %14s\n",
					date,
					d.TransactionInfo.Status,
					d.TransactionInfo.Amount.Currency,
					d.TransactionInfo.Amount.Value)
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&flagSince, "since", "", "Relative range back from now: 30d, 4w, 5mo, 1y (default last month)")
	cmd.Flags().StringVar(&flagStart, "start", "", "Explicit start date YYYY-MM-DD (overrides --since)")
	cmd.Flags().StringVar(&flagEnd, "end", "", "Explicit end date YYYY-MM-DD (default now)")
	cmd.Flags().StringVar(&flagStatus, "status", "", "Filter by PayPal status code: S, P, V, D")
	cmd.Flags().StringVar(&flagFields, "fields", "transaction_info", "Detail level: transaction_info or all")
	return cmd
}
