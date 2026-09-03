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
const GITHUB_RELEASES_API =
  "https://api.github.com/repos/Aniraku/Aniraku-App/releases";

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

/* ═══ RELEASE ARCHIVE ═══ */
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function stripMarkdown(text) {
  return String(text || "")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
}

function populateReleaseArchive(releases) {
  const list = document.getElementById("release-list");
  const countEl = document.getElementById("release-count");
  if (!list || !releases?.length) return;

  const count = releases.length;
  if (countEl) countEl.textContent = `${count} RELEASES PUBLISHED`;

  list.innerHTML = releases
    .map((release, i) => {
      const tag = formatReleaseTag(release.tag_name) || release.tag_name;
      const apk = release.assets?.find((a) => /\.apk$/i.test(a.name || ""));
      const body = stripMarkdown(release.body);
      const date = formatDate(release.published_at || release.created_at);
      const isLatest = i === 0;
      return `
      <a class="release-entry" href="${release.html_url}" target="_blank" rel="noreferrer">
        <span class="release-badge">${isLatest ? "LATEST" : tag}</span>
        <div class="release-info">
          <h3>${tag}${apk ? ` — ${apk.name}` : ""}</h3>
          <p>${body || "No release notes provided."}</p>
        </div>
        <div class="release-meta">
          <span class="release-date">${date}</span>
          <span class="release-link">VIEW ↗</span>
        </div>
      </a>`;
    })
    .join("");
}

fetch(GITHUB_RELEASES_API, {
  headers: { Accept: "application/vnd.github+json" },
})
  .then((r) => (r.ok ? r.json() : null))
  .then((releases) => {
    if (Array.isArray(releases)) populateReleaseArchive(releases);
  })
  .catch(() => {});

/* ═══ PACKAGE ID COPY ═══ */
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

/* ═══ SUPPORT ADDRESS COPY ═══ */
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

/* ═══ SUPPORT PROMPT ═══ */
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

/* ═══ MOBILE DOCK ═══ */
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

/* ═══ FAQ TOGGLES ═══ */
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

/* ═══ SCROLL REVEAL ═══ */
if ("IntersectionObserver" in window) {
  const revealElements = document.querySelectorAll(
    ".screen-card, .detail-stack li, .release-entry, .docs-grid a, .proof-strip div, .install-checklist li"
  );
  revealElements.forEach((el) => el.classList.add("reveal"));

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );

  revealElements.forEach((el) => revealObserver.observe(el));
}
