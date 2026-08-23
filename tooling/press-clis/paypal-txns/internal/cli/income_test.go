// Copyright 2026 akshat-git-jpg and contributors. Licensed under Apache-2.0. See LICENSE.

package cli

import "testing"

// tx is a terse constructor for test transactions.
func tx(ts, code, cur string, val, fee float64, payer string) incomeTxn {
	return incomeTxn{TS: ts, Code: code, Cur: cur, Val: val, Fee: fee, Payer: payer}
}

func TestAttributeIncomeExcludesConversionsAndWithdrawals(t *testing.T) {
	// One USD payout, swept to INR and withdrawn the same instant. The INR legs
	// are the same money, so income must stay 140.70 rather than doubling.
	txns := []incomeTxn{
		tx("2026-03-30T04:37:21Z", "T0001", "USD", 140.70, 0, "Pictory, Corp"),
		tx("2026-03-30T22:11:16Z", "T0200", "USD", -140.70, 0, ""),
		tx("2026-03-30T22:11:16Z", "T0200", "INR", 12772.64, 0, ""),
		tx("2026-03-30T22:11:16Z", "T0403", "INR", -12772.64, 0, ""),
	}
	months, count := attributeIncome(txns, "")
	if count != 1 {
		t.Fatalf("income transactions = %d, want 1", count)
	}
	if len(months) != 1 {
		t.Fatalf("months = %d, want 1", len(months))
	}
	m := months[0]
	if m.Month != "2026-03" || m.Received != "140.70" {
		t.Errorf("month = %q received = %q, want 2026-03 / 140.70", m.Month, m.Received)
	}
	if m.BankAmount != "12772.64" || m.BankCurrency != "INR" {
		t.Errorf("bank = %q %q, want INR 12772.64", m.BankCurrency, m.BankAmount)
	}
	if len(m.Programs) != 1 || m.Programs[0].Program != "Pictory, Corp" {
		t.Fatalf("programs = %+v, want one Pictory row", m.Programs)
	}
	if got := m.Programs[0].BankAmount; got != "12772.64" {
		t.Errorf("program bank amount = %q, want 12772.64", got)
	}
}

func TestAttributeIncomeNetsPayPalFee(t *testing.T) {
	txns := []incomeTxn{
		tx("2026-06-01T12:36:52Z", "T0007", "USD", 182.34, -9.82, "Book Bolt LLC"),
	}
	months, _ := attributeIncome(txns, "")
	p := months[0].Programs[0]
	if p.Received != "172.52" {
		t.Errorf("received = %q, want 172.52 (gross minus fee)", p.Received)
	}
	if p.Gross != "182.34" || p.Fees != "-9.82" {
		t.Errorf("gross/fees = %q/%q, want 182.34/-9.82", p.Gross, p.Fees)
	}
}

func TestAttributeIncomeSplitsBundledSweepProRata(t *testing.T) {
	// Two payouts swept together: 172.52 + 18.62 = 191.14 USD -> 17464.93 INR.
	txns := []incomeTxn{
		tx("2026-06-01T12:36:52Z", "T0007", "USD", 182.34, -9.82, "Book Bolt LLC"),
		tx("2026-06-01T17:33:55Z", "T0001", "USD", 18.62, 0, "Heygen Technology Inc."),
		tx("2026-06-01T23:13:54Z", "T0200", "USD", -191.14, 0, ""),
		tx("2026-06-01T23:13:54Z", "T0200", "INR", 17464.93, 0, ""),
		tx("2026-06-01T23:13:54Z", "T0403", "INR", -17464.93, 0, ""),
	}
	months, _ := attributeIncome(txns, "")
	got := map[string]string{}
	for _, p := range months[0].Programs {
		got[p.Program] = p.BankAmount
	}
	if got["Book Bolt LLC"] != "15763.57" {
		t.Errorf("Book Bolt bank = %q, want 15763.57", got["Book Bolt LLC"])
	}
	if got["Heygen Technology Inc."] != "1701.36" {
		t.Errorf("Heygen bank = %q, want 1701.36", got["Heygen Technology Inc."])
	}
	if months[0].BankAmount != "17464.93" {
		t.Errorf("month bank = %q, want 17464.93", months[0].BankAmount)
	}
}

