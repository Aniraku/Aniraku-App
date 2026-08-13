import { Suspense, lazy, Component, useEffect, useState } from "react"
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"
import { AuthProvider } from "./hooks/useAuth"
import { setTitle } from "./lib/seo"
import { configureNativeAndroid, isNativeAndroid } from "./lib/nativeAndroid"
import NavBar from "./components/NavBar/NavBar"
import MobileBottomNav from "./components/MobileBottomNav"
import Error from "./pages/Error"
import Home from "./pages/Home"
import Skeleton from "./components/Loader/Skeleton"

class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidUpdate(prevProps) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  retry = () => {
    this.setState({ hasError: false, error: null })
  }

  home = () => {
    window.location.href = "/"
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", background: "#000", color: "#e2e8f0", padding: "1rem", textAlign: "center" }}>
          <h2 style={{ marginBottom: "0.5rem" }}>Something went wrong</h2>
                        <p style={{ maxWidth: 520, marginBottom: "1rem", color: "var(--text-muted, #8c8c8c)", lineHeight: 1.6 }}>{this.state.error?.message || "An unexpected error occurred."}</p>
              <p style={{ maxWidth: 520, marginBottom: "1rem", color: "var(--text-muted, #8c8c8c)", fontSize: "0.85rem", lineHeight: 1.5 }}>No account or playback data was changed. You can retry, return home, or report this diagnostic to the Aniraku project.</p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>

            <button
              onClick={this.retry}
              style={{ padding: "0.5rem 1.5rem", background: "var(--accent)", color: "#000", border: "none", borderRadius: "9999px", cursor: "pointer", fontSize: "1rem", fontWeight: 600 }}
            >
              Try again
            </button>
            <button
              onClick={this.home}
              style={{ padding: "0.5rem 1.5rem", background: "transparent", color: "var(--text-muted, #8c8c8c)", border: "1px solid var(--border, #333)", borderRadius: "9999px", cursor: "pointer", fontSize: "1rem" }}
            >
              Back to Home
            </button>
            <a
              href="https://github.com/Aniraku/Aniraku/issues/new?template=bug_report.md"
              target="_blank"
              rel="noreferrer"
              style={{ padding: "0.5rem 1.5rem", color: "var(--text-muted, #8c8c8c)", border: "1px solid var(--border, #333)", borderRadius: "9999px", fontSize: "1rem", textDecoration: "none" }}
            >
              Report a problem
            </a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const RouteBoundary = ({ children }) => {
  const { pathname } = useLocation()
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
}

const Watch = lazy(() => import("./pages/Watch"))
const Dmca = lazy(() => import("./pages/Dmca"))
const Privacy = lazy(() => import("./pages/Privacy"))
const License = lazy(() => import("./pages/License"))
const Terms = lazy(() => import("./pages/Terms"))
const CommunityGuidelines = lazy(() => import("./pages/CommunityGuidelines"))

const AnimeDetail = lazy(() => import("./pages/AnimeDetail"))
const Auth = lazy(() => import("./pages/Auth"))
const NewPassword = lazy(() => import("./pages/NewPassword"))
const Profile = lazy(() => import("./pages/Profile"))
const Settings = lazy(() => import("./pages/Settings"))
const Catalog = lazy(() => import("./pages/Catalog"))
const Schedule = lazy(() => import("./pages/Schedule"))
const Admin = lazy(() => import("./pages/Admin"))
const Random = lazy(() => import("./pages/Random"))
const SyncCallback = lazy(() => import("./pages/SyncCallback"))

const GenreRedirect = () => {
      const genre = window.location.pathname.replace('/genre/', '')

  return <Navigate to={`/catalog?genre=${encodeURIComponent(genre)}`} replace />
}

// ScrollToTop + SEO meta reset on route change
const ScrollToTop = () => {
  const { pathname, search } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    // Remove any previous structured data scripts added by page components
    const existing = document.querySelectorAll('script[data-aniraku-seo="true"]')
    existing.forEach(el => el.remove())
  }, [pathname])

  // Give routes without their own async SEO metadata a deterministic title.
  // Watch/anime/catalog and the dedicated SEO pages overwrite this in their
  // own effects once their data is ready.
  useEffect(() => {
    if (pathname.startsWith('/watch/') || pathname.startsWith('/anime/') || pathname === '/catalog' || pathname === '/schedule') return
    if (pathname === '/' || pathname === '/home') return

    const routeTitles = {
      '/profile': 'Profile — Aniraku',
      '/profile/settings': 'Settings — Aniraku',
      '/login': 'Sign In — Aniraku',
      '/signup': 'Create Account — Aniraku',
      '/auth/forgot-password': 'Reset Password — Aniraku',
      '/auth/new-password': 'Choose a New Password — Aniraku',
      '/admin': 'Admin — Aniraku',
      '/random': 'Random Anime — Aniraku',
      '/sync/callback': 'Library Sync — Aniraku',
      '/dmca': 'DMCA — Aniraku',
      '/privacy': 'Privacy Policy — Aniraku',
      '/license': 'AGPL-3.0 License — Aniraku',
      '/terms': 'Terms of Service — Aniraku',
      '/community-guidelines': 'Community Guidelines — Aniraku',
    }
    setTitle(routeTitles[pathname] || (search ? 'Aniraku' : 'Aniraku — Free Anime Streaming'))
  }, [pathname, search])

  return null
}

