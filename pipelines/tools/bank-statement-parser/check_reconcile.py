"""Manual sanity check for the reconciliation logic — runs with no API key.

    python check_reconcile.py

Exercises the load-bearing piece: opening + credits - debits == closing, now in
exact integer cents (no tolerance). No network, no model.
"""
from app.schema import StatementExtraction
from app.reconcile import finalize


def _case(name, opening, closing, txns, expect_reconciled, expect_discrepancy_cents):
    ex = StatementExtraction.model_validate(
        {
            "balances": {"opening": opening, "closing": closing},
            "transactions": [{"amount": a, "direction": d} for a, d in txns],
            "confidence": 0.9,
        }
    )
    st = finalize(ex)
    ok = (
        st.validation.reconciled == expect_reconciled
        and st.validation.discrepancy == expect_discrepancy_cents
    )
    print(
        f"[{'PASS' if ok else 'FAIL'}] {name}: "
        f"reconciled={st.validation.reconciled} discrepancy={st.validation.discrepancy}c "
        f"credits={st.summary.total_credits}c debits={st.summary.total_debits}c "
        f"count={st.summary.transaction_count}"
    )
    return ok


def main():
    results = [
        # 1000 + 500 credit - 300 debit = 1200 -> matches closing, exact
        _case("clean reconcile", 1000.00, 1200.00,
              [(500.00, "credit"), (300.00, "debit")], True, 0),
        # closing off by 50 -> flagged, discrepancy surfaced in cents
        _case("off by 50", 1000.00, 1150.00,
              [(500.00, "credit"), (300.00, "debit")], False, -5000),
        # exact integer money: 1 cent off is NOT reconciled (no tolerance)
        _case("off by 1 cent", 100.00, 150.01,
              [(50.00, "credit")], False, 1),
        # missing opening balance -> can't reconcile, honest false
        _case("missing opening", None, 150.00,
              [(50.00, "credit")], False, 0),
    ]
    print(f"\n{sum(results)}/{len(results)} passed")
    raise SystemExit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
