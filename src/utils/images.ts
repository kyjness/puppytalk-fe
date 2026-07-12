export function safeImageUrl(url: unknown, fallback = ''): string {
  if (!url || typeof url !== 'string') return fallback;
  const t = url.trim();
  if (!t) return fallback;
  if (/^https?:\/\/[^/]+\/upload\//.test(t)) {
    return t.replace(/^https?:\/\/[^/]+/, '');
  }
  if (t.startsWith('https://') || t.startsWith('http://') || t.startsWith('./') || t.startsWith('/')) {
    return t;
  }
  return fallback;
}

interface ProfileImageOwner {
  profileImageUrl?: string | null;
}

export function getProfileImageUrl(
  currentUser: ProfileImageOwner | null | undefined,
  author: ProfileImageOwner | null | undefined,
  isMine: boolean,
  defaultUrl: string | null | undefined
): string {
  const fallback = defaultUrl && String(defaultUrl).trim() ? defaultUrl : '';
  let out = '';
  if (isMine && currentUser?.profileImageUrl) {
    out = safeImageUrl(currentUser.profileImageUrl, fallback) || fallback;
  } else {
    const url = author?.profileImageUrl ?? null;
    out = safeImageUrl(url, fallback) || fallback;
  }
  return out && String(out).trim() ? out : defaultUrl || '';
}

export interface ImageUploadData {
  imageId: string | null;
  url: string | null;
  signupToken: string | null;
}

export function getImageUploadData(res: unknown): ImageUploadData {
  const step1 = (res as { data?: unknown })?.data ?? res;
  const data = (step1 as { data?: unknown })?.data ?? step1;
  const inner = (data as { data?: unknown })?.data ?? data;
  const payload = (inner ?? data) as
    | { id?: string; fileUrl?: string; signupToken?: string }
    | null
    | undefined;
  return {
    imageId: payload?.id ?? null,
    url: payload?.fileUrl ?? null,
    signupToken: payload?.signupToken ?? null,
  };
}

export function revokeObjectUrlSafely(url: unknown): void {
  if (!url || typeof url !== 'string') return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}
