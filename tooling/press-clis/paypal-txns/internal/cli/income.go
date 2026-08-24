// Hand-authored transcendence command for paypal-txns-pp-cli. Not generated.
//
// `income` totals real money received, grouped by month and then by the program
// (payer) that sent it, over any date range. It relies on the windowing engine
// in paypal_ranges.go to satisfy PayPal's 31-day-per-call limit and to page
// through every result.
//
// Two things make this more than a sum over positive amounts:
//
//  1. A multi-currency PayPal account records the same money three times: the
//     incoming payment (T00xx), the currency conversion out of the receiving
//     currency and into the settlement currency (T02xx, one debit and one
//     credit at the same timestamp), and the withdrawal to the bank (T04xx).
//     Counting every positive amount therefore counts each payout twice. Only
//     the T00xx credits are income; the rest is the same money moving.
//
//  2. The settlement legs carry no payer, so the bank amount has to be
//     attributed back to the programs that funded it. Sweeps are matched to
//     income lots FIFO and the converted amount is split pro-rata across the
//     lots the sweep drained.

package cli

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

// epsilon guards float comparisons on money values.
const incomeEpsilon = 0.005

// ppIncomeDetail is the typed view of one transaction_details element with the
// extra fields `income` needs beyond ppTxnDetail: the event code that tells a
// real payment apart from a conversion or a withdrawal, the PayPal fee, and the
// payer (only present when the request asks for fields=all).
type ppIncomeDetail struct {
	TransactionInfo struct {
		TransactionID  string `json:"transaction_id"`
		InitiationDate string `json:"transaction_initiation_date"`
		EventCode      string `json:"transaction_event_code"`
		Amount         struct {
			Currency string `json:"currency_code"`
			Value    string `json:"value"`
		} `json:"transaction_amount"`
		Fee struct {
			Currency string `json:"currency_code"`
			Value    string `json:"value"`
		} `json:"fee_amount"`
	} `json:"transaction_info"`
	PayerInfo struct {
		EmailAddress string `json:"email_address"`
		PayerName    struct {
			AlternateFullName string `json:"alternate_full_name"`
		} `json:"payer_name"`
	} `json:"payer_info"`
}

// incomeTxn is the minimal shape the attribution needs from one transaction.
type incomeTxn struct {
	TS    string
	Code  string
	Cur   string
	Val   float64
	Fee   float64
	Payer string
}

type incomeProgramRow struct {
	Program      string `json:"program"`
	Currency     string `json:"currency"`
	Received     string `json:"received"`
	Gross        string `json:"gross"`
	Fees         string `json:"fees"`
	Count        int    `json:"count"`
	BankAmount   string `json:"bank_amount"`   // "" when none of it reached the bank yet
	BankCurrency string `json:"bank_currency"` // "" when bank_amount is ""
	Unsettled    string `json:"unsettled"`     // received but still sitting in PayPal
}

type incomeMonthRow struct {
	Month        string             `json:"month"`
	Currency     string             `json:"currency"`
	Received     string             `json:"received"`
	BankAmount   string             `json:"bank_amount"`
	BankCurrency string             `json:"bank_currency"`
	Programs     []incomeProgramRow `json:"programs"`
}

type incomeView struct {
	Months              []incomeMonthRow  `json:"months"`
	TotalByCurrency     map[string]string `json:"total_by_currency"`
	BankByCurrency      map[string]string `json:"bank_by_currency"`
	UnsettledByCurrency map[string]string `json:"unsettled_by_currency"`
	TransactionsScanned int               `json:"transactions_scanned"`
	IncomeTransactions  int               `json:"income_transactions"`
	Windows             int               `json:"windows"`
	Start               string            `json:"start"`
	End                 string            `json:"end"`
}

// isIncomeCode reports whether a PayPal transaction event code is a real
// payment received. The T00xx family is PayPal account-to-account payments;
// every other family is a fee, a conversion, a transfer or an adjustment.
func isIncomeCode(code string) bool { return strings.HasPrefix(code, "T00") }

// isConversionCode reports a currency-conversion leg (T02xx).
func isConversionCode(code string) bool { return strings.HasPrefix(code, "T02") }

// isWithdrawalCode reports a withdrawal out of the PayPal balance (T04xx).
func isWithdrawalCode(code string) bool { return strings.HasPrefix(code, "T04") }

// incomeLot is one payment received, tracked until it is converted away.
type incomeLot struct {
	month     string
	program   string
	currency  string
	remaining float64
}

