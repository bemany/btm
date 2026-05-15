// Web-Push-Subscription-Management im Browser.
// Fragt Erlaubnis an, subscribed beim Push-Service, speichert Subscription auf Server.

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPushPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

async function getVapidKey(): Promise<string> {
  const r = await fetch('/api/push/vapid-key', { credentials: 'include' });
  const j = (await r.json()) as { publicKey: string };
  return j.publicKey ?? '';
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  await fetch('/api/push/subscribe', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
  });
}

export async function subscribeToPush(): Promise<'granted' | 'denied' | 'unsupported' | 'error'> {
  if (!isPushSupported()) return 'unsupported';
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';

    const vapidKey = await getVapidKey();
    if (!vapidKey) return 'error';

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }
    await saveSubscription(sub);
    return 'granted';
  } catch (e) {
    console.warn('[push] subscribe failed:', e);
    return 'error';
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch('/api/push/unsubscribe', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  } catch (e) {
    console.warn('[push] unsubscribe failed:', e);
  }
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}
