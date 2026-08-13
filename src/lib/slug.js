// ponytail: slug generation + ID extraction, one function each
export function generateSlug(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-|-$/g, '')
}
export default generateSlug

export function extractIdFromSlug(slugId) {
  if (!slugId) return null
  const s = String(slugId)
  if (/^\d+$/.test(s)) return parseInt(s, 10)
  const lastHyphen = s.lastIndexOf('-')
  if (lastHyphen === -1) return /^\d+$/.test(s) ? parseInt(s, 10) : null
  const tail = s.slice(lastHyphen + 1)
  return /^\d+$/.test(tail) ? parseInt(tail, 10) : null
}
