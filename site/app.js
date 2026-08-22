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
