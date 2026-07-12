const ALLOWED_HOSTS = new Set([
  'opticarka.com',
  'www.opticarka.com',
  'j35uug-4s.myshopify.com',
]);

export const ALLOWED_ORIGINS = [...ALLOWED_HOSTS].map((h) => `https://${h}`);

// URLSearchParams.get() već dekodira vrednost — NIKAD ne raditi decodeURIComponent ponovo.
export function resolveReturnTarget(returnUrl) {
  if (!returnUrl) return null;
  try {
    const url = new URL(returnUrl);
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}
