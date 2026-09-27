(() => {
  let picking = false;
  let hoverEl = null;
  const HIGHLIGHT_STYLE = "outline: 3px solid #2563eb !important; outline-offset: 1px !important; cursor: crosshair !important;";

  function clearHighlight() {
    if (hoverEl) {
      hoverEl.removeAttribute("data-eaf-outline");
      hoverEl.style.cssText = hoverEl.dataset.eafOldStyle || "";
      delete hoverEl.dataset.eafOldStyle;
      hoverEl = null;
    }
  }

  function onMouseOver(e) {
    if (!picking) return;
    clearHighlight();
    hoverEl = e.target;
    hoverEl.dataset.eafOldStyle = hoverEl.style.cssText;
    hoverEl.style.cssText += HIGHLIGHT_STYLE;
  }

  function buildSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (el.name) {
      const tag = el.tagName.toLowerCase();
      const sameName = document.querySelectorAll(`${tag}[name="${CSS.escape(el.name)}"]`);
      if (sameName.length === 1) return `${tag}[name="${CSS.escape(el.name)}"]`;
    }
    // Fallback: build an nth-child path from the element up to <body>.
    const path = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      let selector = node.tagName.toLowerCase();
      if (node.parentElement) {
        const siblings = Array.from(node.parentElement.children).filter(
          (c) => c.tagName === node.tagName
        );
        if (siblings.length > 1) {
          selector += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }
      path.unshift(selector);
      node = node.parentElement;
    }
    return "body > " + path.join(" > ");
  }

  function onClick(e) {
    if (!picking) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    const selector = buildSelector(el);
    stopPicking();
    chrome.runtime.sendMessage({ type: "EAF_FIELD_PICKED", selector });
  }

  function startPicking() {
    picking = true;
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("click", onClick, true);
  }

  function stopPicking() {
    picking = false;
    clearHighlight();
    document.removeEventListener("mouseover", onMouseOver, true);
    document.removeEventListener("click", onClick, true);
  }

  function setNativeValue(element, value) {
    const proto = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillValues(pairs) {
    const results = [];
    for (const { selector, value } of pairs) {
      try {
        const el = document.querySelector(selector);
        if (!el) {
          results.push({ selector, ok: false, reason: "not found" });
          continue;
        }
        if (el.tagName === "SELECT") {
          el.value = value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (el.isContentEditable) {
          el.textContent = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          setNativeValue(el, value);
        }
        results.push({ selector, ok: true });
      } catch (err) {
        results.push({ selector, ok: false, reason: String(err) });
      }
    }
    return results;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "EAF_START_PICKING") {
      startPicking();
      sendResponse({ ok: true });
    } else if (msg.type === "EAF_CANCEL_PICKING") {
      stopPicking();
      sendResponse({ ok: true });
    } else if (msg.type === "EAF_FILL_VALUES") {
      const results = fillValues(msg.pairs);
      sendResponse({ ok: true, results });
    }
    return true;
  });
})();
