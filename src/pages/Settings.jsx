import { useState, useRef, useCallback, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { FaChevronLeft, FaEye, FaEyeSlash, FaTrash, FaSignOutAlt, FaLink, FaUnlink, FaCheck, FaHistory, FaBookmark, FaKey, FaSync, FaLock } from 'react-icons/fa'
import { useAuth } from '../hooks/useAuth'
import { useNsfw } from '../hooks/useNsfw'
import { supabase } from '../lib/supabase'
import Footer from '../components/Footer/Footer'
import { getSyncStatus, syncAuthorize, syncDisconnect, PROVIDER_LABELS } from '../lib/sync'
import ProviderIcon from '../components/ProviderIcon'
import { PageLoader } from '../components/Skeletons/Skeletons'
import { clearWatchHistory } from '../lib/watchHistory'

// Clear only this site's data. localStorage.clear() wipes every other app
// on the same origin scope — and on the deployed site that origin is shared
// with the whole site, so wipe only what Aniraku owns.
const clearAnirakuStorage = () => {
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k.startsWith('aniraku-') || k.startsWith('sb-'))) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
  } catch {
    // Storage may be unavailable in private browsing; cleanup remains best effort.
  }
}

const removeLocalKey = (key) => {
  try {
    localStorage.removeItem(key)
  } catch {
    // Missing storage access should not interrupt the settings action.
  }
}

const Page = styled.main`
  min-height: 100vh;
  background: var(--bg);
  color: var(--text-primary);
  padding: 40px 20px calc(40px + env(safe-area-inset-bottom, 0));

  @media (max-width: 480px) {
    padding: 24px 16px calc(32px + env(safe-area-inset-bottom, 0));
  }
`

const Container = styled.div`
  max-width: 640px;
  margin: 0 auto;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
`

const BackBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  color: var(--text-primary);
  transition: border-color var(--transition-fast), background var(--transition-fast);
  &:hover {
    border-color: var(--border-hover);
    background: var(--bg-elevated);
  }
`

const Title = styled.h1`
  font-size: 22px;
  font-weight: 700;
`

const Subtitle = styled.p`
  color: var(--text-muted);
  font-size: 14px;
  margin-bottom: 24px;
`

const Card = styled.section`
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 16px;

  @media (max-width: 480px) {
    padding: 16px;
  }
`

const CardTitle = styled.h2`
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  margin-bottom: 16px;
`

// ── Toggle switch ──────────────────────────────────────────────────────────
// Real DOM elements (no pseudo-element tricks): a 64×34 track with a 26px
// thumb that slides. Monochrome: white track / black thumb when on, black
// track / grey thumb when off. The button wraps a 44px tall hit area so the
// tap target stays comfortable while the track keeps its crisp size.
const Switch = styled.button`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 44px;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  &:disabled { opacity: 0.55; cursor: wait; }
`

const Track = styled.span`
  position: relative;
  display: block;
  width: 64px;
  height: 34px;
  border-radius: 999px;
  box-sizing: border-box;
  background: ${({ active }) => (active ? '#fff' : '#0c0c0c')};
  border: 1px solid ${({ active }) => (active ? '#fff' : '#3f3f46')};
  box-shadow: ${({ active }) => (active ? '0 0 14px rgba(255, 255, 255, 0.25)' : 'none')};
  transition: background var(--transition-normal), border-color var(--transition-normal), box-shadow var(--transition-normal);
`

const Thumb = styled.span`
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: ${({ active }) => (active ? '#000' : '#71717a')};
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.45);
  transform: translateX(${({ active }) => (active ? '30px' : '0')});
  transition: transform var(--transition-normal), background var(--transition-normal);
`

// One toggle bar: icon + title + description on the left, switch on the
// right. Used for every on/off preference so all rows look identical.
const ToggleRow = ({ icon, title, desc, checked, disabled, onChange }) => (
  <Row>
    <RowLabel>
      <h3>
        {icon && <span className="row-icon" style={{ color: 'var(--text-muted)' }}>{icon}</span>}
        {title}
      </h3>
      {desc && <p>{desc}</p>}
    </RowLabel>
    <Switch
      active={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      aria-label={title}
      role="switch"
      aria-checked={checked}
    >
      <Track active={checked}>
        <Thumb active={checked} />
      </Track>
    </Switch>
  </Row>
)

// Divides sibling rows so a card of toggles reads as one list.
const RowDivider = styled.div`
  & > *:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }
