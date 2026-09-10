// Client-side "remembered profiles" for the Netflix-style login screen.
// Stored in localStorage only — never carries credentials or session tokens.

const STORAGE_KEY = "bp_profiles";

export interface RememberedProfile {
  id: number | null;
  email: string;
  name: string | null;
  avatar: number | null;
}

export function getRememberedProfiles(): RememberedProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function rememberProfile(profile: RememberedProfile) {
  if (typeof window === "undefined" || !profile.email) return;
  try {
    const existing = getRememberedProfiles().filter((p) => p.email !== profile.email);
    existing.unshift(profile);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, 10)));
  } catch {
    /* localStorage unavailable — ignore */
  }
}

export function forgetProfile(email: string) {
  if (typeof window === "undefined") return;
  try {
    const remaining = getRememberedProfiles().filter((p) => p.email !== email);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  } catch {
    /* localStorage unavailable — ignore */
  }
}
