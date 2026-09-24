// Podešavanja pristupačnosti — pamte se na uređaju (localStorage, uz try/catch).
export const DEFAULT_SETTINGS = {
  voice: true,          // glasovno vođenje
  sounds: true,         // zvučni efekti (pisak, okidač, uspeh, greška)
  countdown: 'voice',   // 'voice' | 'beep'
  vibration: true,
  largeText: false,
};
const KEY = 'pd-a11y-v1';

export function loadSettings(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const out = { ...DEFAULT_SETTINGS };
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (typeof parsed[k] === typeof DEFAULT_SETTINGS[k]) out[k] = parsed[k];
    }
    if (!['voice', 'beep'].includes(out.countdown)) out.countdown = DEFAULT_SETTINGS.countdown;
    return out;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify(settings)); } catch { /* privatni režim i sl. */ }
}
