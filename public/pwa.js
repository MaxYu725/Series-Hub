const SERVICE_WORKER_URL = "/push-sw.js";

let deferredInstallPrompt = null;
let updateRegistration = null;
let reloadingForUpdate = false;

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function removeAction() {
  document.getElementById("pwa-action")?.remove();
}

function showAction(label, onClick, kind) {
  removeAction();
  const button = document.createElement("button");
  button.id = "pwa-action";
  button.className = `pwa-action pwa-action-${kind}`;
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick, { once: true });
  document.body.append(button);
}

function exposeConnectionState() {
  const update = () => {
    document.documentElement.dataset.connection = navigator.onLine ? "online" : "offline";
  };
  update();
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
}

function offerUpdate(registration) {
  if (!registration?.waiting || !navigator.serviceWorker.controller) return;
  updateRegistration = registration;
  showAction("有新版本 · 重新載入", () => {
    updateRegistration?.waiting?.postMessage({ type: "SKIP_WAITING" });
  }, "update");
}

function watchForUpdate(registration) {
  offerUpdate(registration);
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") offerUpdate(registration);
    });
  });
}

async function registerAppWorker() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" });
  watchForUpdate(registration);
  registration.update().catch(() => {});
  return registration;
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (isStandalone()) return;
  showAction("安裝 Series Hub", async () => {
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice.catch(() => null);
    removeAction();
  }, "install");
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  removeAction();
});

navigator.serviceWorker?.addEventListener("controllerchange", () => {
  if (reloadingForUpdate) return;
  reloadingForUpdate = true;
  window.location.reload();
});

exposeConnectionState();
registerAppWorker().catch(() => {
  // PWA enhancement must never block the core web app.
});
