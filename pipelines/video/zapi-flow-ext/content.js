(function () {
  // HARD GUARD against double injection. Injecting content.js more than once
  // (page kept open across sessions, re-injection races, etc.) creates multiple
  // onMessage listeners that ALL handle FLOW_BATCH_RUN — concurrent runQueue
  // copies typing into the same inputs in lockstep (e.g. "ssscccеее" in the
  // asset search) and duplicate submits. The isolated world persists across
  // executeScript calls, so a window flag makes injection idempotent.
  if (window.__zapiflowContentLoaded) {
    console.log("[ZAPIFLOW] Content script already loaded — skipping duplicate injection.");
    return;
  }
  window.__zapiflowContentLoaded = true;

  const LOG_PREFIX = "[ZAPIFLOW]";

  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }

  function warn(...args) {
    console.warn(LOG_PREFIX, ...args);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function randomIntInclusive(min, max) {
    const a = Math.ceil(min);
    const b = Math.floor(max);
    return a + Math.floor(Math.random() * (b - a + 1));
  }

  function isVisible(el) {
    if (!el) return false;
    if (!document.body.contains(el)) return false; // detached elements always invisible
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      r.width > 0 &&
      r.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none"
    );
  }

  /** Plain text roughly visible in a Slate contenteditable (drops ZWSP / FEFF). */
  function editorPlainText(el) {
    return (el.innerText || "")
      .replace(/[\u200b\ufeff]/g, "")
      .replace(/\n+/g, " ")
      .trim();
  }

  function editorSeemsToContain(el, text) {
    const t = text.trim();
    if (!t) return false;
    // If element is detached from DOM, its innerText is stale — treat as miss
    if (!document.body.contains(el)) return false;
    const raw = editorPlainText(el);
    if (raw.includes(t)) return true;
    const head = t.slice(0, Math.min(48, t.length));
    return raw.includes(head);
  }

  /**
   * Prefer the editable with Flow's main placeholder; else the lowest visible Slate box (prompt bar).
   */
  function findFlowPromptEditor() {
    const candidates = [];
    for (const el of document.querySelectorAll(
      '[data-slate-editor="true"][contenteditable="true"]'
    )) {
      if (!isVisible(el)) continue;
      candidates.push(el);
    }
    if (!candidates.length) return null;

    const withPlaceholder = candidates.filter((el) => {
      const ph = el.querySelector("[data-slate-placeholder]");
      if (!ph) return false;
      const label = (ph.textContent || "").toLowerCase();
      return (
        label.includes("what do you want") ||
        label.includes("create") ||
        label.includes("generate")
      );
    });
    const pool = withPlaceholder.length ? withPlaceholder : candidates;
    return pool.sort(
      (a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom
    )[0];
  }

  function firstMatch(selectors) {
    for (const sel of selectors || []) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch {
        /* invalid selector */
      }
    }
    return null;
  }

  /**
   * Focus like a user: scroll, then click inside the box so React/Slate activates the field.
   */
  async function focusEditorLikeUser(el) {
    el.scrollIntoView({ block: "center", inline: "nearest" });
    await sleep(40);
    const r = el.getBoundingClientRect();
    const cx = Math.min(Math.max(r.left + r.width / 2, r.left + 8), r.right - 8);
    const cy = Math.min(Math.max(r.top + r.height / 2, r.top + 8), r.bottom - 8);
    const common = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: cx,
      clientY: cy,
      button: 0,
      buttons: 1,
    };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...common, pointerId: 1, pointerType: "mouse" }));
    el.dispatchEvent(new MouseEvent("mousedown", common));
    el.dispatchEvent(new PointerEvent("pointerup", { ...common, pointerId: 1, pointerType: "mouse" }));
    el.dispatchEvent(new MouseEvent("mouseup", common));
    el.dispatchEvent(new MouseEvent("click", common));
    el.focus();
    await sleep(50);
  }

  async function selectAllInEditor(el) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    await sleep(30);
  }

  async function clearEditorContent(el) {
    await selectAllInEditor(el);
    try {
      document.execCommand("delete", false, null);
    } catch {
      el.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "deleteContentBackward",
        })
      );
    }
    await sleep(40);
  }

  function dispatchSyntheticPaste(el, text) {
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    const ev = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    try {
      Object.defineProperty(ev, "clipboardData", {
        value: dt,
        enumerable: true,
        configurable: true,
      });
    } catch {
      /* ignore */
    }
    return el.dispatchEvent(ev);
  }

  async function typeInsertTextEvents(el, text, charDelayMs) {
    el.focus();
    const endSel = window.getSelection();
    const endRange = document.createRange();
    endRange.selectNodeContents(el);
    endRange.collapse(false);
    endSel.removeAllRanges();
    endSel.addRange(endRange);
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      el.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          composed: true,
          inputType: "insertText",
          data: char,
        })
      );
      el.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          composed: true,
          inputType: "insertText",
          data: char,
        })
      );
      if (charDelayMs > 0) await sleep(charDelayMs);
    }
  }

  /**
   * Slate/React ignores raw DOM writes — drive the same path as typing/pasting.
   */
  async function clickPlusButton() {
    const selectors = globalThis.FLOW_BATCH_DEFAULT_SELECTORS.uploadButton || [];
    let btn = firstMatch(selectors.filter(s => !s.includes(':contains')));
    
    if (!btn || !isVisible(btn)) {
      btn = Array.from(document.querySelectorAll('button')).find(b => {
         return isVisible(b) && (b.textContent || '').includes('add_2');
      });
    }

    if (!btn || !isVisible(btn)) {
      for (const b of document.querySelectorAll('button')) {
        if (!isVisible(b)) continue;
        const text = b.textContent.trim().toLowerCase();
        if (text === 'add' || text === 'add_circle' || text === 'add_photo_alternate') {
          btn = b;
          break;
        }
      }
    }
    if (btn) {
      log("Found '+' button, clicking it.");
      btn.click();
      return true;
    }
    return false;
  }

  // Add a project asset (already in Flow) to the prompt by searching in the picker
  async function addAssetToPromptByName(assetName) {
    log(`addAsset: opening picker for "${assetName}"…`);

    const opened = await clickPlusButton();
    if (!opened) { warn(`addAsset: could not open picker for "${assetName}"`); return false; }
    await sleep(900);

    // Find the "Search assets" input specifically inside the asset picker panel
    let searchInput = null;
    for (let i = 0; i < 20; i++) {
      searchInput = Array.from(document.querySelectorAll('input'))
        .find(el => isVisible(el) && /search\s*asset/i.test(el.placeholder || ""));
      // Fallback: any input whose placeholder contains "search"
      if (!searchInput) {
        searchInput = Array.from(document.querySelectorAll('input'))
          .find(el => isVisible(el) && /search/i.test(el.placeholder || "") && el.type !== "hidden");
      }
      if (searchInput) break;
      await sleep(250);
    }

    if (searchInput) {
      // React-controlled input: set the value through the NATIVE setter so
      // React's own value tracker sees the change, then fire one input event.
      // (Assigning .value directly gets reverted by React; char-by-char typing
      // is slow and interleaves if anything else touches the field.)
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
      ).set;
      searchInput.focus();
      nativeSetter.call(searchInput, "");
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(100);
      nativeSetter.call(searchInput, assetName);
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(800);
      log(`addAsset: set search to "${assetName}"`);
    }

    // Find matching item
    let matchedItem = null;
    for (let i = 0; i < 15; i++) {
      const items = Array.from(document.querySelectorAll('[role="listitem"], [role="option"], li, div'))
        .filter(el => isVisible(el) && el.querySelector("img"));

      matchedItem = items.find(el => {
        const txt = el.textContent.trim().toLowerCase();
        return txt === assetName.toLowerCase() || txt.startsWith(assetName.toLowerCase());
      });

      if (!matchedItem && searchInput && items.length > 0 && items.length <= 5) {
        matchedItem = items[0];
      }

      if (matchedItem) break;
      await sleep(300);
    }

    if (!matchedItem) {
      warn(`addAsset: no match found for "${assetName}"`);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep(400);
      return false;
    }

    matchedItem.click();
    log(`addAsset: selected item for "${assetName}"`);
    await sleep(600);

    // Click "Add to Prompt"
    for (let i = 0; i < 10; i++) {
      const addBtn = Array.from(document.querySelectorAll("button"))
        .find(btn => isVisible(btn) && /add to prompt/i.test(btn.textContent));
      if (addBtn) {
        addBtn.click();
        log(`addAsset: "Add to Prompt" clicked for "${assetName}"`);
        await sleep(700);
        return true;
      }
      await sleep(300);
    }

    warn(`addAsset: "Add to Prompt" not found for "${assetName}"`);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  }

  async function injectTextIntoFlowPrompt(el, text, charDelayMs) {
    if (!text) return false;

    // Focus the editor and SELECT ALL existing content so that every injection
    // method (paste, beforeinput, execCommand) REPLACES rather than appends.
    el.focus();
    const initSel = window.getSelection();
    const initRange = document.createRange();
    initRange.selectNodeContents(el); // select all — do NOT collapse
    initSel.removeAllRanges();
    initSel.addRange(initRange);
    await sleep(50);

    // 1. Try synthetic paste
    dispatchSyntheticPaste(el, text);
    await sleep(200);
    if (editorSeemsToContain(el, text)) {
      log("Filled prompt via synthetic paste.");
      return true;
    }

    // 2. Try beforeinput
    log("Text not found, trying beforeinput...");
    const before = new InputEvent("beforeinput", {
      bubbles: true, cancelable: true, composed: true,
      inputType: "insertText", data: text,
    });
    el.dispatchEvent(before);
    el.dispatchEvent(new InputEvent("input", {
      bubbles: true, composed: true,
      inputType: "insertText", data: text,
    }));
    await sleep(200);
    if (editorSeemsToContain(el, text)) {
      log("Filled prompt via insertText beforeinput.");
      return true;
    }

    // 3. Try execCommand insertText — full text at once (instant)
    log("Trying execCommand insertText (full text)...");
    try { document.execCommand("insertText", false, text); } catch {}
    await sleep(200);
    if (editorSeemsToContain(el, text)) {
      log("Filled prompt via execCommand insertText.");
      return true;
    }

    // 4. Try InputEvents per character (last resort — slow but works)
    log("Trying per-character InputEvent insertText...");
    await typeInsertTextEvents(el, text, 0);
    await sleep(200);
    if (editorSeemsToContain(el, text)) {
      log("Filled prompt via synthetic InputEvents.");
      return true;
    }

    log("Prompt verification failed; editor text:", editorPlainText(el).slice(0, 120));
    return false;
  }

  function findCreateButtonByArrowIcon() {
    const candidates = [];
    for (const btn of document.querySelectorAll("button")) {
      if (!isVisible(btn)) continue;
      const icon = btn.querySelector("i.google-symbols");
      if (icon && icon.textContent?.trim() === "arrow_forward") {
        candidates.push(btn);
      }
    }
    if (!candidates.length) return null;
    return candidates.sort(
      (a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom
    )[0];
  }

  /**
   * Find the Create button by its visually-hidden <span> label.
   * Google Flow wraps "Create" in a clip-rect hidden span inside the button.
   */
  function findCreateButtonByHiddenLabel() {
    for (const btn of document.querySelectorAll("button")) {
      if (!isVisible(btn)) continue;
      const spans = btn.querySelectorAll("span");
      for (const span of spans) {
        if (span.textContent?.trim().toLowerCase() === "create") {
          return btn;
        }
      }
    }
    return null;
  }

  /**
   * Consolidated submit button discovery with diagnostic logging.
   */
  function findSubmitButton(selectors) {
    let btn = firstMatch(selectors.submitButton || []);
    if (btn && isVisible(btn)) {
      log("Submit button found via CSS selector.");
      return btn;
    }

    btn = findCreateButtonByArrowIcon();
    if (btn) {
      log("Submit button found via arrow_forward icon.");
      return btn;
    }

    btn = findCreateButtonByHiddenLabel();
    if (btn) {
      log("Submit button found via hidden 'Create' label.");
      return btn;
    }

    for (const b of document.querySelectorAll("button")) {
      if (!isVisible(b)) continue;
      if (b.textContent?.toLowerCase().includes("create")) {
        log("Submit button found via textContent scan.");
        return b;
      }
    }

    warn("Submit button NOT found by any strategy.");
    return null;
  }

  /* ── MAIN world React fiber click ──────────────────────────────────
   * Marks the target element, then asks the background service worker
   * to inject a function via chrome.scripting.executeScript in the
   * MAIN world. This bypasses both CSP and isTrusted checks — the
   * injected code calls React's onClick handler directly.
   * ---------------------------------------------------------------- */

  const FQ_MARKER_ATTR = "data-fq-click-target";
  let fqClickCounter = 0;

  async function clickViaReactFiber(el, mode = "click") {
    const token = String(++fqClickCounter);
    el.setAttribute(FQ_MARKER_ATTR, token);
    try {
      const result = await chrome.runtime.sendMessage({
        type: "REACT_FIBER_CLICK",
        token,
        markerAttr: FQ_MARKER_ATTR,
        mode,
      });
      return result || { ok: false, reason: "no response from background" };
    } catch (e) {
      return { ok: false, reason: String(e?.message || e) };
    } finally {
      el.removeAttribute(FQ_MARKER_ATTR);
    }
  }

  /**
   * Click a button with full pointer/mouse event sequence (synthetic fallback).
   */
  function clickButtonSynthetic(btn) {
    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const common = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: cx,
      clientY: cy,
      button: 0,
      buttons: 1,
    };
    btn.dispatchEvent(new PointerEvent("pointerdown", { ...common, pointerId: 1, pointerType: "mouse" }));
    btn.dispatchEvent(new MouseEvent("mousedown", common));
    btn.dispatchEvent(new PointerEvent("pointerup", { ...common, pointerId: 1, pointerType: "mouse" }));
    btn.dispatchEvent(new MouseEvent("mouseup", common));
    btn.dispatchEvent(new MouseEvent("click", { ...common, buttons: 0 }));
    btn.click();
  }

  /**
   * Try all click strategies: React fiber onSubmit → onClick → synthetic events
   */
  async function clickSubmitButton(btn) {
    // Attempt 1: React fiber direct call (bypasses isTrusted entirely)
    const fiberResult = await clickViaReactFiber(btn);
    if (fiberResult.ok) {
      log(`Submit via React fiber: ${fiberResult.method} at depth ${fiberResult.depth}`);
      return true;
    }
    warn("React fiber submit failed:", JSON.stringify(fiberResult));

    // Attempt 2: Full synthetic pointer/mouse event sequence
    warn("Trying synthetic click events (may not work with isTrusted checks)...");
    clickButtonSynthetic(btn);
    return true;
  }

  function submitViaEnter(el) {
    for (const type of ["keydown", "keypress", "keyup"]) {
      el.dispatchEvent(
        new KeyboardEvent(type, {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        })
      );
    }
  }

  async function dismissOptionalOverlays(selectorsConfig) {
    const list = selectorsConfig.dismissOverlays || [];
    for (let i = 0; i < 3; i++) {
      const btn = firstMatch(list);
      if (btn && isVisible(btn)) {
        btn.click();
        await sleep(400);
      } else break;
    }
  }

  let runToken = 0;
  let queueBusy = false;

  /**
   * Instantly hide + dismiss Flow's cosmetic empty-prompt validation toast
   * ("Prompt must be provided" / "Prompt not submitted"). MutationObserver
   * fires synchronously before the next paint, so the toast is hidden before
   * the user ever sees it. Runs for 8s after each submit.
   */
  let toastObserver = null; // only one active at a time
  function suppressValidationToast(capturedToken) {
    const TOAST_RE = /prompt (must be provided|not submitted)/i;

    function zap() {
      const dismiss = Array.from(document.querySelectorAll("button"))
        .find(b => b.textContent.trim() === "Dismiss");
      if (!dismiss) return false;
      // Walk up to the toast container and verify it's OUR cosmetic toast —
      // never swallow genuine error toasts.
      let container = null;
      let node = dismiss;
      for (let up = 0; up < 8 && node.parentElement; up++) {
        node = node.parentElement;
        if (TOAST_RE.test(node.textContent || "")) { container = node; break; }
      }
      if (!container) return false;
      // Hide in this same frame (before paint), then dismiss properly so
      // Flow's toast state is cleared.
      container.style.visibility = "hidden";
      dismiss.click();
      log("Suppressed validation toast.");
      return true;
    }

    if (toastObserver) toastObserver.disconnect();
    const obs = new MutationObserver(() => {
      if (capturedToken !== runToken) { obs.disconnect(); return; }
      zap();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    toastObserver = obs;

    zap(); // in case it already mounted
    setTimeout(() => {
      obs.disconnect();
      if (toastObserver === obs) toastObserver = null;
    }, 8000);
  }

  async function runQueue(payload) {
    // Reject duplicate concurrent calls — happens when content.js is injected
    // a second time mid-run, creating two onMessage listeners that both respond
    // to the same FLOW_BATCH_RUN message.
    if (queueBusy) {
      log("runQueue: already running, ignoring duplicate call.");
      return { error: "busy" };
    }
    queueBusy = true;
    try {
    const token = ++runToken;
    let prompts = (payload.prompts || []).map((p) => String(p).trim()).filter(Boolean);
    const waitMinMs = Math.max(0, payload.waitMinMs ?? 10_000);
    const waitMaxMs = Math.max(waitMinMs, payload.waitMaxMs ?? 30_000);
    const preferEnter = payload.preferEnter === true;
    const charDelayMs   = Math.max(0, payload.charDelayMs ?? 50);
    const refAssetNames = payload.refAssetNames || [];

    /** Only bundled defaults — never merge message-supplied selectors (reduces attack surface). */
    const selectors = globalThis.FLOW_BATCH_DEFAULT_SELECTORS;

    for (let i = 0; i < prompts.length; i++) {
      if (token !== runToken) {
        log("Stopped by user.");
        return { stopped: true, completed: i };
      }

      const text = prompts[i];

      await dismissOptionalOverlays(selectors);

      let input = findFlowPromptEditor();
      if (!input) {
        input = firstMatch(selectors.promptInput || []);
      }
      if (!input || !isVisible(input)) {
        const msg =
          "Could not find prompt field. Open a Flow project tab (…/flow/project/…) and try again.";
        log(msg);
        return { error: msg, completed: i, failedPromptIndex: i };
      }

      // Add matching project assets to the prompt before typing
      for (const assetName of refAssetNames) {
        if (token !== runToken) break;
        await addAssetToPromptByName(assetName);
        // Re-find editor after asset dialog changes focus
        input = findFlowPromptEditor() || firstMatch(selectors.promptInput || []) || input;
        await focusEditorLikeUser(input);
      }

      // Re-find editor (might have changed after asset dialogs) and light-focus it.
      // Use el.focus() only — NOT focusEditorLikeUser — because dispatching a
      // synthetic click on an EMPTY editor bubbles up and triggers Flow's
      // "Prompt must be provided" validation toast before we inject the text.
      input = findFlowPromptEditor() || firstMatch(selectors.promptInput || []) || input;
      input.focus();
      await sleep(50);

      const ok = await injectTextIntoFlowPrompt(input, text, charDelayMs);
      if (!ok) {
        return {
          error:
            "Could not set prompt text in a way Flow accepts. Try entering one prompt manually once, then retry the queue.",
          completed: i,
          failedPromptIndex: i,
        };
      }

      await sleep(200);

      let submitted = false;
      if (!preferEnter) {
        let submit = findSubmitButton(selectors);
        if (submit) {
          // Flow keeps Create disabled until its React state holds the prompt.
          // Clicking while still disabled runs the empty-prompt validation and
          // flashes a "Prompt not submitted" toast — so wait (up to 3s) for the
          // button to enable before clicking. If it never enables, click anyway
          // (generation still works; the toast auto-dismiss below cleans up).
          // Flow re-renders can REPLACE the button node mid-wait — re-find it
          // whenever the held reference detaches, and click the live node.
          for (let w = 0; w < 30; w++) {
            if (!document.body.contains(submit)) {
              submit = findSubmitButton(selectors) || submit;
            }
            const enabled = !submit.disabled && submit.getAttribute("aria-disabled") !== "true";
            if (enabled) break;
            if (token !== runToken) break;
            await sleep(100);
          }
          if (!document.body.contains(submit)) {
            submit = findSubmitButton(selectors) || submit;
          }
          try {
            await clickSubmitButton(submit);
            submitted = true;
            log(`Submitted prompt ${i + 1}/${prompts.length}.`);
          } catch (e) {
            warn(`Click failed for prompt ${i + 1}:`, e?.message || e);
          }
        } else {
          warn(`No submit button found for prompt ${i + 1}, will try Enter.`);
        }
      }
      if (!submitted) {
        submitViaEnter(input);
        log(`Sent Enter to submit (prompt ${i + 1}/${prompts.length})`);
      }

      // Flow's Create onClick holds a stale (empty) prompt reference, so it
      // shows a "Prompt must be provided" / "Prompt not submitted" toast even
      // though the submission itself uses the live state and generation runs
      // fine. The toast is pure noise — suppress it INSTANTLY: a
      // MutationObserver fires the moment the toast node mounts, hides it in
      // the same frame (before paint), then clicks Dismiss to clear Flow's
      // toast state. Active for 8s per submit; stops early if queue stops.
      suppressValidationToast(token);

      if (i < prompts.length - 1) {
        const pause = randomIntInclusive(waitMinMs, waitMaxMs);
        log(`Waiting ${Math.round(pause / 1000)}s before next prompt…`);
        await sleep(pause);
      }
    }

    return { done: true, completed: prompts.length };
    } finally { queueBusy = false; }
  }

  /* ── Generation Settings automation ──────────────────────────────────
   * Drives Flow's settings popup (the chip near the prompt bar showing
   * e.g. "Nano Banana 2 · 1x" or "Video · 6s · 1x"): mode tab, aspect
   * ratio, outputs multiplier, model dropdown, video type & duration.
   * All lookups are by visible text, scoped to the popup container.
   * ------------------------------------------------------------------ */

  function findGenChip() {
    // The chip shows a multiplier like "1x" and sits lowest on screen (the
    // prompt bar is at the bottom). It may be a <button> OR a div[role=button].
    // NOTE: no leading \b — the chip's textContent concatenates without spaces
    // ("Video · 6s1x", "Nano Banana 21x"), and letter→digit is not a regex
    // word boundary, so \b[1-4]x would never match the real chip.
    const MULT_RE = /[1-4]x\b/;
    let cands = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(el => isVisible(el) && MULT_RE.test(el.textContent || ""));
    if (!cands.length) {
      // Fallback: smallest visible leaf-ish element containing the multiplier,
      // clicking it bubbles / fiber-walks up to the real trigger.
      cands = Array.from(document.querySelectorAll("div, span"))
        .filter(el => isVisible(el) && MULT_RE.test(el.textContent || "") &&
                      el.childElementCount <= 4 && (el.textContent || "").trim().length < 60);
    }
    if (!cands.length) return null;
    return cands.sort(
      (a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom
    )[0];
  }

  function findGenPopup() {
    // Smallest container holding visible "Image" AND "Video" tab buttons
    // plus a multiplier button — that's the settings popup.
    const imageBtns = Array.from(document.querySelectorAll("button"))
      .filter(b => isVisible(b) && b.textContent.trim().endsWith("Image"));
    for (const ib of imageBtns) {
      let node = ib;
      for (let up = 0; up < 12 && node.parentElement; up++) {
        node = node.parentElement;
        const btns = Array.from(node.querySelectorAll("button")).filter(isVisible);
        const hasVideo = btns.some(b => b.textContent.trim().endsWith("Video"));
        const hasMult  = btns.some(b => /^[1-4]x$/.test(b.textContent.trim()));
        if (hasVideo && hasMult) return node;
      }
    }
    return null;
  }

  async function clickInPopup(popup, matchFn) {
    // Real <button>s and ARIA button-ish roles first
    let btn = Array.from(popup.querySelectorAll(
      'button, [role="button"], [role="radio"], [role="tab"], [role="menuitemradio"], [role="option"]'
    )).find(b => isVisible(b) && matchFn(b.textContent.trim()));
    // Fallback: some pills are plain divs/spans — smallest visible leaf whose
    // text matches; clicks bubble and the fiber walk goes up to the handler.
    if (!btn) {
      const leaves = Array.from(popup.querySelectorAll("div, span, label"))
        .filter(el => isVisible(el) && el.childElementCount <= 3 &&
                      (el.textContent || "").trim().length < 25 &&
                      matchFn(el.textContent.trim()));
      // deepest (most specific) match
      btn = leaves.sort((a, b) => {
        let da = 0, db = 0, n;
        for (n = a; n; n = n.parentElement) da++;
        for (n = b; n; n = n.parentElement) db++;
        return db - da;
      })[0];
    }
    if (!btn) return false;
    // Some Flow controls ignore untrusted events — reinforce with the React
    // fiber press. Selecting a pill/tab twice is idempotent, so both firing
    // is harmless; either one landing is enough.
    clickButtonSynthetic(btn);
    await clickViaReactFiber(btn, "press");
    return true;
  }

  async function applyGenSettings(s) {
    const applied = [];
    const missed  = [];

    // 1. Open the popup (unless already open)
    let popup = findGenPopup();
    if (!popup) {
      const chip = findGenChip();
      if (!chip) {
        log("applyGenSettings: chip NOT FOUND");
        return { ok: false, reason: "chip not found", missed: ["popup"] };
      }
      log("applyGenSettings: chip =", chip.tagName, JSON.stringify((chip.textContent || "").trim().slice(0, 60)));
      // Flow ignores untrusted clicks on this chip (like the Create button) —
      // try a synthetic click first, then fall back to the React-fiber click
      // which invokes the onClick handler directly and bypasses isTrusted.
      clickButtonSynthetic(chip);
      for (let i = 0; i < 8 && !popup; i++) { await sleep(150); popup = findGenPopup(); }
      let fiberRes = null;
      if (!popup) {
        // Popover triggers open on pointer-down — fire the full press sequence
        fiberRes = await clickViaReactFiber(chip, "press");
        log("Gen chip fiber press:", JSON.stringify(fiberRes));
        for (let i = 0; i < 12 && !popup; i++) { await sleep(150); popup = findGenPopup(); }
      }
      if (!popup) {
        const why = fiberRes ? `chip press: ${fiberRes.method || fiberRes.reason}` : "chip clicked";
        return { ok: false, reason: `popup did not open (${why})`, missed: ["popup"] };
      }
    }

    async function step(name, fn) {
      let ok = await fn();
      if (!ok) {
        // Popup may still be re-rendering from the previous click — retry once
        await sleep(400);
        popup = findGenPopup() || popup;
        ok = await fn();
      }
      if (!ok) {
        const texts = Array.from(popup.querySelectorAll('button, [role="button"], [role="radio"], [role="tab"]'))
          .filter(isVisible).map(b => b.textContent.trim()).slice(0, 30);
        log(`applyGenSettings: step "${name}" MISS; popup clickables =`, JSON.stringify(texts));
      }
      (ok ? applied : missed).push(name);
      if (ok) await sleep(400);
      // Popup content re-renders after each click — re-scope
      popup = findGenPopup() || popup;
    }

    // 2. Mode tab (icon glyph may prefix the label — match by suffix)
    const modeLabel = s.mode === "video" ? "Video" : "Image";
    await step("mode", () => clickInPopup(popup, t => t.endsWith(modeLabel)));

    // 3. Video sub-type (Frames | Ingredients)
    if (s.mode === "video" && s.videoType) {
      await step("type", () => clickInPopup(popup, t => t.endsWith(s.videoType)));
    }

    // 4. Aspect ratio (button text = icon glyph + "16:9" → suffix match)
    if (s.aspect) {
      await step("aspect", () => clickInPopup(popup, t => t === s.aspect || t.endsWith(s.aspect)));
    }

    // 5. Outputs multiplier — Flow labels the SELECTED pill "2x" but
    // unselected ones "x2" (reversed). Match both forms.
    if (s.outputs) {
      const n = s.outputs.replace(/x/gi, "");        // "2x" -> "2"
      const alt = "x" + n;                            // "x2"
      await step("outputs", () => clickInPopup(popup, t =>
        t === s.outputs || t === alt || t.endsWith(s.outputs) || t.endsWith(alt)));
    }

    // 6. Model dropdown (options may render in a portal outside the popup)
    if (s.model) {
      let modelOk = false;
      // Always open the dropdown and click the target option — re-selecting
      // the current model is harmless, and text shortcuts are substring traps
      // ("Nano Banana 2" is a substring of "Nano Banana 2 Lite").
      const caret = Array.from(popup.querySelectorAll("i, svg, span"))
        .find(el => isVisible(el) &&
          /arrow_drop_down|expand_more|keyboard_arrow_down|▾|▼/.test((el.textContent || "").trim()));
      const trigger = caret ? (caret.closest("button") || caret.parentElement) : null;
      if (trigger) {
        // Options carry an icon/emoji prefix ("🍌 Nano Banana 2") — match by
        // suffix; unambiguous since no model name is a suffix of another.
        const findOpt = () =>
          Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], li, button'))
            .find(el => isVisible(el) && el.textContent.trim().endsWith(s.model) &&
                        el !== trigger && !trigger.contains(el) && !el.contains(trigger));
        clickButtonSynthetic(trigger);
        let opt = null;
        for (let i = 0; i < 5 && !opt; i++) { await sleep(200); opt = findOpt(); }
        if (!opt) {
          // Untrusted click ignored — invoke the trigger's React handlers directly
          await clickViaReactFiber(trigger, "press");
          for (let i = 0; i < 8 && !opt; i++) { await sleep(200); opt = findOpt(); }
        }
        if (opt) {
          clickButtonSynthetic(opt);
          await clickViaReactFiber(opt, "press"); // reinforce; no-op if menu already closed
          modelOk = true;
          await sleep(500);
        } else {
          // Close the stray dropdown so it doesn't block later clicks
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          await sleep(250);
        }
      }
      (modelOk ? applied : missed).push("model");
      popup = findGenPopup() || popup;
    }

    // 7. Video duration — "4s" / "6s" / "8s" / "10s". Cover a reversed
    // "s4" label form too (Flow labels selected/unselected pills differently).
    if (s.mode === "video" && s.duration) {
      const dn = s.duration.replace(/s/gi, "");      // "6s" -> "6"
      const dalt = "s" + dn;                          // "s6"
      await step("duration", () => clickInPopup(popup, t =>
        t === s.duration || t === dalt || t.endsWith(s.duration) || t.endsWith(dalt)));
    }

    // 8. Close the popup
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(300);
    if (findGenPopup()) {
      const chip = findGenChip();
      if (chip) {
        clickButtonSynthetic(chip);
        await sleep(300);
        if (findGenPopup()) { await clickViaReactFiber(chip, "press"); await sleep(300); }
      }
    }

    const chip = findGenChip();
    const chipText = chip ? chip.textContent.trim() : "";
    log(`applyGenSettings: applied=[${applied}] missed=[${missed}] chip="${chipText}"`);
    return { ok: missed.length === 0, applied, missed, chip: chipText };
  }

  /* ── Cumulative media memory ─────────────────────────────────────────
   * Flow virtualizes its grid: scrolling mounts/unmounts tiles, so any
   * "what's new" diff against a single snapshot misfires when the user
   * scrolls mid-generation (old tiles remount with srcs the snapshot never
   * saw → false "new" → wrong downloads). Remember EVERY media URL ever
   * observed in this tab; anything in this set can never be "new".
   * Recording pauses during an active generation wait so the genuinely new
   * image isn't recorded before it's detected.
   * ------------------------------------------------------------------ */
  const seenMediaSrcs = new Set();
  let generationWaitActive = false;


  /**
   * All generated-media tile images. Primary: the classic alt attribute.
   * Fallback union: sizable Google-CDN content images — newer Flow builds
   * label tiles with the prompt text instead of alt="Generated image",
   * which made the alt-only selector match nothing and stalled detection.
   * Avatars/icons are excluded by the size threshold; sample-card images
   * are included consistently on both the before-snapshot and the diff,
   * so they cancel out.
   */
  function getTileImgs() {
    const out = [];
    const seen = new Set();
    for (const img of document.querySelectorAll("img")) {
      if (seen.has(img)) continue;
      const src = img.src || "";
      const isAlt = img.alt === "Generated image";
      let ok = isAlt;
      if (!ok && src.startsWith("http") &&
          /googleusercontent\.com|googleapis\.com/.test(src)) {
        const r = img.getBoundingClientRect();
        ok = r.width >= 80 && r.height >= 80;
      }
      if (ok) { out.push(img); seen.add(img); }
    }
    return out;
  }

  function recordVisibleMedia() {
    for (const img of getTileImgs()) {
      if (img.src && img.src.startsWith("http")) seenMediaSrcs.add(img.src);
    }
    for (const v of document.querySelectorAll("video")) {
      const s = v.src || v.querySelector("source")?.src || "";
      if (s && s.startsWith("http")) seenMediaSrcs.add(s);
    }
  }

  // Continuously learn tiles the user scrolls past (except during waits).
  // BATTERY FIX: Flow mutates the DOM constantly (animations, counters), and
  // scanning every img/video on every mutation burns CPU/battery nonstop —
  // coalesce bursts into one scan per 1.5s.
  let recordScanQueued = false;
  new MutationObserver(() => {
    if (generationWaitActive || recordScanQueued) return;
    recordScanQueued = true;
    setTimeout(() => {
      recordScanQueued = false;
      if (!generationWaitActive) recordVisibleMedia();
    }, 1500);
  }).observe(document.documentElement, { childList: true, subtree: true });
  recordVisibleMedia();

  // Count failure cards by the "Retry" span inside a button
  // This span ONLY appears on Google Flow failure cards
  function countFailCards() {
    var n = 0;
    document.querySelectorAll("button span").forEach(function(span) {
      if (span.children.length === 0 && span.textContent.trim() === "Retry") n++;
    });
    return n;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) {
      return;
    }
    if (message?.type === "FLOW_BATCH_PING") {
      sendResponse({ ok: true, href: location.href });
      return;
    }
    if (message?.type === "FLOW_BATCH_RUN") {
      runQueue(message)
        .then((result) => sendResponse(result))
        .catch((e) => sendResponse({ error: String(e?.message || e) }));
      return true;
    }
    if (message?.type === "FLOW_BATCH_STOP") {
      runToken++;
      queueBusy = false;
      generationWaitActive = false; // resume cumulative media recording
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "FLOW_APPLY_GEN_SETTINGS") {
      applyGenSettings(message.settings || {})
        .then(res => sendResponse(res))
        .catch(e => sendResponse({ ok: false, reason: String(e?.message || e), missed: ["error"] }));
      return true;
    }

    if (message?.type === "FLOW_GET_AGENT_MODE") {
      const agentBtn = Array.from(document.querySelectorAll("button[aria-pressed]"))
        .find(b => /agent/i.test(b.textContent));
      const isOn = agentBtn?.getAttribute("aria-pressed") === "true";
      const found = !!agentBtn;
      sendResponse({ found, isOn });
      return;
    }

    if (message?.type === "FLOW_DISABLE_AGENT_MODE") {
      (async function () {
        const getAgentBtn = () =>
          Array.from(document.querySelectorAll("button[aria-pressed]"))
            .find(b => /agent/i.test(b.textContent));

        const btn = getAgentBtn();

        // Already off or not found
        if (!btn || btn.getAttribute("aria-pressed") !== "true") {
          sendResponse({ ok: true, skipped: true });
          return;
        }

        // Click in main world via background scripting (bypasses isolated world)
        const clickRes = await chrome.runtime.sendMessage({ type: "MAIN_WORLD_AGENT_CLICK" });
        log("Agent click result:", JSON.stringify(clickRes));

        // Wait up to 3s for aria-pressed to flip to false
        for (let i = 0; i < 15; i++) {
          await sleep(200);
          const b = getAgentBtn();
          if (!b || b.getAttribute("aria-pressed") === "false") {
            sendResponse({ ok: true });
            return;
          }
        }

        sendResponse({ ok: false, error: "Agent mode still on after click" });
      })();
      return true;
    }

    if (message?.type === "FLOW_GET_TILE_COUNT") {
      // Snapshot taken right before a submit. Fold everything currently
      // mounted into the cumulative seen-set, and return the current srcs —
      // FLOW_WAIT_GENERATION diffs against seen ∪ snapshot.
      recordVisibleMedia();
      const tileImgs = getTileImgs();
      const imgSrcs = tileImgs
        .map(img => img.src)
        .filter(src => src && src.startsWith("http"));
      const vidSrcs = Array.from(document.querySelectorAll("video"))
        .map(v => v.src || v.querySelector("source")?.src || "")
        .filter(src => src && src.startsWith("http"));
      sendResponse({
        count: tileImgs.length,
        videoCount: document.querySelectorAll("video").length,
        failCount: countFailCards(),
        srcs: imgSrcs,
        videoSrcs: vidSrcs,
      });
      return;
    }

    if (message?.type === "FLOW_WAIT_GENERATION") {
      const beforeCount      = message.beforeCount      ?? 0;
      const beforeVideoCount = message.beforeVideoCount ?? 0;
      const beforeFailCount  = message.beforeFailCount  ?? 0;
      const timeout          = message.timeoutMs        ?? 300000;
      // Known media = everything ever seen in this tab (cumulative) plus the
      // snapshot sent by the panel. Anything in here can never be "new" —
      // this is what makes user scrolling during generation safe.
      const knownImgSet = new Set(message.beforeSrcs      || []);
      const knownVidSet = new Set(message.beforeVideoSrcs || []);
      for (const s of seenMediaSrcs) { knownImgSet.add(s); knownVidSet.add(s); }
      // Fresh project: no known media at all → count-based detection is safe
      const freshProject = knownImgSet.size === 0 && knownVidSet.size === 0;

      // Pause the cumulative recorder so the genuinely new tile isn't
      // recorded as "seen" before we detect it. Re-enabled in finish().
      generationWaitActive = true;

      // A NEW generation is PREPENDED (top of grid). Accept only the
      // contiguous run of unknown srcs at the top, stopping at the first
      // known src. Old tiles remounting from a user scroll either appear
      // BELOW a known tile (excluded by contiguity) or fill the whole
      // window with unknowns (excluded by the sawKnown check). A single
      // generation yields at most a few outputs — an implausibly large
      // "new" run means the diff is unreliable, so reject it.
      const MAX_NEW_PER_GEN = 8;
      function contiguousNewFromTop(elements, getSrc, knownSet, allowAllUnknown) {
        const out = [];
        let sawKnown = false;
        for (const el of elements) {
          const src = getSrc(el);
          if (!src || !src.startsWith('http')) continue;
          if (knownSet.has(src)) { sawKnown = true; break; }
          out.push(src);
          if (out.length > MAX_NEW_PER_GEN) return [];
        }
        // All-unknown window: on a POPULATED grid this means the user
        // scrolled to a region of old tiles — must be rejected, even small
        // runs (scrolling can mount just a few unknown tiles at the top).
        // Only a near-EMPTY baseline (fresh project, where Flow swaps the
        // sample-card UI for the first generated tiles) may accept an
        // all-unknown run — that's what allowAllUnknown encodes.
        if (!sawKnown && knownSet.size > 0 && !allowAllUnknown) return [];
        return out;
      }

      // All-unknown windows are only trusted when the grid was near-empty at
      // submit time (fresh project) — a populated grid means it's a scroll.
      const allowAllUnknownImgs = beforeCount <= 4;
      const allowAllUnknownVids = beforeVideoCount <= 4;

      function getNewImgSrcs() {
        return contiguousNewFromTop(
          getTileImgs(),
          img => img.src,
          knownImgSet,
          allowAllUnknownImgs
        );
      }

      function getNewVideoSrcs() {
        return contiguousNewFromTop(
          document.querySelectorAll('video'),
          v => v.src || v.querySelector('source')?.src || '',
          knownVidSet,
          allowAllUnknownVids
        );
      }

      function getRealImageUrls() {
        const bySrc = getNewImgSrcs();
        if (bySrc.length > 0) return bySrc;
        // Count-slice fallback ONLY on a fresh project (nothing known to
        // diff against). Never on a populated grid — scrolling changes the
        // mounted-tile count and the slice would grab old images.
        if (!freshProject) return [];
        const allImgs = getTileImgs()
          .filter(img => img.src && img.src.startsWith('http'));
        const newCount = allImgs.length - beforeCount;
        if (newCount <= 0) return [];
        return allImgs.slice(0, newCount).map(img => img.src);
      }

      function getRealVideoUrls() {
        const bySrc = getNewVideoSrcs();
        if (bySrc.length > 0) return bySrc;
        if (!freshProject) return [];
        const allVids = Array.from(document.querySelectorAll('video'))
          .map(v => v.src || v.querySelector('source')?.src || '')
          .filter(src => src && src.startsWith('http'));
        const newCount = allVids.length - beforeVideoCount;
        if (newCount <= 0) return [];
        return allVids.slice(0, newCount);
      }

      function hasNewMedia(elapsed) {
        // Count-based trigger only on a fresh project — on a populated,
        // virtualized grid the count changes whenever the user scrolls.
        if (freshProject) {
          const imgs = getTileImgs().length;
          const vids = document.querySelectorAll('video').length;
          if (imgs > beforeCount || vids > beforeVideoCount) return true;
        }
        // Src-diff only after the settle period — a lazy-loading OLD img
        // gaining its src right after submit must not count as new.
        if (elapsed >= SETTLE_MS) {
          return getNewImgSrcs().length > 0 || getNewVideoSrcs().length > 0;
        }
        return false;
      }

      // Wait for the new media's src to fully load, then return URLs
      async function getNewUrlsAfterLoad() {
        // Retry until srcs load (up to 500ms × 5 — new tiles at grid top are
        // typically in view; avoid scrollIntoView, it fights the user's scroll)
        for (let attempt = 0; attempt < 5; attempt++) {
          const urls = [...getRealImageUrls(), ...getRealVideoUrls()];
          if (urls.length > 0) return urls;
          await sleep(500);
        }
        return [...getRealImageUrls(), ...getRealVideoUrls()];
      }

      function hasNewFailure() {
        return countFailCards() > beforeFailCount;
      }

      let resolved = false;
      const startedAt = Date.now();
      const SETTLE_MS = 4000; // ignore failures for first 4s after submit

      function finish(result) {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        clearInterval(pollInterval);
        observer.disconnect();
        // Fold the detected media into the cumulative memory and resume the
        // recorder — from this moment these URLs are "seen", never "new".
        if (result?.newUrls) for (const u of result.newUrls) seenMediaSrcs.add(u);
        generationWaitActive = false;
        recordVisibleMedia();
        try { sendResponse(result); } catch { /* panel closed mid-wait */ }
      }

      async function checkAndFinish() {
        if (resolved) return;
        const elapsed = Date.now() - startedAt;
        if (hasNewMedia(elapsed)) {
          const urls = await getNewUrlsAfterLoad();
          finish({ done: true, newUrls: urls });
        } else if (elapsed >= SETTLE_MS && hasNewFailure()) {
          // Only check for failures after settle period to avoid false positives
          finish({ failed: true });
        }
      }

      const timer = setTimeout(() => finish({ timeout: true }), timeout);

      log(`WAIT start: beforeCount=${beforeCount} beforeVid=${beforeVideoCount} known=${knownImgSet.size} fresh=${freshProject}`);

      // Poll every 3s (videos take longer)
      let waitTick = 0;
      const pollInterval = setInterval(() => {
        // Heartbeat diagnostics every ~9s so a stall is self-explaining
        if (++waitTick % 3 === 0) {
          const tiles = getTileImgs();
          const newSrcs = getNewImgSrcs();
          log(`WAIT t=${Math.round((Date.now() - startedAt) / 1000)}s: imgs=${tiles.length} (before=${beforeCount}) newSrc=${newSrcs.length} vids=${document.querySelectorAll("video").length} fails=${countFailCards()} known=${knownImgSet.size}`);
          if (newSrcs.length === 0 && tiles.length > 0) {
            log("WAIT top imgs:", JSON.stringify(tiles.slice(0, 3).map(i => ({
              alt: (i.alt || "").slice(0, 25),
              src: (i.src || "").slice(0, 60),
              known: knownImgSet.has(i.src),
            }))));
          }
        }
        checkAndFinish();
      }, 3000);

      // MutationObserver for fast detection — but respects settle period.
      // BATTERY FIX: throttled to one check per 500ms — Flow's DOM mutates
      // continuously and an unthrottled callback burns CPU all wait long.
      let lastMutCheck = 0;
      const observer = new MutationObserver(() => {
        const now = Date.now();
        if (now - lastMutCheck < 500) return;
        lastMutCheck = now;
        checkAndFinish();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["alt", "src"],
      });

      return true;
    }

  });

  log("Content script ready on", location.href);
})();
