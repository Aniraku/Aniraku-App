const SUPABASE_URL = "https://sbjdrjaovcgvttfnpfsz.supabase.co";
const BUCKET = "Anixen Avatars";

const FILES = [
  "01.png", "02.png", "03.png", "06.png", "07.png",
  "avatar-02.png", "avatar-04.png", "avatar-12.png", "avatar-17.png",
  "avatar-18.png", "avatar-20.png", "avatar-22.png", "avatar-23.png",
  "avatar2-08.png", "avatar2-10.png", "beerus.png", "vegeta.png",
  "File2.jpg", "File4.png", "File6.png", "File9.jpg", "user-00.jpeg",
  "user-01.jpeg", "user-02.jpeg", "user-04.jpeg", "user-07.jpeg", "user-08.jpeg",
] as const;

function storageUrl(name: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(BUCKET)}/${encodeURIComponent(name)}`;
}

export const ANIRAKU_AVATARS = FILES.map((name, id) => ({ id, name, url: storageUrl(name) }));

export function avatarUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return null;
  return pathOrUrl.startsWith("http") ? pathOrUrl : storageUrl(pathOrUrl);
}

export function defaultAvatar(seed = 0) {
  return ANIRAKU_AVATARS[Math.abs(seed) % ANIRAKU_AVATARS.length];
}
