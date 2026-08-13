import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Keyboard } from '@capacitor/keyboard'
import { Network } from '@capacitor/network'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

export const isNativeAndroid = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

const addNativeListener = async (cleanup, registration) => {
  try {
    const handle = await registration
    if (handle?.remove) cleanup.push(() => handle.remove())
  } catch {
    // Native integrations are progressive enhancements. The web app remains
    // usable if an older Android WebView lacks a plugin capability.
  }
}

const navigateFromAppUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'aniraku:') return

    // Supported links are either aniraku://open/watch/... or
    // aniraku://watch/... . Keep the React Router history in sync.
    const path = url.hostname === 'open'
      ? `${url.pathname}${url.search}${url.hash}`
      : `/${url.hostname}${url.pathname}${url.search}${url.hash}`
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    if (normalizedPath === window.location.pathname + window.location.search) return

    window.history.pushState({}, '', normalizedPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  } catch {
    // Ignore malformed or unrelated Android intent URLs.
  }
}

export const configureNativeAndroid = async ({ onNetworkChange } = {}) => {
  if (!isNativeAndroid()) return () => {}

  document.documentElement.classList.add('native-android')
  const cleanup = []

  try {
    await StatusBar.setOverlaysWebView({ overlay: true })
    await StatusBar.setBackgroundColor({ color: '#000000' })
    await StatusBar.setStyle({ style: Style.Dark })
  } catch {
    // The app is still fully functional if status-bar customization is absent.
  }

  try {
    await Keyboard.setResizeMode({ mode: 'body' })
  } catch {
    // Some Android WebView versions manage keyboard resizing themselves.
  }

  try {
    const initialStatus = await Network.getStatus()
    onNetworkChange?.(initialStatus)
  } catch {
    onNetworkChange?.({ connected: navigator.onLine })
  }

  await addNativeListener(cleanup, Network.addListener('networkStatusChange', (status) => {
    onNetworkChange?.(status)
  }))

  await addNativeListener(cleanup, App.addListener('appUrlOpen', ({ url }) => {
    navigateFromAppUrl(url)
  }))

  await addNativeListener(cleanup, App.addListener('backButton', ({ canGoBack }) => {
    const route = window.location.pathname
    const hasOverlay = document.querySelector('[role="dialog"][aria-modal="true"]')
    if (hasOverlay) {
      document.dispatchEvent(new Event('aniraku:native-back'))
      return
    }
    if (canGoBack && route !== '/' && route !== '/home') {
      window.history.back()
      return
    }
    App.minimizeApp().catch(() => {})
  }))

  try {
    await SplashScreen.hide({ fadeOutDuration: 180 })
  } catch {
    // Splash dismissal is non-critical and must never block playback.
  }

  return () => {
    document.documentElement.classList.remove('native-android')
    cleanup.forEach((remove) => {
      try { remove() } catch { /* no-op */ }
    })
  }
}
