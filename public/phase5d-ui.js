import { loadTrackedShowIds, TRACKING_STORAGE_KEY } from "./tracking.js";
import {
  clearPushManagement,
  deletePushSubscription,
  fetchPushCapability,
  loadPushManagement,
  registerPushSubscription,
  updatePushSubscription
} from "./push-client.js";

function boot() {
  const myButton = document.querySelector("#my-shows-filter");
  const panelHeading = document.querySelector(".panel-heading");
  const showGrid = document.querySelector("#show-grid");
  const regionSelect = document.querySelector("#title-region-select");
  if (!myButton || !panelHeading || !showGrid || !regionSelect) return;

  const panel = document.createElement("section");
  panel.className = "push-settings";
  panel.hidden = true;
  panel.setAttribute("aria-label", "背景通知設定");

  const copy = document.createElement("div");
  copy.className = "push-settings-copy";
  const title = document.createElement("strong");
  title.textContent = "背景通知";
  const status = document.createElement("p");
  status.textContent = "正在檢查通知功能…";
  copy.append(title, status);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "push-settings-button";
  button.textContent = "開啟通知";
  panel.append(copy, button);
  panelHeading.insertAdjacentElement("afterend", panel);

  let capability = null;
  let busy = false;
  let syncTimer = null;

  function active() {
    return myButton.classList.contains("active");
  }

  function titleRegion() {
    return ["HK", "TW", "CN"].includes(regionSelect.value) ? regionSelect.value : "HK";
  }

  function supportsPush() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  function setBusy(value) {
    busy = value;
    button.disabled = value || button.dataset.permanentDisabled === "true";
  }

  function setDisabled(value) {
    button.dataset.permanentDisabled = value ? "true" : "false";
    button.disabled = value || busy;
  }

  async function renderState() {
    if (!active()) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;

    if (!supportsPush()) {
      status.textContent = "目前瀏覽器不支援背景 Web Push；我的劇集及追劇狀態不受影響。";
      button.textContent = "瀏覽器不支援";
      setDisabled(true);
      return;
    }

    try {
      capability = await fetchPushCapability();
    } catch {
      status.textContent = "通知設定暫時無法讀取；其他劇集功能仍可正常使用。";
      button.textContent = "稍後重試";
      setDisabled(false);
      return;
    }

    if (!capability.enabled) {
      status.textContent = "裝置通知登記目前暫停；我的劇集及追劇狀態仍只保存在瀏覽器。";
      button.textContent = "尚未開放";
      setDisabled(true);
      return;
    }

    if (!capability.configured || !capability.publicKey) {
      status.textContent = "通知金鑰尚未完成設定；追蹤資料仍只保存在目前瀏覽器。";
      button.textContent = "尚未設定";
      setDisabled(true);
      return;
    }

    const management = loadPushManagement();
    if (management) {
      const count = loadTrackedShowIds().length;
      status.textContent = `此裝置已開啟通知；如追蹤劇集有可靠逐集播映時間，Series Hub 會在約 24 小時前提醒。伺服器只保存 Push 裝置資料及 ${count} 個已選劇集 ID，不保存追劇狀態或搜尋紀錄。`;
      button.textContent = "關閉通知";
      setDisabled(false);
      return;
    }

    const count = loadTrackedShowIds().length;
    status.textContent = count > 0
      ? `開啟後只會上傳此裝置的 Push subscription 及目前 ${count} 個追蹤劇集 ID；有可靠逐集播映時間時會在約 24 小時前提醒。追劇狀態仍留在瀏覽器。`
      : "先加入至少一套「我的劇集」才可開啟背景通知。";
    button.textContent = "開啟通知";
    setDisabled(count === 0);
  }

  async function syncSubscription() {
    const management = loadPushManagement();
    if (!management || !capability?.enabled) return;
    try {
      await updatePushSubscription({
        manageToken: management.manageToken,
        titleRegion: titleRegion(),
        showIds: loadTrackedShowIds()
      });
      if (active()) await renderState();
    } catch (error) {
      if (["subscription_not_found", "management_token_required"].includes(error?.message)) {
        clearPushManagement();
      }
      console.error("Push subscription sync failed", error);
      if (active()) {
        status.textContent = "通知清單同步失敗；我的劇集仍保留在瀏覽器，可稍後重試。";
      }
    }
  }

  function scheduleSync() {
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(syncSubscription, 350);
  }

  button.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    try {
      const management = loadPushManagement();
      if (management) {
        status.textContent = "正在刪除此裝置的通知訂閱…";
        await deletePushSubscription(management.manageToken);
        status.textContent = "背景通知已關閉；伺服器裝置訂閱及劇集映射已刪除。";
        await renderState();
        return;
      }

      capability = await fetchPushCapability();
      if (!capability.enabled || !capability.publicKey) throw new Error("push_not_ready");
      const showIds = loadTrackedShowIds();
      if (showIds.length === 0) throw new Error("no_tracked_shows");

      status.textContent = "瀏覽器將詢問通知權限；只有你按下此按鈕後才會出現權限提示。";
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error(`notification_permission_${permission}`);

      status.textContent = "正在建立此裝置的通知訂閱…";
      await registerPushSubscription({
        publicKey: capability.publicKey,
        titleRegion: titleRegion(),
        showIds
      });
      status.textContent = "通知訂閱已建立；有可靠逐集播映時間時，Series Hub 會在約 24 小時前發送提醒。";
      await renderState();
    } catch (error) {
      const code = error?.message || String(error);
      if (code === "no_tracked_shows") status.textContent = "先加入至少一套「我的劇集」再開啟通知。";
      else if (code.startsWith("notification_permission_")) status.textContent = "通知權限未獲允許；Series Hub 不會重複自動要求。";
      else status.textContent = "通知設定未完成；我的劇集及追劇狀態沒有受影響。";
      console.error(error);
    } finally {
      setBusy(false);
      if (active()) await renderState();
    }
  });

  window.addEventListener("series-hub-tracking-changed", scheduleSync);
  window.addEventListener("storage", (event) => {
    if (event.key === TRACKING_STORAGE_KEY) scheduleSync();
  });
  regionSelect.addEventListener("change", scheduleSync);

  const observer = new MutationObserver(renderState);
  observer.observe(myButton, { attributes: true, attributeFilter: ["class"] });
  renderState();
}

if (typeof document !== "undefined" && typeof window !== "undefined") boot();