type incomeAgg struct {
	program   string
	currency  string
	received  float64
	gross     float64
	fees      float64
	count     int
	bank      float64
	bankCur   string
	unsettled float64
}

// attributeIncome turns a flat transaction list into per-month, per-program
// income with the settled bank amount attributed back to each program.
//
// currencyFilter, when non-empty, keeps only income received in that currency.
func attributeIncome(txns []incomeTxn, currencyFilter string) ([]incomeMonthRow, int) {
	ordered := make([]incomeTxn, len(txns))
	copy(ordered, txns)
	sort.SliceStable(ordered, func(i, j int) bool { return ordered[i].TS < ordered[j].TS })

	// Sweeps land as several legs sharing one timestamp, so walk timestamp groups.
	var stamps []string
	groups := map[string][]incomeTxn{}
	for _, t := range ordered {
		if _, ok := groups[t.TS]; !ok {
			stamps = append(stamps, t.TS)
		}
		groups[t.TS] = append(groups[t.TS], t)
	}

	var lots []*incomeLot
	aggs := map[string]*incomeAgg{}
	incomeCount := 0

	agg := func(month, program, currency string) *incomeAgg {
		key := month + "\x00" + currency + "\x00" + program
		if aggs[key] == nil {
			aggs[key] = &incomeAgg{program: program, currency: currency}
		}
		return aggs[key]
	}

	for _, ts := range stamps {
		month := ts
		if len(month) >= 7 {
			month = month[:7]
		}

		for _, t := range groups[ts] {
			if !isIncomeCode(t.Code) || t.Val <= 0 {
				continue
			}
			if currencyFilter != "" && t.Cur != currencyFilter {
				continue
			}
			// PayPal reports fees as a negative value on the same record.
			net := t.Val + t.Fee
			a := agg(month, t.Payer, t.Cur)
			a.received += net
			a.gross += t.Val
			a.fees += t.Fee
			a.count++
			incomeCount++
			lots = append(lots, &incomeLot{month: month, program: t.Payer, currency: t.Cur, remaining: net})
		}

		// A sweep debits one currency and credits another at the same instant.
		// The debited currency is the source; anything else credited is settlement.
		sourceOut := map[string]float64{}
		for _, t := range groups[ts] {
			if isConversionCode(t.Code) && t.Val < 0 {
				sourceOut[t.Cur] += -t.Val
			}
		}
		if len(sourceOut) == 0 {
			continue
		}
		settledIn, settledCur := 0.0, ""
		for _, t := range groups[ts] {
			if isConversionCode(t.Code) && t.Val > 0 {
				if _, isSource := sourceOut[t.Cur]; isSource {
					continue
				}
				settledIn += t.Val
				settledCur = t.Cur
			}
		}
		toBank := 0.0
		for _, t := range groups[ts] {
			if isWithdrawalCode(t.Code) && t.Val < 0 && t.Cur == settledCur {
				toBank += -t.Val
			}
		}

		for cur, out := range sourceOut {
			if out <= incomeEpsilon {
				continue
			}
			// Drain matching lots oldest-first.
			type drain struct {
				lot  *incomeLot
				took float64
			}
			var drained []drain
			need := out
			for _, l := range lots {
				if need <= incomeEpsilon {
					break
				}
				if l.currency != cur || l.remaining <= incomeEpsilon {
					continue
				}
				took := math.Min(l.remaining, need)
				l.remaining -= took
				need -= took
				drained = append(drained, drain{lot: l, took: took})
			}
			if settledIn <= incomeEpsilon || toBank <= incomeEpsilon {
				continue
			}
			for _, d := range drained {
				share := d.took / out
				a := agg(d.lot.month, d.lot.program, d.lot.currency)
				a.bank += toBank * share
				a.bankCur = settledCur
			}
		}
	}

	// Whatever never got converted is still in PayPal.
	for _, l := range lots {
		if l.remaining > incomeEpsilon {
			agg(l.month, l.program, l.currency).unsettled += l.remaining
		}
	}

	// Keys are month\x00currency\x00program; regroup them into month+currency rows.
	byMonth := map[string]*incomeMonthRow{}
	var monthKeys []string
	for key, a := range aggs {
		parts := strings.SplitN(key, "\x00", 3)
		month, cur := parts[0], parts[1]
		mk := month + "\x00" + cur
		if byMonth[mk] == nil {
			byMonth[mk] = &incomeMonthRow{Month: month, Currency: cur}
			monthKeys = append(monthKeys, mk)
		}
		m := byMonth[mk]
		m.Programs = append(m.Programs, incomeProgramRow{
			Program:      a.program,
			Currency:     a.currency,
			Received:     money(a.received),
			Gross:        money(a.gross),
			Fees:         money(a.fees),
			Count:        a.count,
			BankAmount:   moneyOrBlank(a.bank),
			BankCurrency: bankCurOrBlank(a.bank, a.bankCur),
			Unsettled:    moneyOrBlank(a.unsettled),
		})
	}

	sort.Strings(monthKeys)
	out := make([]incomeMonthRow, 0, len(monthKeys))
	for _, mk := range monthKeys {
		m := byMonth[mk]
		received, bank := 0.0, 0.0
		bankCur := ""
		for _, p := range m.Programs {
			received += parseMoney(p.Received)
			bank += parseMoney(p.BankAmount)
			if p.BankCurrency != "" {
				bankCur = p.BankCurrency
			}
		}
		sort.SliceStable(m.Programs, func(i, j int) bool {
			pi, pj := parseMoney(m.Programs[i].Received), parseMoney(m.Programs[j].Received)
			if pi != pj {
				return pi > pj
			}
			return m.Programs[i].Program < m.Programs[j].Program
		})
		m.Received = money(received)
		m.BankAmount = moneyOrBlank(bank)
		m.BankCurrency = bankCurOrBlank(bank, bankCur)
		out = append(out, *m)
	}
	return out, incomeCount
}

