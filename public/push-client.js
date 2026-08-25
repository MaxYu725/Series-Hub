import { loadTrackedShowIds } from "./tracking.js";

export const PUSH_MANAGEMENT_STORAGE_KEY = "series-hub-push-management-v1";

export function normalizePushManagement(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const manageToken = typeof value.manageToken === "string" ? value.manageToken : "";
  const endpointHash = typeof value.endpointHash === "string" ? value.endpointHash : "";
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(manageToken)) return null;
  if (!/^[a-f0-9]{64}$/.test(endpointHash)) return null;
  return {
    manageToken,
    endpointHash,
    registeredAt: typeof value.registeredAt === "string" ? value.registeredAt : null
  };
}

export function loadPushManagement(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(PUSH_MANAGEMENT_STORAGE_KEY);
    if (!raw) return null;
    return normalizePushManagement(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function savePushManagement(value, storage = globalThis.localStorage) {
  const normalized = normalizePushManagement(value);
  if (!normalized) return null;
  try {
    storage?.setItem?.(PUSH_MANAGEMENT_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Browser PushManager remains authoritative even if local storage is unavailable.
  }
  return normalized;
}

export function clearPushManagement(storage = globalThis.localStorage) {
  try {
    storage?.removeItem?.(PUSH_MANAGEMENT_STORAGE_KEY);
  } catch {
    // Ignore storage failures; server deletion is the privacy boundary.
  }
}

export function base64urlToUint8Array(value) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function currentTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export async function fetchPushCapability() {
  const response = await fetch("/api/push/public-key", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || `Push capability ${response.status}`);
  return data;
}

export async function getPushRegistration() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("push_not_supported");
  }
  await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export async function subscribeBrowser(publicKey) {
  const registration = await getPushRegistration();
  const expectedKey = base64urlToUint8Array(publicKey);
  let subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    const existingKey = subscription.options?.applicationServerKey;
    const existing = existingKey ? new Uint8Array(existingKey) : null;
    const sameKey = existing && existing.length === expectedKey.length && existing.every((byte, index) => byte === expectedKey[index]);
    if (!sameKey) {
      await subscription.unsubscribe();
      subscription = null;
    }
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: expectedKey
    });
  }
  return subscription;
}

export async function registerPushSubscription({ publicKey, titleRegion, showIds = loadTrackedShowIds() }) {
  const subscription = await subscribeBrowser(publicKey);
  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      showIds,
      timezone: currentTimezone(),
      titleRegion
    })
  });
  const data = await response.json();
  if (!response.ok || data?.ok !== true) throw new Error(data?.error || `Push registration ${response.status}`);
  savePushManagement({
    manageToken: data.manageToken,
    endpointHash: data.endpointHash,
    registeredAt: new Date().toISOString()
  });
  return { data, subscription };
}

export async function updatePushSubscription({ manageToken, titleRegion, showIds = loadTrackedShowIds() }) {
  const response = await fetch("/api/push/subscription", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${manageToken}`
    },
    body: JSON.stringify({ showIds, timezone: currentTimezone(), titleRegion })
  });
  const data = await response.json();
  if (!response.ok || data?.ok !== true) throw new Error(data?.error || `Push update ${response.status}`);
  return data;
}

export async function deletePushSubscription(manageToken) {
  const response = await fetch("/api/push/subscription", {
    method: "DELETE",
    headers: { authorization: `Bearer ${manageToken}` }
  });
  const data = await response.json();
  if (!response.ok || data?.ok !== true) throw new Error(data?.error || `Push deletion ${response.status}`);

  try {
    const registration = await getPushRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
  } finally {
    clearPushManagement();
  }
  return data;
}
