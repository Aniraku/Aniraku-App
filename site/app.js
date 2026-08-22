const packageButton = document.querySelector("[data-copy]");
const copyFeedback = document.querySelector(".copy-feedback");
const releaseVersionNodes = [
  ...document.querySelectorAll("[data-release-version]"),
];
const releaseApkLinks = [...document.querySelectorAll("[data-release-apk]")];
const releaseNotesLinks = [
  ...document.querySelectorAll("[data-release-notes]"),
];
const releaseApkNameNodes = [
  ...document.querySelectorAll("[data-release-apk-name]"),
];
const GITHUB_LATEST_RELEASE_API =
  "https://api.github.com/repos/Aniraku/Aniraku-App/releases/latest";

function formatReleaseTag(tag) {
  const value = String(tag || "").trim();
  return /^v?\d+(?:\.\d+){1,3}(?:[-.][\w]+)?$/i.test(value)
    ? value.toUpperCase().replace(/^V/, "V")
    : null;
}

function applyPublishedRelease(release) {
  const label = formatReleaseTag(release?.tag_name);
  const apk = release?.assets?.find((asset) =>
    /\.apk$/i.test(asset.name || ""),
  );
  if (!label || !apk?.browser_download_url || !release?.html_url) return;

  releaseVersionNodes.forEach((node) => {
    node.textContent = label;
  });
  releaseApkLinks.forEach((link) => {
    link.href = apk.browser_download_url;
  });
  releaseNotesLinks.forEach((link) => {
    link.href = release.html_url;
  });
  releaseApkNameNodes.forEach((node) => {
    node.textContent = apk.name;
  });
  document.title = `Aniraku ${label} — Native Android anime`;
}

fetch(GITHUB_LATEST_RELEASE_API, {
  headers: { Accept: "application/vnd.github+json" },
})
  .then((response) => (response.ok ? response.json() : null))
  .then(applyPublishedRelease)
  .catch(() => {});

if (packageButton && copyFeedback) {
  packageButton.addEventListener("click", async () => {
    const value = packageButton.dataset.copy;
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard API unavailable");
      await Promise.race([
        navigator.clipboard.writeText(value),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Clipboard timeout")), 900),
        ),
      ]);
      copyFeedback.textContent = "Package ID copied: aniraku.anime.app";
    } catch {
      copyFeedback.textContent = "Package ID: aniraku.anime.app";
    }
  });
}

const supportCopyButtons = [...document.querySelectorAll("[data-copy-support]")];
supportCopyButtons.forEach((supportCopyButton) => {
  supportCopyButton.addEventListener("click", async () => {
    const value = supportCopyButton.dataset.copySupport;
    const supportCopyFeedback = supportCopyButton.parentElement?.querySelector(".support-copy-feedback");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(value);
      if (supportCopyFeedback) supportCopyFeedback.textContent = "USDT BEP20 address copied.";
    } catch {
      if (supportCopyFeedback) supportCopyFeedback.textContent = value;
    }
  });
});

const SUPPORT_PROMPT_ACTIVE_MS = 30 * 60 * 1000;
const SUPPORT_PROMPT_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const SUPPORT_PROMPT_DISMISS_KEY = "aniraku.support.dismissed-until";
const supportPrompt = document.querySelector("[data-support-prompt]");
const supportPromptDismiss = document.querySelectorAll("[data-dismiss-support]");

if (supportPrompt) {
  let activeMs = 0;
  let activeStartedAt = Date.now();
  let documentVisible = document.visibilityState === "visible";
  const dismissedUntil = () => Number(localStorage.getItem(SUPPORT_PROMPT_DISMISS_KEY) || 0) || 0;
  const isDismissed = (now = Date.now()) => dismissedUntil() > now;
  const dismissSupport = () => {
    localStorage.setItem(SUPPORT_PROMPT_DISMISS_KEY, String(Date.now() + SUPPORT_PROMPT_DISMISS_MS));
    supportPrompt.hidden = true;
  };
  const updateVisibility = () => {
    const now = Date.now();
    const isVisible = document.visibilityState === "visible";
    if (documentVisible && !isVisible) activeMs += now - activeStartedAt;
    if (!documentVisible && isVisible) activeStartedAt = now;
    documentVisible = isVisible;
  };
  const evaluateSupportPrompt = () => {
    if (!documentVisible || !supportPrompt.hidden || isDismissed()) return;
    const elapsed = activeMs + (Date.now() - activeStartedAt);
    if (elapsed >= SUPPORT_PROMPT_ACTIVE_MS) supportPrompt.hidden = false;
  };
  document.addEventListener("visibilitychange", updateVisibility);
  supportPromptDismiss.forEach((button) => button.addEventListener("click", dismissSupport));
  supportPrompt.addEventListener("mousedown", (event) => { if (event.target === supportPrompt) dismissSupport(); });
  setInterval(evaluateSupportPrompt, 15000);
  evaluateSupportPrompt();
}

const dockLinks = [...document.querySelectorAll(".mobile-dock a")];
const sections = dockLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

if ("IntersectionObserver" in window && sections.length && dockLinks.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      dockLinks.forEach((link) => {
        link.classList.toggle(
          "is-active",
          link.getAttribute("href") === `#${visible.target.id}`,
        );
      });
    },
    { rootMargin: "-34% 0px -54% 0px", threshold: [0.1, 0.35] },
  );
  sections.forEach((section) => observer.observe(section));
}

const faqItems = [...document.querySelectorAll(".faq-item")];
faqItems.forEach((item) => {
  item.addEventListener("toggle", () => {
    const control = item.querySelector("summary i");
    if (control) control.textContent = item.open ? "−" : "+";
    if (item.open)
      faqItems.forEach((other) => {
        if (other !== item) other.removeAttribute("open");
      });
  });
});
