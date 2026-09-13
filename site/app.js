// ═══ ANIRAKU V5.4 — Landing Page JS ═══

const REPO = "Aniraku/Aniraku-App";
const api = "https://api.github.com/repos";
const FALLBACK_TAG = "v5.4.3";
// Archive: latest release expanded + this many compact rows visible;
// anything older hides behind the "show all" toggle.
const ARCHIVE_VISIBLE = 4;

// Support-prompt cadence: auto-show 30 min after first visit,
// "ask again" snoozes for 7 days.
const SUPPORT_PROMPT_ACTIVE_MS = 30 * 60 * 1000;
const SUPPORT_PROMPT_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const SUPPORT_PROMPT_SEEN_KEY = "aniraku.support-prompt.seen-at";
const SUPPORT_PROMPT_SNOOZE_KEY = "aniraku.support-prompt.snooze-until";

// ─── Reveal on scroll ───
function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

// ─── Version + arch-aware downloads ───
function assetUrlFor(releases, match) {
  for (const r of releases) {
    const asset = r.assets?.find((a) => match.test(a.name));
    if (asset) return { url: asset.browser_download_url, tag: r.tag_name };
  }
  return null;
}

function setArchHref(id, found, fallback) {
  const el = document.getElementById(id);
  if (!el) return;
  if (found) el.href = found.url;
  else el.href = fallback;
}

async function loadReleases() {
  const list = document.getElementById("release-list");
  const applyVersion = (tag) => {
    const short = tag.replace(/^v/, "V");
    for (const id of ["hero-version", "install-latest"]) {
      const el = document.getElementById(id);
      if (el) el.textContent = tag;
    }
    const nav = document.getElementById("nav-version");
    if (nav) nav.textContent = short;
    const heroTag = document.getElementById("hero-tag");
    if (heroTag) heroTag.textContent = short;
    const uniVer = document.getElementById("arch-universal-ver");
    if (uniVer) uniVer.textContent = short;
  };

  applyVersion(FALLBACK_TAG);
  setArchHref("arch-universal", null, `https://github.com/${REPO}/releases/download/${FALLBACK_TAG}/aniraku-${FALLBACK_TAG}-universal.apk`);
  setArchHref("arch-arm64", null, `https://github.com/${REPO}/releases/download/${FALLBACK_TAG}/aniraku-${FALLBACK_TAG}-arm64.apk`);
  setArchHref("arch-arm32", null, `https://github.com/${REPO}/releases/download/${FALLBACK_TAG}/aniraku-${FALLBACK_TAG}-arm32.apk`);
  const heroDl = document.getElementById("hero-download");
  if (heroDl) heroDl.href = `https://github.com/${REPO}/releases/download/${FALLBACK_TAG}/aniraku-${FALLBACK_TAG}-universal.apk`;

  if (!list) return;
  try {
    const res = await fetch(`${api}/${REPO}/releases?per_page=20`);
    if (!res.ok) throw new Error(`${res.status}`);
    const releases = await res.json();
    if (!releases.length) {
      list.innerHTML = '<div class="release-loading">No releases yet</div>';
      return;
    }

    const latest = releases[0];
    applyVersion(latest.tag_name);

    const uni = assetUrlFor(releases, /universal\.apk$/i);
    const arm64 = assetUrlFor(releases, /arm64\.apk$/i);
    const arm32 = assetUrlFor(releases, /arm32\.apk$/i);
    const best = uni || arm64 || arm32;
    if (uni) setArchHref("arch-universal", uni, "");
    if (arm64) setArchHref("arch-arm64", arm64, "");
    if (arm32) setArchHref("arch-arm32", arm32, "");
    if (best && heroDl) heroDl.href = best.url;

    const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const apkStats = (r) => {
      const apks = (r.assets || []).filter((a) => a.name.endsWith(".apk"));
      return {
        apks,
        totalDl: apks.reduce((n, a) => n + (a.download_count || 0), 0),
        totalSize: apks.reduce((n, a) => n + (a.size || 0), 0),
      };
    };
    const describe = (r) => r.body
      ? r.body.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim() || r.name
      : r.name;

    // ── Latest release: expanded card, one row per APK ──
    const { apks: latestApks, totalDl: latestDl } = apkStats(latest);
    const latestRows = latestApks
      .map((a) => `
      <a href="${a.browser_download_url}" class="asset-row" rel="noopener">
        <span class="asset-tag">${archTag(a.name)}</span>
        <span class="asset-name">${esc(a.name)}</span>
        <span class="asset-meta">${fmtSize(a.size)}${a.download_count ? ` · ${fmtCount(a.download_count)}` : ""}</span>
        <span class="asset-dl">↓</span>
      </a>`)
      .join("");
    const latestHtml = `
      <div class="release-latest">
        <a href="${latest.html_url}" class="release-entry" target="_blank" rel="noopener">
          <span class="release-badge">LATEST</span>
          <div class="release-info">
            <h3>${esc(latest.name || latest.tag_name)}</h3>
            <p>${esc(describe(latest))}</p>
          </div>
          <div class="release-meta">
            <span class="release-date">${fmtDate(latest.published_at)}${latestDl ? ` · ${fmtCount(latestDl)}` : ""}</span>
            <span class="release-link">Get the APKs ↓</span>
          </div>
        </a>
        ${latestRows ? `<div class="asset-rows">${latestRows}</div>` : ""}
      </div>`;

    // ── Older releases: compact rows to the release page ──
    const compactEntry = (r) => {
      const { apks, totalDl, totalSize } = apkStats(r);
      const meta = [fmtDate(r.published_at)];
      if (apks.length > 1) meta.push(`${apks.length} APKs`);
      if (totalSize) meta.push(fmtSize(totalSize));
      if (totalDl) meta.push(fmtCount(totalDl));
      return `
      <a href="${r.html_url}" class="release-entry" target="_blank" rel="noopener">
        <span class="release-badge release-badge-old">${esc(r.tag_name)}</span>
        <div class="release-info">
          <h3>${esc(r.name || r.tag_name)}</h3>
          <p>${esc(describe(r))}</p>
        </div>
        <div class="release-meta">
          <span class="release-date">${meta.join(" · ")}</span>
          <span class="release-link">${apks.length ? "Release Notes →" : "View Release →"}</span>
        </div>
      </a>`;
    };

    const older = releases.slice(1);
    const visible = older.slice(0, ARCHIVE_VISIBLE);
    const hidden = older.slice(ARCHIVE_VISIBLE);
    list.innerHTML =
      latestHtml +
      visible.map(compactEntry).join("") +
      (hidden.length
        ? `<div class="archive-older">${hidden.map(compactEntry).join("")}</div>
           <button class="archive-toggle" type="button" data-archive-toggle><span>SHOW ALL ${older.length} RELEASES +</span></button>`
        : "") +
      `<a href="https://github.com/${REPO}/releases" class="release-foot" target="_blank" rel="noopener"><span>EVERYTHING ON GITHUB</span><span>→</span></a>`;

    const toggle = list.querySelector("[data-archive-toggle]");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const box = list.querySelector(".archive-older");
        const open = box.classList.toggle("open");
        toggle.querySelector("span").textContent = open
          ? "SHOW FEWER −"
          : `SHOW ALL ${older.length} RELEASES +`;
      });
    }
  } catch (e) {
    list.innerHTML = `<div class="release-loading">Failed to load releases — <a href="https://github.com/${REPO}/releases" target="_blank" style="color:var(--red)">view on GitHub</a></div>`;
    console.error("Release load error:", e);
  }
}

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  const mb = bytes / 1048576;
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

