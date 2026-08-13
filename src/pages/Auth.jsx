import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import styled from 'styled-components'

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
  max-width: 420px;
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
  border-radius: var(--radius-lg);
  padding: 40px 32px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  @media (max-width: 480px) {
    padding: 28px 20px;
    border-radius: var(--radius-md);
  }
`

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px;
  text-align: center;
  color: var(--text-primary);
`

const Subtitle = styled.p`
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
  margin: 0 0 28px;
`

const Message = styled.div`
  background: ${p => p.$tone === 'error' ? 'rgba(229,9,20,0.1)' : 'rgba(34,197,94,0.1)'};
  border: 1px solid ${p => p.$tone === 'error' ? 'rgba(229,9,20,0.35)' : 'rgba(34,197,94,0.35)'};
  border-radius: 8px;
  padding: 11px 14px;
  margin-bottom: 16px;
  color: ${p => p.$tone === 'error' ? '#f87171' : '#4ade80'};
  font-size: 13px;
  line-height: 1.55;
`

const Notice = styled.div`
  background: rgba(34,197,94,0.1);
  border: 1px solid rgba(34,197,94,0.3);
  border-radius: 12px;
  padding: 22px 18px;
  margin-bottom: 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.6;
  strong { color: #4ade80; overflow-wrap: anywhere; }
`

const Field = styled.div`
  margin-bottom: 16px;
`

const Label = styled.label`
  display: block;
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 6px;
`

const InputWrap = styled.div`
  position: relative;
`

const Input = styled.input`
  width: 100%;
  min-height: 46px;
  padding: 12px 42px 12px 14px;
  background: var(--bg-elevated);
  border: 1px solid ${p => p.$state === 'available' ? 'rgba(34,197,94,0.8)' : p.$state === 'taken' ? 'rgba(229,9,20,0.8)' : 'var(--border)'};
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 16px;
  outline: none;
  box-sizing: border-box;
  transition: border-color var(--transition-fast);
  &:focus { border-color: var(--accent); }
`

const InputStatus = styled.span`
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: ${p => p.$state === 'available' ? '#4ade80' : p.$state === 'taken' ? '#f87171' : 'var(--text-muted)'};
  font-size: ${p => p.$state === 'checking' ? '12px' : '17px'};
  line-height: 1;
  pointer-events: none;
`

const FieldHint = styled.p`
  min-height: 17px;
  margin: 6px 0 0;
  color: ${p => p.$state === 'available' ? '#4ade80' : p.$state === 'taken' ? '#f87171' : 'var(--text-muted)'};
  font-size: 12px;
  line-height: 1.4;
`

const Submit = styled.button`
  width: 100%;
  min-height: 46px;
  padding: 12px;
  background: var(--accent);
  color: var(--bg);
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  cursor: ${p => p.$loading ? 'wait' : 'pointer'};
  opacity: ${p => p.$loading ? 0.7 : 1};
`

const Footer = styled.p`
  text-align: center;
  margin: 20px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  a {
    color: var(--accent);
    text-decoration: none;
    font-weight: 600;
    &:hover { text-decoration: underline; }
  }
`

const ForgotLink = styled(Link)`
  color: var(--accent);
  text-decoration: none;
  font-size: 13px;
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  margin: -6px 0 12px;
  &:hover { text-decoration: underline; }
`

const cleanUsername = raw => raw
  .toLowerCase()
  .replace(/[^a-z0-9_]/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_|_$/g, '')
  .slice(0, 20)

const passwordIssue = password => {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one uppercase letter and one number.'
  }
  return ''
}

