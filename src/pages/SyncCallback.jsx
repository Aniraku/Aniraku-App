import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import { FaCheckCircle, FaExclamationTriangle, FaSpinner, FaChevronLeft } from 'react-icons/fa'
import { completeSyncCallback, PROVIDER_LABELS } from '../lib/sync'
import ProviderIcon from '../components/ProviderIcon'
import Footer from '../components/Footer/Footer'

const Page = styled.main`
  min-height: 100vh;
  background: var(--bg);
  color: var(--text-primary);
  padding: 40px 20px calc(40px + env(safe-area-inset-bottom, 0));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
`

const Card = styled.section`
  max-width: 420px;
  width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px 24px;
  text-align: center;
`

const State = styled.div`
  font-size: 15px;
  font-weight: 600;
  margin-top: 16px;
`

const Detail = styled.p`
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
  margin-top: 8px;
`

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  padding: 12px 20px;
  background: var(--accent);
  color: var(--bg);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
`

// Landing page for the OAuth redirect from MAL / AniList. MAL and AniList
// append only ?code=&state= to the registered redirect URI, so the provider
// is resolved server-side from the pending OAuth state. A link back to
// Settings (which re-reads the sync status) completes the loop.
export default function SyncCallback() {
  const [params] = useSearchParams()
  const code = params.get('code')
  const state = params.get('state')
  const [done, setDone] = useState(false)
  const [connectedProvider, setConnectedProvider] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    // Already connected in this session (e.g. page refresh after success).
    if (!code && !state && !done) {
      const provider = sessionStorage.getItem('aniraku-sync-connected')
      if (provider) {
        setConnectedProvider(provider)
        setDone(true)
      }
    }
  }, [code, state, done])

  useEffect(() => {
    if (done) return
    if (!code || !state) {
      setError('This link is incomplete or has expired. Open it from Settings instead.')
      return
    }
    let cancelled = false
    completeSyncCallback('', code, state)
      .then((data) => {
        if (cancelled) return
        if (!data.error && data.connected) {
          setConnectedProvider(data.provider || '')
          setDone(true)
          // Drop the one-time code from the URL and remember the success so
          // a refresh doesn't re-POST the already-consumed code.
          sessionStorage.setItem('aniraku-sync-connected', data.provider || '')
          window.history.replaceState({}, '', '/sync/callback')
        } else {
          setError(data.error || 'The provider rejected the connection. Try again.')
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not reach the server. Try again from Settings.')
      })
    return () => { cancelled = true }
  }, [code, state, done])

  return (
    <>
      <Page id="main">
        <Card role="status" aria-live="polite">
          {!done && !error && (
            <>
              <FaSpinner size={40} color="var(--accent)" className="sync-spin" />
              <State>Connecting your library…</State>
              <Detail>Finishing the handshake. This only takes a moment.</Detail>
            </>
          )}
          {done && (
            <>
              {connectedProvider ? (
                <ProviderIcon provider={connectedProvider} size={46} />
              ) : (
                <FaCheckCircle size={44} color="#34d399" />
              )}
              <State>Connected to {connectedProvider ? PROVIDER_LABELS[connectedProvider] || connectedProvider : 'your library'}</State>
              <Detail>
                From now on, finishing episodes on Aniraku updates your{' '}
                {connectedProvider ? PROVIDER_LABELS[connectedProvider] || connectedProvider : 'external'} library.
              </Detail>
            </>
          )}
          {error && (
            <>
              <FaExclamationTriangle size={44} color="#fbbf24" />
              <State>Connection failed</State>
              <Detail>{error}</Detail>
            </>
          )}
          <BackLink to="/profile/settings">
            <FaChevronLeft size={13} /> Back to Settings
          </BackLink>
        </Card>
      </Page>
      <Footer />
      <div className="bottom-nav-spacer" />
      <style>{`
        @keyframes sync-cb-spin { to { transform: rotate(360deg); } }
        .sync-spin { animation: sync-cb-spin 1s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .sync-spin { animation: none; } }
      `}</style>
    </>
  )
}
