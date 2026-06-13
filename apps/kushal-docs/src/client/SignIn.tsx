export function SignIn() {
  const params = new URLSearchParams(location.search);
  const error = params.get("error");
  const msg: Record<string, string> = {
    denied: "That account isn't allowed to open this vault.",
    state: "Sign-in expired. Please try again.",
    token: "Couldn't reach Google. Please try again.",
    noidtoken: "Google didn't return an identity. Please try again.",
  };

  return (
    <div className="signin">
      <div className="signin-card">
        <div className="logo">
          <img src="/icon-192.png" alt="" width={72} height={72} />
        </div>
        <h1>Kushal Docs</h1>
        <p className="sub">Your private document vault.</p>
        {error && <p className="error">{msg[error] ?? "Sign-in failed. Please try again."}</p>}
        <a className="google-btn" href="/api/auth/login">
          <GoogleMark />
          Sign in with Google
        </a>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.3-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5.2 0 9.9-2 13.5-5.2l-6.2-5.3C29.2 34.6 26.7 35.5 24 35.5c-5.3 0-9.7-3.1-11.3-7.9l-6.5 5C9.6 39 16.2 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.3C41.8 35.5 43.5 30.2 43.5 24c0-1.2-.1-2.3-.3-3.5z"
      />
    </svg>
  );
}
