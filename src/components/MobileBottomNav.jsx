import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FaHome, FaThLarge, FaCalendarAlt, FaRandom, FaUser, FaArrowLeft, FaTimes, FaSearch } from 'react-icons/fa'
import styled from 'styled-components'
import { isNativeAndroid } from '../lib/nativeAndroid'

const Bar = styled.nav`
  display: none;
  position: fixed;
  bottom: calc(12px + env(safe-area-inset-bottom, 0));
  left: 50%;
  transform: translateX(-50%);
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 9999px;
  padding: 6px 10px;
  gap: 4px;
  z-index: 80;
  box-shadow: 0 6px 28px rgba(0,0,0,0.6);

  ${({ $nativeAndroid }) => $nativeAndroid && `
    display: flex;
    align-items: center;
    bottom: max(10px, calc(10px + env(safe-area-inset-bottom, 0px)));
    width: min(calc(100% - 24px), 600px);
    min-height: 66px;
    justify-content: space-evenly;
    padding: 6px 8px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 24px;
    background: rgba(22, 22, 24, 0.98);
    box-shadow: 0 18px 44px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04);
  `}

  @media (max-width: 768px) {
    display: flex;
    align-items: center;
  }

  @media (max-width: 1024px) and (hover: none) and (pointer: coarse) {
    display: flex;
    align-items: center;
  }
`

const Item = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  color: ${({ active }) => (active ? '#fff' : 'var(--text-muted)')};
  cursor: pointer;
  padding: 8px 10px;
  min-height: 44px;
  min-width: 44px;
  border-radius: 9999px;
  font-size: 10px;
  transition: all 0.2s;

  ${({ active, $nativeAndroid }) => active && ($nativeAndroid ? `
    background: #ece8ef;
    color: #19171d;
    box-shadow: none;
  ` : `
    background: rgba(255, 255, 255, 0.15);
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
  `)}

  ${({ $nativeAndroid }) => $nativeAndroid && `
    min-width: 52px;
    padding: 7px 10px;
    letter-spacing: 0.01em;
    transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background 160ms cubic-bezier(0.23, 1, 0.32, 1), color 160ms cubic-bezier(0.23, 1, 0.32, 1);

    span {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.025em;
    }

    &:active { transform: scale(0.94); }
  `}

  &:hover { color: #fff; }

  span {
    font-size: 9px;
    font-weight: 500;
  }

  @media (max-width: 420px) {
    padding: 6px 8px;
    min-width: 40px;
  }
`

const SearchOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  padding: 24px;
  animation: fadeIn 0.2s ease-out;

  ${({ $nativeAndroid }) => $nativeAndroid && `
    padding: calc(env(safe-area-inset-top, 0px) + 24px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px);
    background: rgba(16, 16, 18, 0.985);
    backdrop-filter: blur(24px);
  `}

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`

const MobileBottomNav = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const closeNativeOverlay = () => {
      if (searchOpen) setSearchOpen(false)
    }
    document.addEventListener('aniraku:native-back', closeNativeOverlay)
    return () => document.removeEventListener('aniraku:native-back', closeNativeOverlay)
  }, [searchOpen])

  const nativeAndroid = isNativeAndroid()
  const isAnimeDetail = path.startsWith('/anime/') || path.startsWith('/watch/')

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (query.trim()) {
      setSearchOpen(false)
      navigate(`/catalog?search=${encodeURIComponent(query.trim())}`)
      setQuery('')
    }
  }

  if (isAnimeDetail) {
    return (
      <Bar $nativeAndroid={nativeAndroid} style={{ borderRadius: nativeAndroid ? 24 : 16, padding: nativeAndroid ? '6px 10px' : '6px 12px' }}>
        <Item $nativeAndroid={nativeAndroid} onClick={() => navigate(-1)} aria-label="Go back">
          <FaArrowLeft size={16} />
          <span>Back</span>
        </Item>
        <Item $nativeAndroid={nativeAndroid} active={path === '/home' ? 1 : 0} onClick={() => navigate('/home')} aria-label="Home">
          <FaHome size={16} />
          <span>Home</span>
        </Item>
        <Item $nativeAndroid={nativeAndroid} active={path === '/catalog' ? 1 : 0} onClick={() => navigate('/catalog')} aria-label="Catalog">
          <FaThLarge size={16} />
          <span>Catalog</span>
        </Item>
      </Bar>
    )
  }

  const items = [
    { icon: FaHome, label: 'Home', to: '/home' },
    { icon: FaThLarge, label: 'Catalog', to: '/catalog' },
    { icon: FaCalendarAlt, label: 'Schedule', to: '/schedule' },
    { icon: FaRandom, label: 'Random', to: '/random' },
    { icon: FaUser, label: 'Profile', to: '/profile' },
  ]

  return (
    <>
      <Bar $nativeAndroid={nativeAndroid}>
        {items.map(({ icon: Icon, label, to, action }) => (
          <Item
            key={label}
            $nativeAndroid={nativeAndroid}
            active={to && (path === to || path.startsWith(`${to}/`)) ? 1 : 0}
            onClick={action || (() => navigate(to))}
            aria-label={label}
            aria-current={to && (path === to || path.startsWith(`${to}/`)) ? 'page' : undefined}
          >
            <Icon size={16} />
            <span>{label}</span>
          </Item>
        ))}
      </Bar>

      {searchOpen && (
        <SearchOverlay $nativeAndroid={nativeAndroid} role="dialog" aria-modal="true" aria-label="Mobile search">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Search Aniraku</h3>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
              title="Close search"
              style={{ display: 'grid', placeItems: 'center', background: 'none', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 999, color: '#fff', cursor: 'pointer', padding: 8, minHeight: 44, minWidth: 44 }}
            >
              <FaTimes size={15} />
            </button>
          </div>
          <form onSubmit={handleSearchSubmit} aria-label="Search anime" style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anime, characters, genres..."
              aria-label="Search anime, characters, and genres"
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 12,
                padding: '14px 16px',
                color: '#fff',
                fontSize: 16,
                outline: 'none',
                minHeight: 48,
              }}
            />
            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                background: 'var(--accent, #6366f1)',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '0 20px',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                minHeight: 48,
                minWidth: 48,
              }}
            >
              <FaSearch size={14} aria-hidden="true" />
              <span>Search</span>
            </button>
          </form>
        </SearchOverlay>
      )}
    </>
  )
}

export default MobileBottomNav
