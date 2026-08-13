/* ── ARC PATCH: make the panel actually openable ──────────────────────
 * Original behaviour: setPanelBehavior({openPanelOnActionClick:true}) and
 * nothing else. Arc exposes chrome.sidePanel and reports the behaviour as
 * true, but never wires its own toolbar button to it — so clicking the icon
 * did nothing at all, silently.
 *
 * We turn that flag OFF so chrome.action.onClicked fires instead, and open
 * the panel ourselves from three real user gestures: the toolbar click, a
 * keyboard shortcut (Alt+Shift+Z), and — if sidePanel.open() is refused or
 * renders nothing — a plain popup window as a last resort.
 * ---------------------------------------------------------------- */

const PANEL_URL = "sidepanel/sidepanel.html";
let popupWindowId = null;

function setBehavior() {
  // false => chrome.action.onClicked fires and we control the open ourselves.
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(setBehavior);
chrome.runtime.onStartup.addListener(setBehavior);

async function openAsPopup() {
  // Reuse the existing popup if it is still alive.
  if (popupWindowId != null) {
    try {
      await chrome.windows.update(popupWindowId, { focused: true });
      return "popup-reused";
    } catch {
      popupWindowId = null;
    }
  }
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL(PANEL_URL),
    type: "popup",
    width: 460,
    height: 900,
  });
  popupWindowId = win.id;
  return "popup";
}

chrome.windows.onRemoved.addListener((id) => {
  if (id === popupWindowId) popupWindowId = null;
});

/* The popup WINDOW is the primary path, not a fallback.
 *
 * Arc's chrome.sidePanel.open() resolves without error and renders nothing,
 * so a "try sidePanel, fall back on throw" shape never reaches the fallback.
 * Since a real window works identically in Arc and Chrome, just use it. */
async function openPanel() {
  return openAsPopup();
}

chrome.action.onClicked.addListener(async () => {
  const how = await openPanel();
  console.log("[ZAPIFLOW] opened via action click:", how);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-panel") return;
  const how = await openPanel();
  console.log("[ZAPIFLOW] opened via keyboard shortcut:", how);
});

// In-page floating button (arc-launcher.js) — the path that does not depend
// on Arc's toolbar firing anything at all.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "ZAPIFLOW_OPEN_PANEL") return;
  openPanel()
    .then((how) => {
      console.log("[ZAPIFLOW] opened via in-page launcher:", how);
      sendResponse({ ok: true, how });
    })
    .catch((e) => sendResponse({ ok: false, reason: String(e?.message || e) }));
  return true; // async sendResponse
});

/* ── MAIN world React fiber submit ───────────────────────────────────
 * chrome.scripting.executeScript with world:"MAIN" bypasses the page's
 * CSP and runs in the same JS context as React / Slate.
 *
 * The content script marks the target button with a data attribute,
 * then asks us to find and invoke the real submission handler from
 * the React fiber tree.
 * ---------------------------------------------------------------- */

/**
 * Injected into the page's MAIN world via chrome.scripting.executeScript.
 * Must be fully self-contained — no closures over service-worker scope.
 */
