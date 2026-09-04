import { useState, type FormEvent } from "react";
import { login } from "./api";

export function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark" />
          YT Analytics
        </div>
        <p className="login-hint">Enter the password to view link analytics.</p>
        <input
          type="password"
          className="login-input"
          placeholder="Password"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="btn-primary" disabled={busy || !password}>
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
