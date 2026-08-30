/**
 * Login.tsx — PIN gate.
 *
 * The `.pin-*` / `.keypad` styles already existed in index.css but nothing ever
 * rendered them; this screen finally uses them. Auto-submits on the last digit,
 * so there is no "go" button to reach for mid-workout.
 */
import { useState, useCallback } from "react";
import { api } from "./api";

const PIN_LEN = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (value: string) => {
      setBusy(true);
      try {
        await api.login(value);
        onSuccess();
      } catch {
        setErr(true);
        setBusy(false);
        // Hold the filled dots for a beat so the shake is visible, then clear.
        setTimeout(() => {
          setPin("");
          setErr(false);
        }, 500);
      }
    },
    [onSuccess],
  );

  const push = useCallback(
    (d: string) => {
      if (busy || err) return;
      setPin((prev) => {
        if (prev.length >= PIN_LEN) return prev;
        const next = prev + d;
        if (next.length === PIN_LEN) void submit(next);
        return next;
      });
    },
    [busy, err, submit],
  );

  const back = useCallback(() => {
    if (busy || err) return;
    setPin((prev) => prev.slice(0, -1));
  }, [busy, err]);

  return (
    <div className="pin-wrap">
      <div className="pin-brand">
        <div className="mark">
          Kushal
          <em>Gym</em>
        </div>
        <div className="pin-sub">Enter PIN</div>
        <div className="pin-dots">
          {Array.from({ length: PIN_LEN }, (_, i) => (
            <div
              key={i}
              className={`pin-dot${err ? " err" : i < pin.length ? " on" : ""}`}
            />
          ))}
        </div>
      </div>

      <div className="keypad">
        {KEYS.map((k) => (
          <button key={k} type="button" className="key" onClick={() => push(k)}>
            {k}
          </button>
        ))}
        <span />
        <button type="button" className="key" onClick={() => push("0")}>
          0
        </button>
        <button type="button" className="key ghost" onClick={back}>
          Del
        </button>
      </div>
    </div>
  );
}
