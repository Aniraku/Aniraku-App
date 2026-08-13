import React from 'react'
import { SiMyanimelist, SiAnilist } from 'react-icons/si'

// Official provider brand glyphs (simple-icons). Falls back to null for
// unknown providers so callers can render their own placeholder.
const ICONS = { mal: SiMyanimelist, anilist: SiAnilist }
const BRAND = { mal: '#2e51a2', anilist: '#02a9ff' }

const ProviderIcon = ({ provider, size = 18, color, style }) => {
  const Icon = ICONS[provider]
  if (!Icon) return null
  return <Icon size={size} color={color || BRAND[provider]} style={{ flexShrink: 0, ...style }} aria-hidden="true" />
}

export default ProviderIcon
