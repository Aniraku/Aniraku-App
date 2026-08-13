import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const Wrapper = styled.main`
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`

const Box = styled.div`
  width: 100%;
  max-width: 440px;
`

const Back = styled(Link)`
  color: var(--accent);
  text-decoration: none;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-bottom: 16px;
  &:hover { text-decoration: underline; }
`

const Card = styled.section`
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 40px 32px;
  box-shadow: var(--shadow-lg);
  @media (max-width: 480px) {
    padding: 28px 20px;
    border-radius: var(--radius-md);
  }
`

const Mark = styled.div`
  width: 46px;
  height: 46px;
  margin: 0 auto 16px;
  border-radius: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  display: grid;
  place-items: center;
  color: var(--accent);
  font-family: var(--font-brand);
  font-size: 25px;
  line-height: 1;
`

const Title = styled.h1`
  color: var(--text-primary);
  font-size: 28px;
  margin: 0 0 8px;
  text-align: center;
`

const Subtitle = styled.p`
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 28px;
  text-align: center;
`

const Field = styled.div`
  margin-bottom: 16px;
`

const Label = styled.label`
  color: var(--text-secondary);
  display: block;
  font-size: 13px;
  margin-bottom: 6px;
`

const Input = styled.input`
  box-sizing: border-box;
  width: 100%;
  min-height: 46px;
  padding: 12px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 16px;
  outline: none;
  &:focus { border-color: var(--accent); }
`

const Button = styled.button`
  width: 100%;
  min-height: 46px;
  padding: 12px 16px;
  border: 0;
  border-radius: 8px;
  background: var(--accent);
  color: var(--bg);
  font-size: 15px;
  font-weight: 700;
  cursor: ${p => (p.$loading ? 'wait' : 'pointer')};
  opacity: ${p => (p.$loading ? 0.7 : 1)};
`

const Message = styled.div`
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid ${p => (p.$tone === 'error' ? 'rgba(229,9,20,0.45)' : 'rgba(34,197,94,0.35)')};
  background: ${p => (p.$tone === 'error' ? 'rgba(229,9,20,0.1)' : 'rgba(34,197,94,0.1)')};
  color: ${p => (p.$tone === 'error' ? '#f87171' : '#4ade80')};
  font-size: 13px;
  line-height: 1.55;
`

const PasswordHint = styled.p`
  margin: -6px 0 18px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
`

function passwordIssue(password, confirmPassword) {
  if (password.length < 8) return 'Use at least 8 characters.'
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Include at least one uppercase letter and one number.'
  }
  if (password !== confirmPassword) return 'The two passwords do not match.'
  return ''
}

const NewPassword = () => {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('verifying')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const hasRecoveryMarker = useMemo(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    return hash.get('type') === 'recovery' || query.get('type') === 'recovery'
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Account recovery is unavailable because Supabase is not configured.')
      setPhase('invalid')
      return undefined
    }

    let alive = true
    let settled = false
    const markReady = () => {
      if (!alive || settled) return
      settled = true
      setError('')
      setPhase('ready')
      // Supabase has consumed the URL tokens by this point. Remove them from the address bar.
      window.history.replaceState({}, document.title, '/auth/new-password')
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) markReady()
    })

    if (hasRecoveryMarker) {
      supabase.auth.getSession().then(({ data, error: sessionError }) => {
        if (!alive || settled) return
        if (data?.session) markReady()
        else if (sessionError) {
          setError('This recovery link could not be verified. Please request a new link.')
          setPhase('invalid')
        }
      }).catch(() => {
        if (alive && !settled) {
          settled = true
          setError('This recovery link could not be verified. Please request a new link.')
          setPhase('invalid')
        }
      })
    } else {
      // OAuth-style recovery events can be emitted after page hydration. Give Supabase a short window.
      const timeout = window.setTimeout(() => {
        if (alive && !settled) {
          settled = true
          setError('This password-reset link is missing or has already been used. Please request a new one.')
          setPhase('invalid')
        }
      }, 1600)
      return () => {
        alive = false
        window.clearTimeout(timeout)
        subscription.unsubscribe()
      }
    }

    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [hasRecoveryMarker])

  const handleSubmit = async event => {
    event.preventDefault()
    const issue = passwordIssue(password, confirmPassword)
    if (issue) {
      setError(issue)
      return
    }

    setLoading(true)
    setError('')
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      await supabase.auth.signOut({ scope: 'local' })
      setPhase('complete')
      window.setTimeout(() => navigate('/login?password=updated', { replace: true }), 1800)
    } catch (updateError) {
      setError(updateError?.message || 'We could not update your password. Request a new recovery link and try again.')
    } finally {
      setLoading(false)
    }
  }

  const isReady = phase === 'ready'
  const complete = phase === 'complete'

  return (
    <Wrapper id="main">
      <Box>
        <Back to={complete ? '/login' : '/auth/forgot-password'}>&larr; Back to sign in</Back>
        <Card aria-live="polite">
          <Mark aria-hidden="true">A</Mark>
          <Title>{complete ? 'Password updated' : phase === 'verifying' ? 'Verifying reset link' : isReady ? 'Choose a new password' : 'Reset link unavailable'}</Title>
          <Subtitle>
            {complete
              ? 'Your password has been changed. Redirecting you to sign in securely.'
              : phase === 'verifying'
                ? 'We are securely verifying your recovery link.'
                : isReady
                  ? 'Create a strong password you have not used elsewhere.'
                  : 'Recovery links expire and can only be used once.'}
          </Subtitle>

          {error && <Message $tone="error" role="alert">{error}</Message>}
          {complete && <Message $tone="success">You can now sign in with your new password.</Message>}

          {isReady && (
            <form onSubmit={handleSubmit} noValidate>
              <Field>
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} autoFocus required />
              </Field>
              <Field>
                <Label htmlFor="confirm-new-password">Confirm new password</Label>
                <Input id="confirm-new-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required />
              </Field>
              <PasswordHint>Use at least 8 characters, including one uppercase letter and one number.</PasswordHint>
              <Button type="submit" $loading={loading} disabled={loading}>{loading ? 'Updating password…' : 'Set new password'}</Button>
            </form>
          )}

          {phase === 'invalid' && (
            <Button type="button" onClick={() => navigate('/auth/forgot-password', { replace: true })}>Request a new link</Button>
          )}
        </Card>
      </Box>
    </Wrapper>
  )
}

export default NewPassword