const NativeAndroidExperience = () => {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let dispose = () => {}
    configureNativeAndroid({
      onNetworkChange: (status) => setOffline(status?.connected === false),
    }).then((cleanup) => {
      dispose = cleanup
    })
    return () => dispose()
  }, [])

  if (!isNativeAndroid() || !offline) return null
  return (
    <div className="native-offline-banner" role="status" aria-live="polite">
      You’re offline. Browse saved pages or reconnect to continue streaming.
    </div>
  )
}

const App = () => {
  const nativeAndroid = isNativeAndroid()
  return (
    <BrowserRouter>
      <a className="skip-link" href="#main">Skip to content</a>
      <AuthProvider>
        <ErrorBoundary>
          <NativeAndroidExperience />
          <ScrollToTop />
          <NavBar />
          <MobileBottomNav />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/catalog" element={<Suspense fallback={<Skeleton />}><Catalog /></Suspense>} />
            <Route path="/schedule" element={<Suspense fallback={<Skeleton />}><Schedule /></Suspense>} />
            <Route path="/watch/:slugId" element={<RouteBoundary><Suspense fallback={<Skeleton />}><Watch /></Suspense></RouteBoundary>} />
            <Route path="/anime/:slugId" element={<RouteBoundary><Suspense fallback={<Skeleton />}><AnimeDetail /></Suspense></RouteBoundary>} />
            <Route path="/dmca" element={<Suspense fallback={<Skeleton />}><Dmca /></Suspense>} />
            <Route path="/privacy" element={<Suspense fallback={<Skeleton />}><Privacy /></Suspense>} />
            <Route path="/license" element={<Suspense fallback={<Skeleton />}><License /></Suspense>} />
            <Route path="/terms" element={<Suspense fallback={<Skeleton />}><Terms /></Suspense>} />
            <Route path="/community-guidelines" element={<Suspense fallback={<Skeleton />}><CommunityGuidelines /></Suspense>} />

            <Route path="/login" element={<Suspense fallback={<Skeleton />}><Auth mode="login" /></Suspense>} />
            <Route path="/signup" element={<Suspense fallback={<Skeleton />}><Auth mode="signup" /></Suspense>} />
            <Route path="/auth/forgot-password" element={<Suspense fallback={<Skeleton />}><Auth mode="forgot" /></Suspense>} />
            <Route path="/auth/new-password" element={<Suspense fallback={<Skeleton />}><NewPassword /></Suspense>} />
            <Route path="/profile" element={<Suspense fallback={<Skeleton />}><Profile /></Suspense>} />
            <Route path="/profile/settings" element={<Suspense fallback={<Skeleton />}><Settings /></Suspense>} />
            <Route path="/sync/callback" element={<Suspense fallback={<Skeleton />}><SyncCallback /></Suspense>} />
            <Route path="/settings" element={<Navigate to="/profile/settings" replace />} />
            <Route path="/admin" element={<Suspense fallback={<Skeleton />}><Admin /></Suspense>} />
            {/* Redirect aliases for sidebar nav */}
            <Route path="/top-airing" element={<Navigate to="/catalog?status=RELEASING" replace />} />
            <Route path="/most-popular" element={<Navigate to="/catalog?sort=POPULARITY_DESC" replace />} />
            <Route path="/movies" element={<Navigate to="/catalog?format=MOVIE" replace />} />
            <Route path="/tv-series" element={<Navigate to="/catalog?format=TV" replace />} />
            <Route path="/genre/:genre" element={<GenreRedirect />} />
            <Route path="/random" element={<Suspense fallback={<Skeleton />}><Random /></Suspense>} />
            <Route path="/*" element={<Error />} />
          </Routes>
          {!nativeAndroid && <Analytics />}
          {!nativeAndroid && <SpeedInsights />}
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