const Auth = ({ mode }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentKind, setSentKind] = useState('')
  const [usernameState, setUsernameState] = useState('idle')
  const requestId = useRef(0)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isLogin = mode === 'login'
  const isForgot = mode === 'forgot'
  const isSignup = !isLogin && !isForgot

  useEffect(() => {
    if (!isSignup || !username) {
      setUsernameState('idle')
      return undefined
    }

    const clean = cleanUsername(username)
    if (clean.length < 3) {
      setUsernameState('short')
      return undefined
    }
    if (!isSupabaseConfigured) {
      setUsernameState('unavailable')
      return undefined
    }

    const current = ++requestId.current
    setUsernameState('checking')
    const timer = window.setTimeout(async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('check_username_available', { username: clean })
        if (requestId.current !== current) return
        if (rpcError || typeof data !== 'boolean') {
          console.warn('Username availability check failed:', rpcError)
          setUsernameState('unavailable')
          return
        }
        setUsernameState(data ? 'available' : 'taken')
      } catch (checkError) {
        if (requestId.current === current) {
          console.warn('Username availability check failed:', checkError)
          setUsernameState('unavailable')
        }
      }
    }, 350)

    return () => {
      window.clearTimeout(timer)
      requestId.current += 1
    }
  }, [isSignup, username])

  useEffect(() => {
    if (isLogin && new URLSearchParams(location.search).get('password') === 'updated') {
      setSentKind('passwordUpdated')
    }
  }, [isLogin, location.search])

  const handleSubmit = async event => {
    event.preventDefault()
    setError('')
    if (isSignup) {
      const issue = passwordIssue(password)
      if (issue) { setError(issue); return }
      if (usernameState === 'taken') { setError('That username is already taken. Choose another one.'); return }
      if (usernameState === 'checking') { setError('Please wait while we check your username.'); return }
    }

    setLoading(true)
    try {
      if (isLogin) {
        await signIn(email, password)
        navigate('/home')
      } else {
        await signUp(email, password, cleanUsername(username))
        setSentKind('signup')
        setPassword('')
      }
    } catch (authError) {
      console.error('Auth error:', authError)
      const message = authError?.message
        ? (typeof authError.message === 'string' ? authError.message : JSON.stringify(authError.message))
        : authError?.error_description || authError?.error || 'Something went wrong. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleRecoveryRequest = async event => {
    event.preventDefault()
    setError('')
    if (!email) {
      setError('Enter the email address associated with your Aniraku account.')
      return
    }
    if (!isSupabaseConfigured) {
      setError('Password recovery is not configured yet. Please try again later.')
      return
    }

    setLoading(true)
    try {
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/new-password`,
      })
      if (recoveryError) throw recoveryError
      setSentKind('recovery')
    } catch (recoveryError) {
      setError(recoveryError?.message || 'We could not send the recovery email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const title = isForgot ? 'Reset your password' : isLogin ? 'Welcome back' : 'Create account'
  const subtitle = isForgot
    ? 'Enter your email and we’ll send you a secure recovery link.'
    : isLogin
      ? 'Sign in to continue watching on Aniraku.'
      : 'Join Aniraku to keep your watch history, ratings, and bookmarks in sync.'

  return (
    <Wrapper id="main">
      <Box>
        <Back to={isForgot ? '/login' : '/home'}>&larr; {isForgot ? 'Back to sign in' : 'Back to Home'}</Back>
        <Card>
          <Title>{title}</Title>
          <Subtitle>{subtitle}</Subtitle>

          {error && <Message $tone="error" role="alert">{error}</Message>}
          {sentKind === 'passwordUpdated' && <Message $tone="success">Your password was updated. Sign in with your new password.</Message>}

          {sentKind === 'signup' ? (
            <Notice>
              <strong>Check your inbox</strong><br />
              We sent an activation link to <strong>{email}</strong>.<br />
              Check spam or junk if it does not arrive within a few minutes.
            </Notice>
          ) : sentKind === 'recovery' ? (
            <Notice>
              <strong>Recovery link sent</strong><br />
              If an Aniraku account exists for <strong>{email}</strong>, a secure password-reset link is on its way.<br />
              The link opens the dedicated new-password screen and can be used once.
            </Notice>
          ) : isForgot ? (
            <form onSubmit={handleRecoveryRequest} noValidate>
              <Field>
                <Label htmlFor="recovery-email">Email address</Label>
                <Input id="recovery-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required />
              </Field>
              <Submit type="submit" $loading={loading} disabled={loading}>{loading ? 'Sending recovery link…' : 'Send recovery link'}</Submit>
            </form>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {isSignup && (
                <Field>
                  <Label htmlFor="signup-username">Username</Label>
                  <InputWrap>
                    <Input id="signup-username" type="text" value={username} onChange={event => setUsername(event.target.value)} required placeholder="Choose a username" autoComplete="username" $state={usernameState} aria-describedby="username-status" />
                    {usernameState === 'checking' && <InputStatus $state="checking">checking…</InputStatus>}
                    {usernameState === 'available' && <InputStatus $state="available">✓</InputStatus>}
                    {usernameState === 'taken' && <InputStatus $state="taken">×</InputStatus>}
                  </InputWrap>
                  <FieldHint id="username-status" $state={usernameState} aria-live="polite">
                    {usernameState === 'short' ? 'Use 3–20 letters, numbers, or underscores.' : ''}
                    {usernameState === 'available' ? `@${cleanUsername(username)} is available.` : ''}
                    {usernameState === 'taken' ? `@${cleanUsername(username)} is already taken.` : ''}
                    {usernameState === 'unavailable' ? 'Availability check is unavailable. You can still continue; we will verify on signup.' : ''}
                  </FieldHint>
                </Field>
              )}

              <Field>
                <Label htmlFor="auth-email">Email address</Label>
                <Input id="auth-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required placeholder="you@example.com" />
              </Field>

              <Field>
                <Label htmlFor="auth-password">Password</Label>
                <Input id="auth-password" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} required placeholder={isSignup ? '8+ characters, uppercase and number' : 'Your password'} />
              </Field>

              {isLogin && <ForgotLink to="/auth/forgot-password">Forgot password?</ForgotLink>}

              <Submit type="submit" $loading={loading} disabled={loading}>
                {loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
              </Submit>
            </form>
          )}

          <Footer>
            {isForgot ? 'Remember your password? ' : isLogin ? "Don’t have an account? " : 'Already have an account? '}
            <Link to={isForgot ? '/login' : isLogin ? '/signup' : '/login'}>
              {isForgot ? 'Sign in' : isLogin ? 'Sign up' : 'Sign in'}
            </Link>
          </Footer>
        </Card>
      </Box>
    </Wrapper>
  )
}

export default Auth
