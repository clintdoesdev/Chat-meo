(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var botKey = script.getAttribute("data-bot");
  if (!botKey) return;

  var color = script.getAttribute("data-color") || "#FF5C16";
  var position = script.getAttribute("data-position") === "bottom-left" ? "left" : "right";
  var origin;
  try {
    origin = new URL(script.src).origin;
  } catch {
    return;
  }

  // First-party storage (this script runs in the host page's own origin) so a returning
  // visitor keeps their conversation even though the widget iframe itself is a different,
  // third-party origin whose own storage browsers increasingly partition or block.
  var storageKey = "chatmeo_visitor_" + botKey;
  var visitorId;
  try {
    visitorId = window.localStorage.getItem(storageKey);
  } catch {}
  if (!visitorId) {
    visitorId =
      window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : "v-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    try {
      window.localStorage.setItem(storageKey, visitorId);
    } catch {}
  }

  var ROOT_ID = "chatmeo-widget-root";
  if (document.getElementById(ROOT_ID)) return;

  var isMobile = function () {
    return window.innerWidth < 480;
  };

  var style = document.createElement("style");
  style.textContent =
    "#" + ROOT_ID + "{all:initial}" +
    "#" + ROOT_ID + " *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}" +
    "#" + ROOT_ID + " .cmeo-launcher{position:fixed;bottom:20px;" + position + ":20px;width:58px;height:58px;border-radius:50%;border:none;cursor:pointer;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#FF8A3C," + color + ");box-shadow:0 10px 30px -8px rgba(0,0,0,.5);transition:transform .15s ease}" +
    "#" + ROOT_ID + " .cmeo-launcher:hover{transform:scale(1.05)}" +
    "#" + ROOT_ID + " .cmeo-launcher svg{width:28px;height:28px}" +
    "#" + ROOT_ID + " .cmeo-frame-wrap{position:fixed;bottom:88px;" + position + ":20px;width:380px;height:600px;max-height:calc(100vh - 110px);border-radius:18px;overflow:hidden;box-shadow:0 24px 60px -12px rgba(0,0,0,.55);z-index:2147483000;opacity:0;transform:scale(.95);transform-origin:bottom " + position + ";pointer-events:none;transition:opacity .18s ease,transform .18s ease;display:none}" +
    "#" + ROOT_ID + " .cmeo-frame-wrap.cmeo-open{opacity:1;transform:scale(1);pointer-events:auto}" +
    "#" + ROOT_ID + " .cmeo-frame-wrap.cmeo-mobile{bottom:0;left:0;right:0;top:0;width:100%;height:100%;max-height:none;border-radius:0}" +
    "#" + ROOT_ID + " iframe{width:100%;height:100%;border:none;display:block}" +
    "#" + ROOT_ID + " .cmeo-close{position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:50%;border:none;background:rgba(0,0,0,.35);color:#fff;cursor:pointer;display:none;align-items:center;justify-content:center;z-index:1}" +
    "#" + ROOT_ID + " .cmeo-frame-wrap.cmeo-mobile .cmeo-close{display:flex}";
  document.head.appendChild(style);

  var root = document.createElement("div");
  root.id = ROOT_ID;

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "cmeo-launcher";
  launcher.setAttribute("aria-label", "Open chat");
  launcher.innerHTML =
    '<svg viewBox="0 0 64 64" fill="none"><path d="M32 6C17 6 6 16.4 6 30c0 7.8 3.8 14.5 9.9 18.9-.4 3.2-1.7 6.3-4.2 8.7-.7.7-.2 1.9.8 1.8 5.4-.5 10.2-2.6 13.8-5 1.8.3 3.7.5 5.7.5 15 0 26-10.4 26-23.9S47 6 32 6z" fill="#fff"/><circle cx="24" cy="30" r="4.4" fill="' +
    color +
    '"/><circle cx="40" cy="30" r="4.4" fill="' +
    color +
    '"/></svg>';

  var wrap = document.createElement("div");
  wrap.className = "cmeo-frame-wrap";

  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "cmeo-close";
  closeBtn.setAttribute("aria-label", "Close chat");
  closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  var frame = null;
  var open = false;

  function applyResponsiveLayout() {
    if (isMobile()) wrap.classList.add("cmeo-mobile");
    else wrap.classList.remove("cmeo-mobile");
  }

  function setOpen(next) {
    open = next;
    applyResponsiveLayout();
    // On mobile the open widget is full-screen with its own close button — the floating
    // launcher would otherwise sit on top of the input row.
    launcher.style.display = open && isMobile() ? "none" : "flex";
    if (open) {
      wrap.style.display = "block";
      // Lazy-load: the iframe's src (and everything the widget route pulls in) only loads on
      // first open, not just on page load of the host site.
      if (!frame) {
        frame = document.createElement("iframe");
        frame.title = "Chat";
        frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox");
        frame.src = origin + "/widget/" + encodeURIComponent(botKey) + "?v=" + encodeURIComponent(visitorId);
        wrap.appendChild(frame);
      }
      requestAnimationFrame(function () {
        wrap.classList.add("cmeo-open");
      });
    } else {
      wrap.classList.remove("cmeo-open");
      window.setTimeout(function () {
        if (!open) wrap.style.display = "none";
      }, 200);
    }
  }

  launcher.addEventListener("click", function () {
    setOpen(!open);
  });
  closeBtn.addEventListener("click", function () {
    setOpen(false);
  });
  window.addEventListener("resize", function () {
    if (open) {
      applyResponsiveLayout();
      launcher.style.display = isMobile() ? "none" : "flex";
    }
  });

  wrap.appendChild(closeBtn);
  root.appendChild(wrap);
  root.appendChild(launcher);

  function mount() {
    document.body.appendChild(root);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
