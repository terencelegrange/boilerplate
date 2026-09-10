// Client-side "remembered profiles" for the Netflix-style login screen.
// Stored in localStorage only — never carries credentials or session tokens.

const STORAGE_KEY = "bp_profiles";

export interface RememberedProfile {
  id: number | null;
  email: string;
  name: string | null;
  avatar: number | null;
  // Present only when the user checked "Trust this device" — lets the
  // login screen skip the password step for this profile. Never a session
  // token itself; it's exchanged server-side via POST /api/auth/device.
  deviceToken?: string | null;
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

// Upserts a profile by email. `deviceToken` is preserved from the existing
// entry unless the caller explicitly passes a value (including `null`, to
// clear it) — so routine profile refreshes (e.g. from the dashboard) don't
// accidentally erase a previously trusted device.
export function rememberProfile(profile: RememberedProfile) {
  if (typeof window === "undefined" || !profile.email) return;
  try {
    const all = getRememberedProfiles();
    const prev = all.find((p) => p.email === profile.email);
    const merged: RememberedProfile = {
      ...profile,
      deviceToken: profile.deviceToken !== undefined ? profile.deviceToken : prev?.deviceToken ?? null,
    };
    const rest = all.filter((p) => p.email !== profile.email);
    rest.unshift(merged);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rest.slice(0, 10)));
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
