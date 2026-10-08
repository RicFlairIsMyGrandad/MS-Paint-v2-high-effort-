(() => {
  let started = false;
  const showError = async (message) => {
    window.desktop?.reportError({ message });
    if (started) return;
    let panel = document.getElementById("startup-status");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "startup-status";
      panel.style.cssText = "position:fixed;inset:40px;z-index:99999;background:white;padding:32px;font:16px Segoe UI,sans-serif;overflow:auto";
      document.body.append(panel);
    }
    panel.replaceChildren();
    const heading = document.createElement("h1"); heading.textContent = "PaintPlus could not start";
    const detail = document.createElement("p"); detail.textContent = message;
    const hint = document.createElement("p");
    hint.textContent = "Try restarting the app. The local startup log records the error so it can be diagnosed.";
    const log = document.createElement("p");
    if (window.desktop?.startupLogPath) log.textContent = "Startup log: " + await window.desktop.startupLogPath();
    const reload = document.createElement("button"); reload.textContent = "Restart editor"; reload.onclick = () => location.reload();
    const close = document.createElement("button"); close.textContent = "Close"; close.style.marginLeft = "12px";
    close.onclick = () => window.desktop ? window.desktop.windowAction("close") : window.close();
    panel.append(heading, detail, hint, log, reload, close);
  };
  const timer = setTimeout(() => showError("The editor did not finish loading. A required local file or graphics driver may have failed."), 15000);
  addEventListener("paintplus:ready", () => {
    started = true; clearTimeout(timer); window.desktop?.rendererReady();
  });
  addEventListener("error", event => {
    if (!(event instanceof ErrorEvent) && !["SCRIPT", "LINK"].includes(event.target?.tagName)) return;
    if (!started) showError(event.message || "A local application script failed to load.");
    else window.desktop?.reportError({ message: event.message, stack: event.error?.stack });
  }, true);
  addEventListener("unhandledrejection", event => showError(event.reason?.message || String(event.reason)));
})();