function fmtCount(n) {
  if (n === undefined || n === null) return "";
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k downloads`;
  return `${n} download${n === 1 ? "" : "s"}`;
}

function archTag(name) {
  const n = name.toLowerCase();
  if (n.includes("universal")) return "UNIVERSAL";
  if (n.includes("arm64")) return "ARM64";
  if (n.includes("arm32") || n.includes("armeabi")) return "ARM32";
  return "APK";
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// ─── Support modal + timed prompt ───
function initSupport() {
  const modal = document.getElementById("support-prompt");
  if (!modal) return;
  const closeBtn = modal.querySelector(".modal-close");
  const laterBtn = modal.querySelector("[data-support-prompt-dismiss], .modal-later");
  const showModal = () => modal.classList.add("show");
  const hideModal = () => modal.classList.remove("show");
  const snooze = () => {
    try {
      localStorage.setItem(SUPPORT_PROMPT_SNOOZE_KEY, String(Date.now() + SUPPORT_PROMPT_DISMISS_MS));
    } catch { /* private mode */ }
    hideModal();
  };

  // Timed first-run prompt: 30 min after first visit, unless snoozed.
  try {
    const seen = localStorage.getItem(SUPPORT_PROMPT_SEEN_KEY);
    const snoozedUntil = Number(localStorage.getItem(SUPPORT_PROMPT_SNOOZE_KEY) || 0);
    if (!seen) localStorage.setItem(SUPPORT_PROMPT_SEEN_KEY, String(Date.now()));
    const firstSeen = Number(seen || Date.now());
    const wait = Math.max(0, firstSeen + SUPPORT_PROMPT_ACTIVE_MS - Date.now());
    if (Date.now() >= snoozedUntil) {
      setTimeout(() => {
        if (Date.now() < Number(localStorage.getItem(SUPPORT_PROMPT_SNOOZE_KEY) || 0)) return;
        showModal();
      }, wait);
    }
  } catch { /* private mode */ }

  if (closeBtn) closeBtn.addEventListener("click", hideModal);
  if (laterBtn) laterBtn.addEventListener("click", snooze);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) hideModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideModal();
  });
}

// ─── Copy buttons (incl. support address) ───
function initCopy() {
  document.querySelectorAll(".copy-btn, [data-copy-support]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.dataset.copy || btn.getAttribute("data-copy-support");
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        const msg = btn.parentElement.querySelector(".copy-msg");
        if (msg) {
          msg.textContent = "Copied";
          setTimeout(() => (msg.textContent = ""), 2000);
        }
      });
    });
  });
}

// ─── Smooth nav scroll ───
function initNav() {
  document.querySelectorAll('.nav a[href^="#"], .dock a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
  // Active dock link on scroll
  const dockLinks = [...document.querySelectorAll(".dock a")];
  const sections = dockLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);
  if (!("IntersectionObserver" in window) || !sections.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        dockLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${e.target.id}`));
      }
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  sections.forEach((s) => obs.observe(s));
}

// ─── Init ───
document.addEventListener("DOMContentLoaded", () => {
  initReveal();
  loadReleases();
  initSupport();
  initNav();
  initCopy();
});