`

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 14px 0;

  @media (max-width: 480px) {
    flex-direction: column;
    align-items: stretch;
  }
`

const RowLabel = styled.div`
  min-width: 0;
  h3 {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  p {
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
  }
`

const RowBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 0 0 auto;
  padding: 10px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: ${({ $busy }) => ($busy ? 'wait' : 'pointer')};
  opacity: ${({ $busy, $disabled }) => ($busy || $disabled ? 0.6 : 1)};
  pointer-events: ${({ $disabled }) => ($disabled ? 'none' : 'auto')};
  min-height: 44px;

  &:hover { border-color: var(--border-hover); }

  @media (max-width: 480px) {
    width: 100%;
  }
`

const RowBtnLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 0 0 auto;
  padding: 10px 16px;
  background: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius-md);
  color: var(--bg);
  font-size: 13px;
  font-weight: 600;
  min-height: 44px;
  text-decoration: none;

  @media (max-width: 480px) {
    width: 100%;
  }
`

const RowBtnPrimary = styled(RowBtn)`
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
  &:hover { border-color: var(--accent); }
`

const Badge = styled.span`
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  margin-left: 6px;
  vertical-align: 2px;
  background: ${({ ok }) => (ok ? 'rgba(34,197,94,0.15)' : 'var(--bg-elevated)')};
  color: ${({ ok }) => (ok ? '#86efac' : 'var(--text-muted)')};
`

const Hint = styled.p`
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
`

const DangerBtn = styled.button`
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #ef4444;
  border-radius: var(--radius-md);
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: ${p => p.$disabled ? 'wait' : 'pointer'};
  opacity: ${p => p.$disabled ? 0.6 : 1};
  &:hover { background: rgba(239, 68, 68, 0.2); }

  @media (max-width: 480px) {
    width: 100%;
    justify-content: center;
  }
`

const DangerInput = styled.input`
  width: 100%;
  max-width: 220px;
  padding: 10px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  &:focus { border-color: #ef4444; }

  @media (max-width: 480px) {
    max-width: 100%;
  }
`

const DangerMsg = styled.p`
  font-size: 13px;
  color: #ef4444;
  margin-top: 10px;
`

const ErrMsg = styled.p`
  font-size: 13px;
  color: #fca5a5;
  margin-top: 8px;
`

const Input = styled.input`
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  &:focus { border-color: var(--accent); }
`

const SyncRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;

  &:last-child { border-bottom: none; }

  @media (max-width: 480px) {
    flex-direction: column;
    align-items: stretch;
  }
`

const SyncBtn = styled(RowBtn)`
  background: ${({ primary }) => (primary ? 'var(--accent)' : 'var(--bg-elevated)')};
  color: ${({ primary }) => (primary ? 'var(--bg)' : 'var(--text-primary)')};
  border-color: ${({ primary }) => (primary ? 'var(--accent)' : 'var(--border)')};