func money(v float64) string { return strconv.FormatFloat(v, 'f', 2, 64) }

func moneyOrBlank(v float64) string {
	if v <= incomeEpsilon {
		return ""
	}
	return money(v)
}

func bankCurOrBlank(v float64, cur string) string {
	if v <= incomeEpsilon {
		return ""
	}
	return cur
}

func parseMoney(s string) float64 {
	if s == "" {
		return 0
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return v
}

func newNovelIncomeCmd(flags *rootFlags) *cobra.Command {
	var flagSince, flagStart, flagEnd, flagCurrency string

	cmd := &cobra.Command{
		Use:   "income",
		Short: "Money received grouped by month, then by program (payer), with the amount that reached the bank.",
		Long: "Total money actually received from PayPal, grouped by month and then by the program\n" +
			"(payer) that sent it, net of PayPal fees.\n\n" +
			"Only genuine incoming payments (event code family T00xx) count. Currency conversions\n" +
			"(T02xx) and bank withdrawals (T04xx) are the same money moving, not new income, so\n" +
			"they are excluded from the totals; instead each sweep is matched back to the payments\n" +
			"that funded it (oldest first, split pro-rata) so every program shows how much of its\n" +
			"money landed in the bank. Money still sitting in PayPal shows a blank bank amount and\n" +
			"is reported under 'unsettled'.\n\n" +
			"Handles PayPal's 31-day-per-call window limit and pagination automatically. Use --since\n" +
			"for a relative range (30d, 4w, 5mo, 1y) or --start/--end (YYYY-MM-DD). Defaults to the\n" +
			"last month.",
		Example: "  paypal-txns-pp-cli income --since 5mo\n" +
			"  paypal-txns-pp-cli income --start 2026-01-01 --end 2026-03-31 --json",
		Annotations: map[string]string{"mcp:read-only": "true"},
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 && cmd.Flags().NFlag() == 0 {
				return cmd.Help()
			}
			if dryRunOK(flags) {
				fmt.Fprintln(cmd.OutOrStdout(), "would total received payments grouped by month and program")
				return nil
			}

			now := time.Now()
			start, end, err := resolveRange(now, flagSince, flagStart, flagEnd)
			if err != nil {
				_ = cmd.Usage()
				return usageErr(err)
			}

			c, err := flags.newClient()
			if err != nil {
				return err
			}

			// "all" is required: payer_info carries the program name, and
			// transaction_info alone does not include it.
			details, windows, err := fetchAllTransactions(cmd.Context(), c, start, end, "", "all", 500, cmd.ErrOrStderr())
			if err != nil {
				return classifyAPIError(err, flags)
			}

			txns := make([]incomeTxn, 0, len(details))
			for _, raw := range details {
				var d ppIncomeDetail
				if err := json.Unmarshal(raw, &d); err != nil {
					continue
				}
				val, err := strconv.ParseFloat(d.TransactionInfo.Amount.Value, 64)
				if err != nil {
					continue
				}
				fee := 0.0
				if d.TransactionInfo.Fee.Value != "" {
					fee, _ = strconv.ParseFloat(d.TransactionInfo.Fee.Value, 64)
				}
				payer := strings.TrimSpace(d.PayerInfo.PayerName.AlternateFullName)
				if payer == "" {
					payer = strings.TrimSpace(d.PayerInfo.EmailAddress)
				}
				if payer == "" {
					payer = "(unknown)"
				}
				txns = append(txns, incomeTxn{
					TS:    d.TransactionInfo.InitiationDate,
					Code:  d.TransactionInfo.EventCode,
					Cur:   d.TransactionInfo.Amount.Currency,
					Val:   val,
					Fee:   fee,
					Payer: payer,
				})
			}

			months, incomeCount := attributeIncome(txns, flagCurrency)

			view := incomeView{
				Months:              months,
				TotalByCurrency:     map[string]string{},
				BankByCurrency:      map[string]string{},
				UnsettledByCurrency: map[string]string{},
				TransactionsScanned: len(details),
				IncomeTransactions:  incomeCount,
				Windows:             windows,
				Start:               start.Format("2006-01-02"),
				End:                 end.Format("2006-01-02"),
			}
			totals, bank, unsettled := map[string]float64{}, map[string]float64{}, map[string]float64{}
			for _, m := range months {
				for _, p := range m.Programs {
					totals[p.Currency] += parseMoney(p.Received)
					unsettled[p.Currency] += parseMoney(p.Unsettled)
					if p.BankCurrency != "" {
						bank[p.BankCurrency] += parseMoney(p.BankAmount)
					}
				}
			}
			for cur, v := range totals {
				view.TotalByCurrency[cur] = money(v)
			}
			for cur, v := range bank {
				view.BankByCurrency[cur] = money(v)
			}
			for cur, v := range unsettled {
				if v > incomeEpsilon {
					view.UnsettledByCurrency[cur] = money(v)
				}
			}

			if !wantsHumanTable(cmd.OutOrStdout(), flags) {
				return printJSONFiltered(cmd.OutOrStdout(), view, flags)
			}

			w := cmd.OutOrStdout()
			fmt.Fprintf(w, "Income %s → %s (%d payments in %d transactions across %d window(s))\n\n",
				view.Start, view.End, view.IncomeTransactions, view.TransactionsScanned, view.Windows)
			if len(view.Months) == 0 {
				fmt.Fprintln(w, "No money received in this range.")
				return nil
			}
			for _, m := range view.Months {
				bankLabel := "—"
				if m.BankAmount != "" {
					bankLabel = m.BankCurrency + " " + m.BankAmount
				}
				fmt.Fprintf(w, "%s   %s %s   → bank %s\n", m.Month, m.Currency, m.Received, bankLabel)
				fmt.Fprintf(w, "  %-38s %12s  %14s\n", "PROGRAM", "RECEIVED", "TO BANK")
				for _, p := range m.Programs {
					toBank := "—"
					if p.BankAmount != "" {
						toBank = p.BankCurrency + " " + p.BankAmount
					}
					fmt.Fprintf(w, "  %-38s %12s  %14s\n", truncateRunes(p.Program, 38), p.Received, toBank)
				}
				fmt.Fprintln(w, "")
			}
			for cur, total := range view.TotalByCurrency {
				fmt.Fprintf(w, "Total received %s: %s\n", cur, total)
			}
			for cur, total := range view.BankByCurrency {
				fmt.Fprintf(w, "Total to bank %s: %s\n", cur, total)
			}
			for cur, total := range view.UnsettledByCurrency {
				fmt.Fprintf(w, "Still in PayPal %s: %s\n", cur, total)
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&flagSince, "since", "", "Relative range back from now: 30d, 4w, 5mo, 1y (default last month)")
	cmd.Flags().StringVar(&flagStart, "start", "", "Explicit start date YYYY-MM-DD (overrides --since)")
	cmd.Flags().StringVar(&flagEnd, "end", "", "Explicit end date YYYY-MM-DD (default now)")
	cmd.Flags().StringVar(&flagCurrency, "currency", "", "Filter income to a single received-currency code, e.g. USD")
	return cmd
}

// truncateRunes trims on rune boundaries; the byte-based truncate in helpers.go
// would split multi-byte payer names (Cyrillic, CJK) mid-character.
func truncateRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	if n <= 1 {
		return string(r[:n])
	}
	return string(r[:n-1]) + "…"
}
