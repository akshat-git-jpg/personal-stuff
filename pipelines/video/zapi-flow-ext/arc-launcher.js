/**
 * ARC PATCH — in-page launcher.
 *
 * Arc exposes chrome.sidePanel and reports openPanelOnActionClick:true, but
 * never renders an extension side panel and never wires its toolbar button
 * to one. Every open path that goes through Arc's own chrome hits that wall.
 *
 * This sidesteps it entirely: a small floating button drawn on the Flow page.
 * Clicking it asks the service worker to open the queue UI as a real popup
 * WINDOW (not a browser-action popup, which would close the moment focus
 * moved back to Flow and kill a running queue).
 */
(function () {
  if (window.__zapiflowArcLauncher) return;
  window.__zapiflowArcLauncher = true;

  const BTN_ID = "zapiflow-arc-launcher";

  function mount() {
    if (document.getElementById(BTN_ID)) return;
    if (!document.body) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.textContent = "⚡ ZAPI FLOW";
    btn.title = "Open the ZAPI FLOW queue (Arc)";
    Object.assign(btn.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: "2147483647",
      padding: "10px 14px",
      borderRadius: "999px",
      border: "1px solid rgba(255,255,255,.25)",
      background: "#1f1f22",
      color: "#fff",
      font: "600 13px/1 system-ui, -apple-system, sans-serif",
      cursor: "pointer",
      boxShadow: "0 4px 16px rgba(0,0,0,.45)",
      opacity: "0.85",
    });
    btn.addEventListener("mouseenter", () => (btn.style.opacity = "1"));
    btn.addEventListener("mouseleave", () => (btn.style.opacity = "0.85"));

    btn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "ZAPIFLOW_OPEN_PANEL" }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn("[ZAPIFLOW] launcher failed:", chrome.runtime.lastError.message);
          return;
        }
        console.log("[ZAPIFLOW] launcher opened via:", res?.how);
      });
    });

    document.body.appendChild(btn);
    console.log("[ZAPIFLOW] Arc launcher button mounted.");
  }

  mount();

  // Flow is a SPA and rerenders the body on navigation — remount if it vanishes.
  const obs = new MutationObserver(() => {
    if (!document.getElementById(BTN_ID)) mount();
  });
  if (document.body) obs.observe(document.body, { childList: true });
})();
