/** Preset avatars hosted on the public Supabase Storage bucket "Anixen Avatars". */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://sbjdrjaovcgvttfnpfsz.supabase.co'
const BUCKET = 'Anixen Avatars'

const FILES = [
  '01.png', '02.png', '03.png', '06.png', '07.png',
  'avatar-02.png', 'avatar-04.png', 'avatar-12.png', 'avatar-17.png',
  'avatar-18.png', 'avatar-20.png', 'avatar-22.png', 'avatar-23.png',
  'avatar2-08.png', 'avatar2-10.png',
  'beerus.png', 'vegeta.png',
  'File2.jpg', 'File4.png', 'File6.png', 'File9.jpg',
  'user-00.jpeg', 'user-01.jpeg', 'user-02.jpeg', 'user-04.jpeg',
  'user-07.jpeg', 'user-08.jpeg',
]

function encodeStoragePath(path) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

export const AVATAR_LIST = FILES.map((name, index) => ({
  id: index,
  name,
  url: `${SUPABASE_URL}/storage/v1/object/public/${encodeStoragePath(BUCKET + '/' + name)}`,
}))

export function avatarUrl(pathOrUrl) {
  if (!pathOrUrl) return null
  if (pathOrUrl.startsWith('http')) return pathOrUrl
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeStoragePath(BUCKET + '/' + pathOrUrl)}`
}

export function defaultAvatar(seed = 0) {
  return AVATAR_LIST[Math.abs(seed) % AVATAR_LIST.length]
}
