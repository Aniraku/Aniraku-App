const NUISANCE_HOST_SUFFIXES = [
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "adnxs.com",
  "adskeeper.co.uk",
  "adsterra.com",
  "exoclick.com",
  "popads.net",
  "popcash.net",
  "propellerads.com",
  "trafficjunky.net",
  "hilltopads.net",
  "onclicka.com",
  "clickadu.com",
  "monetag.com",
  "ad-maven.com",
  "juicyads.com",
  "push.house",
  "richpush.com",
  "tsyndicate.com",
];

function hasBlockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return NUISANCE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/**
 * Android WebView can guard main-frame popups and redirects, but it cannot
 * safely intercept arbitrary video subresources from React Native. Keep every
 * provider/player route reachable and refuse only a small, reviewable set of
 * known advertising and tracking navigation hosts.
 */
export function shouldAllowEmbedNavigation(url: string) {
  try {
    const parsed = new URL(url);
    const allowed = (parsed.protocol === "https:" || parsed.protocol === "http:") && !hasBlockedHost(parsed.hostname);
    if (!allowed) console.info(`[Aniraku embed] navigation blocked: ${parsed.protocol}//${parsed.hostname || "unknown"}`);
    return allowed;
  } catch {
    console.info("[Aniraku embed] navigation blocked: invalid URL");
    return false;
  }
}

export const embeddedPopupGuardScript = `
  (function () {
    window.open = function () { return null; };
    window.alert = function () { return undefined; };
    window.confirm = function () { return false; };
    document.addEventListener('click', function (event) {
      var node = event.target;
      while (node && node.tagName !== 'A') node = node.parentElement;
      if (node && node.target === '_blank') {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    document.addEventListener('submit', function (event) {
      var form = event.target;
      if (form && form.target === '_blank') {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  })();
  true;
`;