`

const Toast = ({ message }) => {
  if (!message) return null
  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.88)', color: '#e2e8f0', padding: '8px 20px',
      borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999,
      border: '1px solid rgba(226,232,240,0.12)', backdropFilter: 'blur(8px)',
      pointerEvents: 'none', whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 32px)',
      overflow: 'hidden', textOverflow: 'ellipsis',
    }}>{message}</div>
  )
}

const Settings = () => {
  const { user, profile, loading, signOut } = useAuth()
  const { nsfwEnabled, updateNsfw } = useNsfw()
  const navigate = useNavigate()
  const [confirmArmed, setConfirmArmed] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')
  const [nsfwSaving, setNsfwSaving] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 2500)
  }, [])

  useEffect(() => () => clearTimeout(toastTimerRef.current), [])

  const handleNsfwToggle = async (next) => {
    if (nsfwSaving) return
    setNsfwSaving(true)
    try {
      await updateNsfw(next)
      showToast(next ? 'NSFW content enabled' : 'NSFW content hidden')
    } catch (err) {
      console.error('Save NSFW setting:', err)
      showToast('Could not save — check your connection and try again')
    } finally {
      setNsfwSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!user || confirmText !== 'DELETE' || deleting) return
    setDeleting(true)
    setDeleteErr('')

    try {
      const { error } = await supabase.rpc('delete_my_account')
      if (error) throw error

      // Delete the local auth session as well as the database account. This keeps
      // the persistent AuthProvider state from making the deleted user appear
      // signed in until a later refresh.
      await signOut()
      clearAnirakuStorage()
      navigate('/home')
    } catch (error) {
      console.error('Delete account:', error)
      setDeleteErr(error?.message || 'We could not delete your account. Please try again.')
      setDeleting(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      showToast('Signed out')
      navigate('/home')
    } catch (err) {
      console.error('Sign out:', err)
      showToast('Could not sign out — try again')
    }
  }

  // ── MAL / AniList watch-progress sync ───────────────────────
  const [syncStatus, setSyncStatus] = useState(null)
  const [syncBusy, setSyncBusy] = useState({})
  const [syncVersion, setSyncVersion] = useState(0)
  const [syncCheckedAt, setSyncCheckedAt] = useState(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getSyncStatus().then((data) => {
      if (!cancelled) {
        if (data) setSyncStatus(data)
        setSyncCheckedAt(Date.now())
      }
    })
    return () => { cancelled = true }
  }, [user, syncVersion])

  const syncProviderStatus = (provider) => {
    const p = syncStatus?.[provider]
    return {
      connected: !!(p && p.connected),
      username: p?.username || '',
      reason: p?.reason || '',
      expiresAt: p?.expires_at || 0,
    }
  }

  const connectedProviders = syncStatus
    ? Object.keys(PROVIDER_LABELS).filter((p) => syncProviderStatus(p).connected)
    : []

  const tokenHealth = (expiresAt) => {
    if (!expiresAt) return ''
    const daysLeft = Math.floor((expiresAt - Date.now() / 1000) / 86400)
    if (daysLeft > 30) return `token valid ~${Math.floor(daysLeft / 30)}mo`
    if (daysLeft > 0) return `token expires in ${daysLeft}d`
    return 'token expired — progress will refresh it automatically'
  }

  const handleConnect = async (provider) => {
    if (syncBusy[provider]) return
    setSyncBusy((b) => ({ ...b, [provider]: true }))
    try {
      const url = await syncAuthorize(provider)
      if (!url) {
        showToast('Sync is not set up on the server yet')
        return
      }
      window.location.href = url
    } finally {
      setSyncBusy((b) => ({ ...b, [provider]: false }))
    }
  }

  const handleDisconnect = async (provider) => {
    if (syncBusy[provider]) return
    setSyncBusy((b) => ({ ...b, [provider]: true }))
    const ok = await syncDisconnect(provider)
    setSyncBusy((b) => ({ ...b, [provider]: false }))
    if (ok) {
      setSyncVersion((v) => v + 1)
      showToast(`${PROVIDER_LABELS[provider]} disconnected`)
    } else {
      showToast('Could not disconnect — try again')
    }
  }

  // ── Change password ─────────────────────────────────────────
  const canChangePassword = !!(user && user.email)
  const [pwOpen, setPwOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwErr, setPwErr] = useState('')

  const handlePassword = async () => {
    if (pw.length < 6) { setPwErr('Password must be at least 6 characters'); return }
    if (pw !== pw2) { setPwErr('Passwords do not match'); return }
    setPwBusy(true)
    setPwErr('')
    try {
      const { error } = await supabase.auth.updateUser({ password: pw })
      if (error) throw error
      setPwOpen(false)
      setPw('')
      setPw2('')
      showToast('Password updated')
    } catch (err) {
      console.error('Update password:', err)
      setPwErr(err.message || 'Could not update password')
    } finally {
      setPwBusy(false)
    }
  }

  // ── Clear watch history / bookmarks ─────────────────────────
  const [clearing, setClearing] = useState('') // '' | 'history' | 'bookmarks' | 'local'

  const [undoSnapshot, setUndoSnapshot] = useState(null)

  const handleClearHistory = async () => {
    if (clearing) return
    setClearing('history')
    try {
      // Snapshot local data for potential undo window
      const prevHistory = localStorage.getItem('aniraku-watch-history')
      await clearWatchHistory({ userId: user?.id })
      removeLocalKey('aniraku-episode-track')
      if (prevHistory) {
        setUndoSnapshot({ type: 'history', data: prevHistory })
      }
      setClearArm((a) => ({ ...a, history: false }))
      showToast('Watch history cleared (Undo available)')
    } catch (err) {
      console.error('Clear watch history:', err)
      showToast('Could not clear history — try again')
    } finally {
      setClearing('')
    }
  }

  const handleUndo = () => {
    if (!undoSnapshot) return
    if (undoSnapshot.type === 'history') {
      localStorage.setItem('aniraku-watch-history', undoSnapshot.data)
      window.dispatchEvent(new CustomEvent('aniraku:watch-history-changed', { detail: { type: 'storage', keys: [] } }))
      showToast('Watch history restored')
    } else if (undoSnapshot.type === 'bookmarks') {
      localStorage.setItem('aniraku-bookmarks', undoSnapshot.data)
      showToast('Bookmarks restored')
    }
    setUndoSnapshot(null)
  }

  const handleClearBookmarks = async () => {
    if (clearing) return
    setClearing('bookmarks')
    try {
      if (user) {
        const { error } = await supabase.from('bookmarks').delete().eq('user_id', user.id)
        if (error) throw error
      }
      removeLocalKey('aniraku-bookmarks')
      setClearArm((a) => ({ ...a, bookmarks: false }))
      showToast('Bookmarks cleared')
    } catch (err) {
      console.error('Clear bookmarks:', err)
      showToast('Could not clear bookmarks — try again')
    } finally {
      setClearing('')
    }
  }

  const [clearArm, setClearArm] = useState({ history: false, bookmarks: false })

  const renderContentCard = () => (
    <Card>
      <CardTitle>Content</CardTitle>
      <RowDivider>
        <ToggleRow
          icon={nsfwEnabled ? <FaEye size={13} /> : <FaEyeSlash size={13} />}
          title={nsfwEnabled ? 'NSFW content shown' : 'NSFW content hidden'}
          desc="Show adult-rated titles in browsing, search and recommendations."
          checked={nsfwEnabled}
          disabled={nsfwSaving}
          onChange={handleNsfwToggle}
        />
      </RowDivider>
      <Hint>
        When disabled, adult titles are filtered from lists and their pages show a block screen.
        You can change this at any time.
      </Hint>
      {nsfwSaving && (
        <Hint style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
          Saving to your account…
        </Hint>
      )}
    </Card>
  )

  const renderSyncCard = () => {
    if (!user) {
      // Guests can't hold OAuth tokens — point them at login instead of
      // dead Connect buttons.
      return (
        <Card>
          <CardTitle>Library Sync</CardTitle>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 4 }}>
            Keep Aniraku in step with your MyAnimeList and AniList libraries. When you
            finish an episode here, your progress is pushed to every connected service.
          </p>
          <RowDivider>
            <Row>
              <RowLabel>
                <h3><FaLock size={13} /> Sync needs an account</h3>
                <p>Log in to connect your library and push watch progress automatically.</p>
              </RowLabel>
              <RowBtnLink to="/login">Log in</RowBtnLink>
            </Row>
          </RowDivider>
        </Card>
      )
    }

    return (
      <Card>
        <CardTitle>Library Sync</CardTitle>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8 }}>
          Keep Aniraku in step with your MyAnimeList and AniList libraries.
          When you finish an episode here, your progress is pushed to every
          connected service automatically.
        </p>
        {['mal', 'anilist'].map((provider) => {
          const { connected, username, reason, expiresAt } = syncProviderStatus(provider)
          const busy = !!syncBusy[provider]
          return (
            <SyncRow key={provider}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ProviderIcon provider={provider} size={16} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {PROVIDER_LABELS[provider]}
                </span>
                <Badge ok={connected}>{connected ? 'Connected' : 'Off'}</Badge>
              </div>
              {connected && username && (
                  <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>
                    Syncing as <strong style={{ color: 'var(--text-secondary)' }}>{username}</strong>
                  </div>
                )}
                {connected && (
                  <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginTop: 1, opacity: 0.8 }}>
                    {tokenHealth(expiresAt)}
                  </div>
                )}
                {!connected && reason && (
                  <div style={{ fontSize: 12, fontWeight: 400, color: '#fca5a5', marginTop: 2 }}>
                    {reason}
                  </div>
                )}
              {connected ? (
                <SyncBtn $busy={busy} onClick={() => handleDisconnect(provider)}>
                  <FaUnlink size={13} /> {busy ? 'Disconnecting…' : 'Disconnect'}
                </SyncBtn>
              ) : (
                <SyncBtn primary $busy={busy} onClick={() => handleConnect(provider)}>
                  <FaLink size={13} /> Connect
                </SyncBtn>
              )}
            </SyncRow>
          )
        })}
        <Row style={{ borderTop: '1px solid var(--border)', marginTop: 8 }}>
          <RowLabel>
            <h3 style={{ fontSize: 13, fontWeight: 500 }}>
              {connectedProviders.length
                ? `${connectedProviders.length} service${connectedProviders.length > 1 ? 's' : ''} connected`
                : 'No services connected yet'}
            </h3>
            <p>
              {syncCheckedAt
                ? `Checked ${new Date(syncCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Checking status…'}
            </p>
          </RowLabel>
          <RowBtn onClick={() => { setSyncVersion((v) => v + 1) }}>
            <FaSync size={13} /> Refresh
          </RowBtn>
        </Row>
        <Hint>
          Connecting opens {`${PROVIDER_LABELS.mal}`} / {`${PROVIDER_LABELS.anilist}`} in a new tab
          and asks only for permission to update your library list — no password is
          ever shared with Aniraku.
        </Hint>
      </Card>
    )
  }

  const renderAccountCard = () => (
    <Card>
      <CardTitle>Account</CardTitle>
      <RowDivider>
        <Row>
          <RowLabel>
            <h3 style={{ fontSize: 13, fontWeight: 500 }}>Email</h3>
            <p>{user.email || 'No email on this account'}</p>
          </RowLabel>
          {user.email_confirmed_at ? (
            <Badge ok>Verified</Badge>
          ) : (
            <Badge ok={false}>Unverified</Badge>
          )}
        </Row>
        {profile?.created_at && (
          <Row>
            <RowLabel>
              <h3 style={{ fontSize: 13, fontWeight: 500 }}>Member since</h3>
              <p>
                {new Date(profile.created_at).toLocaleDateString(undefined, {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            </RowLabel>
          </Row>
        )}
        {canChangePassword && (
          <>
            <Row>
              <RowLabel>
                <h3 style={{ fontSize: 13, fontWeight: 500 }}>Password</h3>
                <p>Update the password you use to sign in.</p>
              </RowLabel>
              <RowBtn onClick={() => setPwOpen((v) => !v)}>
                <FaKey size={13} /> {pwOpen ? 'Cancel' : 'Change'}
              </RowBtn>
            </Row>
            {pwOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Input
                  type="password"
                  aria-label="New password"
                  placeholder="New password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  autoComplete="new-password"
                />
                <Input
                  type="password"
                  aria-label="Confirm new password"
                  placeholder="Confirm new password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  autoComplete="new-password"
                />
                {pwErr && <ErrMsg>{pwErr}</ErrMsg>}
                <div>
                  <RowBtnPrimary $busy={pwBusy} onClick={handlePassword}>
                    <FaCheck size={13} /> {pwBusy ? 'Saving…' : 'Update Password'}
                  </RowBtnPrimary>
                </div>
              </div>
            )}
          </>
        )}
        <Row>
          <RowLabel>
            <h3 style={{ fontSize: 13, fontWeight: 500 }}>Profile</h3>
            <p>Username, display name, avatar, bookmarks and watch history.</p>
          </RowLabel>
          <RowBtn onClick={() => navigate('/profile')}>Open Profile</RowBtn>
        </Row>
        <Row>
          <RowLabel>
            <h3 style={{ fontSize: 13, fontWeight: 500 }}>Sign out</h3>
            <p>End this session on this device.</p>
          </RowLabel>
          <RowBtn onClick={handleSignOut}>
            <FaSignOutAlt size={13} /> Sign Out
          </RowBtn>
        </Row>
      </RowDivider>
    </Card>
  )

  const renderDataCard = (isGuest) => (
    <Card>
      <CardTitle>Data</CardTitle>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8 }}>
        {isGuest
          ? 'Clearing removes this data from this device only. Log in to manage account-wide data.'
          : 'Clearing removes this data from your account everywhere you are signed in.'}
      </p>
      <RowDivider>
        <Row>
          <RowLabel>
            <h3 style={{ fontSize: 13, fontWeight: 500 }}><FaHistory size={12} /> Watch history</h3>
            <p>Episodes you have watched, and where you left off.</p>
          </RowLabel>
          {!clearArm.history ? (
            <RowBtn onClick={() => setClearArm((a) => ({ ...a, history: true }))}>Clear</RowBtn>
          ) : (
            <DangerBtn $disabled={!!clearing} onClick={handleClearHistory}>
              <FaTrash size={12} /> {clearing === 'history' ? 'Clearing…' : 'Confirm clear'}
            </DangerBtn>
          )}
        </Row>
        <Row>
          <RowLabel>
            <h3 style={{ fontSize: 13, fontWeight: 500 }}><FaBookmark size={12} /> Bookmarks</h3>
            <p>Anime you have saved to your library.</p>
          </RowLabel>
          {!clearArm.bookmarks ? (
            <RowBtn onClick={() => setClearArm((a) => ({ ...a, bookmarks: true }))}>Clear</RowBtn>
          ) : (
            <DangerBtn $disabled={!!clearing} onClick={handleClearBookmarks}>
              <FaTrash size={12} /> {clearing === 'bookmarks' ? 'Clearing…' : 'Confirm clear'}
            </DangerBtn>
          )}
        </Row>
      </RowDivider>
      <Hint>
        These actions cannot be undone. The buttons disarm themselves after clearing.
      </Hint>
    </Card>
  )

  const renderDangerCard = () => (
    <Card style={{ borderColor: 'rgba(239, 68, 68, 0.35)' }}>
      <CardTitle style={{ color: '#ef4444' }}>Danger Zone</CardTitle>
      <RowDivider>
        <Row>
          <RowLabel>
            <h3>Delete account</h3>
            <p>Permanently removes your profile, watch history, bookmarks, comments and settings. This cannot be undone.</p>
          </RowLabel>
          {!confirmArmed ? (
            <DangerBtn onClick={() => setConfirmArmed(true)}><FaTrash size={13} /> Delete Account</DangerBtn>
          ) : (
            <div className="settings-confirm" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <DangerInput
                type="text"
                aria-label="Type DELETE to confirm"
                placeholder='Type "DELETE" to confirm'
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoFocus
              />
              <DangerBtn $disabled={deleting || confirmText !== 'DELETE'} onClick={handleDelete}>
                {deleting ? 'Deleting…' : 'Permanently Delete'}
              </DangerBtn>
            </div>
          )}
        </Row>
      </RowDivider>
      {deleteErr && <DangerMsg>{deleteErr}</DangerMsg>}
    </Card>
  )

  if (loading) return <PageLoader label="Loading settings" />

  if (!user) {
    return (
      <>
        <Page id="main">
          <Toast message={toast} />
          {undoSnapshot && (
            <div role="status" aria-live="polite" style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: '#1e293b', color: '#fff', padding: '12px 20px', borderRadius: 12,
              display: 'flex', alignItems: 'center', gap: 16, zIndex: 9999, border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}>
              <span>Action completed. Changed your mind?</span>
              <button type="button" onClick={handleUndo} style={{
                background: 'var(--accent)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontWeight: 600, cursor: 'pointer'
              }}>Undo</button>
            </div>
          )}
          <Container>
            <Title>Settings</Title>
            <Subtitle>
              Guest preferences are stored on this device only.{' '}
              <Link to="/login" style={{ color: 'var(--accent)' }}>Log in</Link> to sync them to your account.
            </Subtitle>
            {renderContentCard()}
            {renderSyncCard()}
            {renderDataCard(true)}
          </Container>
        </Page>
        <Footer />
        <div className="bottom-nav-spacer" />
      </>
    )
  }

  return (
    <>
      <Page id="main">
      <Toast message={toast} />
      {undoSnapshot && (
        <div role="status" aria-live="polite" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#fff', padding: '12px 20px', borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 16, zIndex: 9999, border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
        }}>
          <span>Action completed. Changed your mind?</span>
          <button type="button" onClick={handleUndo} style={{
            background: 'var(--accent)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontWeight: 600, cursor: 'pointer'
          }}>Undo</button>
        </div>
      )}
      <Container>
          <Header>
            <BackBtn to="/profile" aria-label="Back to profile"><FaChevronLeft size={16} /></BackBtn>
            <Title>Settings</Title>
          </Header>
          <Subtitle>Preferences are saved to your account and follow you across devices.</Subtitle>

          {renderContentCard()}
          {renderSyncCard()}
          {renderAccountCard()}
          {renderDataCard(false)}
          {renderDangerCard()}
        </Container>
        <Footer />
        <div className="bottom-nav-spacer" />
        <style>{`
          @media (max-width: 480px) {
            .settings-confirm { width: 100% !important; align-items: stretch !important; }
          }
        `}</style>
      </Page>
    </>
    )
}

export default Settings
