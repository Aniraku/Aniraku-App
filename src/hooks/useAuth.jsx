import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { defaultAvatar } from '../lib/avatars'

const AuthContext = createContext(null)

export const useAuth = () => useContext(AuthContext)

function sanitizeUsername(raw) {
  const base = (raw || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  const clipped = base.slice(0, 20)
  return clipped.length >= 3 ? clipped : `user_${Math.random().toString(36).slice(2, 6)}`
}

function isEmailIdentity(user) {
  return Boolean(
    user?.email && (
      user?.app_metadata?.provider === 'email' ||
      user?.identities?.some(identity => identity.provider === 'email') ||
      (!user?.app_metadata?.provider && !user?.identities?.length)
    )
  )
}

function isUnverifiedEmailUser(user) {
  if (!isEmailIdentity(user)) return false
  return !user.email_confirmed_at && !user.confirmed_at
}

function hasRecoveryMarker() {
  if (typeof window === 'undefined' || window.location.pathname !== '/auth/new-password') return false
  const url = new URL(window.location.href)
  return url.searchParams.get('type') === 'recovery' || /(?:^|&)type=recovery(?:&|$)/.test(url.hash.replace(/^#/, ''))
}

function isAllowedRecoverySession(event) {
  return event === 'PASSWORD_RECOVERY' || hasRecoveryMarker()
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const clearAuthState = useCallback(() => {
    setUser(null)
    setProfile(null)
    setIsAdmin(false)
    setLoading(false)
  }, [])

  const rejectUnverifiedSession = useCallback(() => {
    clearAuthState()
    // Defer the Supabase call so it never runs inside onAuthStateChange's callback stack.
    window.setTimeout(() => {
      supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    }, 0)
  }, [clearAuthState])

  const fetchProfile = useCallback(async (userId, email) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, bio, avatar_url, banner_url, location, socials, created_at')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      if (data) {
        setProfile(data)
      } else {
        // Ensure profile row exists (trigger may have failed on bad username)
        const username = sanitizeUsername(email?.split('@')[0] || `user_${userId.slice(0, 6)}`)
        const fallbackAvatar = defaultAvatar(username.charCodeAt(0)).url
        const { data: created } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            username,
            display_name: username,
            avatar_url: fallbackAvatar,
          }, { onConflict: 'id' })
          .select('id, username, display_name, bio, avatar_url, banner_url, location, socials, created_at')
          .maybeSingle()
        setProfile(created || { id: userId, username, display_name: username, avatar_url: fallbackAvatar })
      }
    } catch (err) {
      console.error('fetchProfile error:', err)
      const username = sanitizeUsername(email?.split('@')[0] || 'user')
      setProfile({ id: userId, username, display_name: username, avatar_url: defaultAvatar(0).url })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let mounted = true

    const applySession = (session, event = '') => {
      if (!mounted) return
      const nextUser = session?.user || null

      if (nextUser && isUnverifiedEmailUser(nextUser) && !isAllowedRecoverySession(event)) {
        rejectUnverifiedSession()
        return
      }

      setUser(nextUser)
      if (nextUser) {
        fetchProfile(nextUser.id, nextUser.email)
        supabase.rpc('is_admin').then(({ data }) => { if (mounted) setIsAdmin(!!data) }).catch(() => { if (mounted) setIsAdmin(false) })
      } else {
        setProfile(null)
        setIsAdmin(false)
        setLoading(false)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      applySession(session, event)
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, [fetchProfile, rejectUnverifiedSession])

  const signUp = useCallback(async (email, password, username) => {
    const clean = sanitizeUsername(username || email.split('@')[0])
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: clean, display_name: clean },
      },
    })
    if (error) throw error
    if (!data.user?.identities?.length) {
      throw new Error('This email is already registered. Try signing in instead.')
    }
    if (data.user && isUnverifiedEmailUser(data.user) && data.session) {
      clearAuthState()
      await supabase.auth.signOut({ scope: 'local' })
    }
    return { ...data, requiresEmailConfirmation: isUnverifiedEmailUser(data.user) }
  }, [clearAuthState])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // A failed login must never leave a previous local session active. This
      // prevents an invalid attempt from appearing to succeed after navigation
      // or refresh, including sessions created before email verification.
      clearAuthState()
      await supabase.auth.signOut({ scope: 'local' })
      throw error
    }
    if (data.user && isUnverifiedEmailUser(data.user)) {
      clearAuthState()
      await supabase.auth.signOut({ scope: 'local' })
      throw new Error('Please verify your email address before signing in. Check your inbox for the confirmation link.')
    }
    return data
  }, [clearAuthState])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // The local Supabase session is already cleared when this request fails.
    }
    try {
      localStorage.removeItem('aniraku-bookmarks')
      localStorage.removeItem('aniraku-watch-history')
      localStorage.removeItem('aniraku-episode-track')
      localStorage.removeItem('aniraku-nsfw-enabled')
    } catch {
      // Local cleanup is best effort and must not block the auth state reset.
    }
    setUser(null)
    setProfile(null)
    setIsAdmin(false)
  }, [])

  const updateProfile = useCallback(async (updates) => {
    if (!user) return
    const { id: _id, ...fields } = updates
    if (fields.username) fields.username = sanitizeUsername(fields.username)
    // Use .update() to avoid NOT NULL violation on username when only updating avatar/bio
    const { error } = await supabase.from('profiles').update(fields).eq('id', user.id)
    if (error) throw error
    if (fields.username || fields.display_name) {
      const { error: metaErr } = await supabase.auth.updateUser({
        data: {
          username: fields.username || user.user_metadata?.username,
          display_name: fields.display_name || user.user_metadata?.display_name,
        },
      })
      if (metaErr) throw metaErr
    }
    setProfile(prev => ({ ...prev, ...fields }))
  }, [user])

  const ctx = useMemo(() => ({ user, profile, isAdmin, loading, signUp, signIn, signOut, updateProfile, isSupabaseConfigured }), [user, profile, isAdmin, loading, signUp, signIn, signOut, updateProfile])
  return (
    <AuthContext.Provider value={ctx}>
      {children}
    </AuthContext.Provider>
  )
}