func TestAttributeIncomeBlankBankWhenNotWithdrawn(t *testing.T) {
	// Converted to INR but never withdrawn: bank stays blank.
	txns := []incomeTxn{
		tx("2026-08-05T00:53:52Z", "T0001", "USD", 76.65, 0, "Heygen Technology Inc."),
		tx("2026-08-05T22:39:41Z", "T0200", "USD", -76.65, 0, ""),
		tx("2026-08-05T22:39:41Z", "T0200", "INR", 7014.74, 0, ""),
	}
	months, _ := attributeIncome(txns, "")
	p := months[0].Programs[0]
	if p.BankAmount != "" || p.BankCurrency != "" {
		t.Errorf("bank = %q %q, want blank", p.BankCurrency, p.BankAmount)
	}
	if months[0].BankAmount != "" {
		t.Errorf("month bank = %q, want blank", months[0].BankAmount)
	}
}

func TestAttributeIncomeUnsettledStaysInPayPal(t *testing.T) {
	// Never converted at all: blank bank, and the amount shows as unsettled.
	txns := []incomeTxn{
		tx("2026-08-20T01:37:21Z", "T0001", "USD", 57.05, 0, "Heygen Technology Inc."),
	}
	months, _ := attributeIncome(txns, "")
	p := months[0].Programs[0]
	if p.BankAmount != "" {
		t.Errorf("bank = %q, want blank", p.BankAmount)
	}
	if p.Unsettled != "57.05" {
		t.Errorf("unsettled = %q, want 57.05", p.Unsettled)
	}
}

func TestAttributeIncomeGroupsByMonthThenProgram(t *testing.T) {
	txns := []incomeTxn{
		tx("2026-07-01T00:00:00Z", "T0001", "USD", 58.91, 0, "Heygen Technology Inc."),
		tx("2026-07-06T00:00:00Z", "T0001", "USD", 24.75, 0, "Creatify Lab Inc"),
		tx("2026-07-27T00:00:00Z", "T0001", "USD", 38.61, 0, "Heygen Technology Inc."),
		tx("2026-08-14T00:00:00Z", "T0001", "USD", 125.70, 0, "EverBee"),
	}
	months, _ := attributeIncome(txns, "")
	if len(months) != 2 || months[0].Month != "2026-07" || months[1].Month != "2026-08" {
		t.Fatalf("months = %+v, want 2026-07 then 2026-08", months)
	}
	july := months[0]
	if july.Received != "122.27" {
		t.Errorf("july received = %q, want 122.27", july.Received)
	}
	// Same program in one month collapses to one row, biggest first.
	if len(july.Programs) != 2 {
		t.Fatalf("july programs = %d, want 2", len(july.Programs))
	}
	if july.Programs[0].Program != "Heygen Technology Inc." || july.Programs[0].Received != "97.52" {
		t.Errorf("top july row = %+v, want Heygen 97.52", july.Programs[0])
	}
	if july.Programs[0].Count != 2 {
		t.Errorf("heygen count = %d, want 2", july.Programs[0].Count)
	}
}

func TestAttributeIncomeCurrencyFilter(t *testing.T) {
	txns := []incomeTxn{
		tx("2026-07-01T00:00:00Z", "T0001", "USD", 58.91, 0, "Heygen Technology Inc."),
		tx("2026-07-02T00:00:00Z", "T0001", "EUR", 10.00, 0, "Someone Else"),
	}
	months, count := attributeIncome(txns, "USD")
	if count != 1 {
		t.Fatalf("count = %d, want 1", count)
	}
	if len(months) != 1 || months[0].Currency != "USD" {
		t.Fatalf("months = %+v, want a single USD row", months)
	}
}