function reactFiberSubmit(token, markerAttr, mode) {
  var el = document.querySelector("[" + markerAttr + '="' + token + '"]');
  if (!el) return { ok: false, reason: "element not found in MAIN world" };

  // Find React fiber key
  var fiberKey = Object.keys(el).find(function (k) {
    return (
      k.startsWith("__reactFiber$") ||
      k.startsWith("__reactInternalInstance$")
    );
  });
  if (!fiberKey) return { ok: false, reason: "no React fiber on element" };

  // Walk the fiber tree and collect the nearest handler of each kind
  var handlers = {}; // name -> { fn, depth }
  var HANDLER_NAMES = ["onClick", "onPointerDown", "onMouseDown", "onPointerUp", "onMouseUp"];

  var fiber = el[fiberKey];
  var depth = 0;
  while (fiber && depth < 30) {
    var props = fiber.memoizedProps;
    if (props) {
      for (var h = 0; h < HANDLER_NAMES.length; h++) {
        var name = HANDLER_NAMES[h];
        if (!handlers[name] && typeof props[name] === "function") {
          handlers[name] = { fn: props[name], depth: depth };
        }
      }
    }
    fiber = fiber.return;
    depth++;
  }

  // Also check __reactProps$ for direct handlers
  var propsKey = Object.keys(el).find(function (k) {
    return k.startsWith("__reactProps$");
  });
  if (propsKey) {
    var directProps = el[propsKey];
    for (var d = 0; d < HANDLER_NAMES.length; d++) {
      var dn = HANDLER_NAMES[d];
      if (!handlers[dn] && typeof directProps[dn] === "function") {
        handlers[dn] = { fn: directProps[dn], depth: -1 };
      }
    }
  }

  // Skip onSubmit() — calling it with a non-Event arg makes Flow run
  // empty-prompt validation. onClick on the Create button submits correctly.

  var rect = el.getBoundingClientRect();
  function fakeEvent(type) {
    return {
      type: type,
      target: el,
      currentTarget: el,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      button: 0,
      buttons: type === "pointerdown" || type === "mousedown" ? 1 : 0,
      pointerId: 1,
      pointerType: "mouse",
      isTrusted: true,
      detail: 1,
      preventDefault: function () {},
      stopPropagation: function () {},
      isPropagationStopped: function () { return false; },
      isDefaultPrevented: function () { return false; },
      nativeEvent: { type: type, isTrusted: true },
    };
  }

  // mode "press": popover/dropdown triggers open on pointer-down, not click —
  // fire the whole press sequence, each handler that exists.
  if (mode === "press") {
    var seq = [
      ["onPointerDown", "pointerdown"],
      ["onMouseDown",   "mousedown"],
      ["onPointerUp",   "pointerup"],
      ["onMouseUp",     "mouseup"],
      ["onClick",       "click"],
    ];
    var invoked = [];
    for (var s = 0; s < seq.length; s++) {
      var entry = handlers[seq[s][0]];
      if (entry) {
        try { entry.fn(fakeEvent(seq[s][1])); invoked.push(seq[s][0]); } catch (e) { /* keep going */ }
      }
    }
    if (invoked.length) return { ok: true, method: invoked.join("+"), depth: 0 };
    return { ok: false, reason: "no press handlers found in fiber tree" };
  }

  // default mode: onClick only (proven path for the Create button)
  var click = handlers.onClick;
  if (click) {
    try {
      click.fn(fakeEvent("click"));
      return { ok: true, method: "onClick", depth: click.depth };
    } catch (e) {
      return { ok: false, reason: "onClick threw: " + e.message };
    }
  }

  return { ok: false, reason: "onClick not found in fiber tree" };
}

// Simple main-world click for toggle buttons (no fiber needed)
function mainWorldAgentClick() {
  var btn = Array.from(document.querySelectorAll("button[aria-pressed]"))
    .find(function(b) { return /agent/i.test(b.textContent); });
  if (!btn) return { ok: false, reason: "Agent button not found" };
  if (btn.getAttribute("aria-pressed") !== "true") return { ok: true, skipped: true };
  btn.click();
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "MAIN_WORLD_AGENT_CLICK") {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false, reason: "no tab id" }); return; }
    chrome.scripting
      .executeScript({ target: { tabId }, world: "MAIN", func: mainWorldAgentClick })
      .then(results => sendResponse(results?.[0]?.result || { ok: false, reason: "no result" }))
      .catch(e => sendResponse({ ok: false, reason: String(e?.message || e) }));
    return true;
  }

  if (msg?.type !== "REACT_FIBER_CLICK") return;

  const tabId = sender.tab?.id;
  if (!tabId) {
    sendResponse({ ok: false, reason: "no tab id" });
    return;
  }

  chrome.scripting
    .executeScript({
      target: { tabId },
      world: "MAIN",
      func: reactFiberSubmit,
      args: [msg.token, msg.markerAttr, msg.mode || "click"],
    })
    .then((results) => {
      const val = results?.[0]?.result;
      sendResponse(val || { ok: false, reason: "no result from injection" });
    })
    .catch((e) => {
      sendResponse({ ok: false, reason: String(e?.message || e) });
    });

  return true; // async sendResponse
});
