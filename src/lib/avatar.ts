export function getDisplayAvatar(av: number | null | undefined, uid: number | null | undefined): number {
  if (av !== null && av !== undefined && av >= 1 && av <= 127) return av;
  if (!uid || uid <= 0) return 1;
  return ((uid - 1) % 127) + 1;
}
