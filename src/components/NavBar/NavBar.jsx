import React, { useState, useEffect, useRef } from 'react'
import { FaBars, FaBell, FaSearch, FaRandom } from 'react-icons/fa'
import { N } from './navbar.style'
import SideBar from './SideBar'
import Logo from '../Logo'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { avatarUrl, defaultAvatar } from '../../lib/avatars'
import { supabase } from '../../lib/supabase'
import { generateSlug } from '../../lib/slug'
import { API_BASE } from '../../config'
import { isNativeAndroid } from '../../lib/nativeAndroid'

const NavBar = () => {
  const [open, setOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const notifRef = useRef(null)
  const searchRef = useRef(null)
  const { user, profile, isAdmin } = useAuth()
  const navigate = useNavigate()

  const location = useLocation()
  const isHome = location.pathname === '/home'
  const nativeAndroid = isNativeAndroid()

  useEffect(() => {
    if (open) {
      document.body.classList.add('body-hidden')
    } else {
      document.body.classList.remove('body-hidden')
    }
  }, [open])

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!user) return
    const fetchNotifs = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const res = await fetch(`${API_BASE}/api/v1/notifications`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        if (res.ok) {
          const data = await res.json()
          setNotifications(data || [])
        }
      } catch (err) {
        console.error('[NavBar] fetchNotifs error:', err)
      }
    }
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 30000)
    return () => clearInterval(interval)
  }, [user])

  const markRead = async (id) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch(`${API_BASE}/api/v1/notifications/${id}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch {}
  }

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const handleSearch = (e) => {
    e.preventDefault()
    const q = searchQ.trim()
    if (q) navigate(`/catalog?search=${encodeURIComponent(q)}`)
    setSearchQ('')
  }

  return (
    <N.Nav $nativeAndroid={nativeAndroid} $isScrolled={isScrolled} $isHome={isHome}>
      <N.LayoutBg open={open} onClick={() => setOpen(false)} />
      <N.Left>
        <N.MenuBtn onClick={() => setOpen(true)} aria-expanded={open} aria-controls="sidebar-menu">
          <FaBars size={20} />
        </N.MenuBtn>
        <SideBar open={open} setOpen={setOpen} profile={profile} isAdmin={isAdmin} />
        <Logo to="/home" height={36} showText />
        <N.NavLinks>
          <N.NavLink to="/" className={location.pathname === '/' || location.pathname === '/home' ? 'active' : ''}>Home</N.NavLink>
          <N.NavLink to="/catalog" className={location.pathname === '/catalog' ? 'active' : ''}>Catalog</N.NavLink>
          <N.NavLink to="/schedule" className={location.pathname === '/schedule' ? 'active' : ''}>Schedule</N.NavLink>
        </N.NavLinks>
      </N.Left>

      <N.SearchForm onSubmit={handleSearch}>
        <FaSearch size={13} />
        <N.SearchInput ref={searchRef} value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search..." />
      </N.SearchForm>

      <N.Right>
        <N.RightBtn onClick={() => navigate('/random')} title="Random Anime"><FaRandom size={15} /></N.RightBtn>

        {user && (
          <div ref={notifRef} style={{ position: 'relative' }}>
            <N.RightBtn onClick={() => setShowNotifs(!showNotifs)} title="Notifications" style={{ position: 'relative' }} aria-expanded={showNotifs} aria-controls="notifications-panel">
              <FaBell size={15} />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -2, right: -2, background: 'var(--accent)', color: 'var(--bg)', fontSize: 9, fontWeight: 700, borderRadius: '50%', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </N.RightBtn>
            {showNotifs && (
              <div id="notifications-panel" style={{ position: 'absolute', top: '100%', right: 0, width: 300, maxHeight: 400, overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 1000, marginTop: 8 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600 }}>Notifications</div>
                {notifications.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No notifications yet</div>
) : notifications.map(n => (
                  <button type="button" key={n.id} onClick={() => { 
                    setShowNotifs(false); 
                    if (!n.read) markRead(n.id);
                    if (n.anime_id) navigate(`/anime/${n.anime_id}`);
                  }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: n.read ? 'transparent' : 'rgba(var(--accent-rgb, 226,232,240), 0.05)', fontSize: 13, color: 'var(--text-primary)' }}>
                    <p style={{ margin: 0 }}>{n.message}</p>
                    <p style={{ margin: 0, marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>{n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <N.Divider />

        {user ? (
          <Link to="/profile" title={profile?.username || 'Profile'}>
            {profile?.avatar_url ? (
              <N.Avatar src={avatarUrl(profile.avatar_url)} alt="" />
            ) : (
              <N.Avatar src={defaultAvatar((profile?.username || 'u').charCodeAt(0)).url} alt="" />
            )}
          </Link>
        ) : (
          <Link to="/login" style={{ textDecoration: 'none' }}>
            <N.SignIn>Sign In</N.SignIn>
          </Link>
        )}
      </N.Right>
    </N.Nav>
  )
}

export default NavBar
