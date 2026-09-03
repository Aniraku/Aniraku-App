// ═══ ANIRAKU V5 — Landing Page JS ═══

const REPO = "Aniraku/Aniraku-App";
const api = "https://api.github.com/repos";

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

// ─── Releases ───
async function loadReleases() {
  const list = document.getElementById("release-list");
  if (!list) return;

  try {
    const res = await fetch(`${api}/${REPO}/releases?per_page=20`);
    if (!res.ok) throw new Error(`${res.status}`);
    const releases = await res.json();

    if (!releases.length) {
      list.innerHTML = '<div class="release-loading">No releases yet</div>';
      return;
    }

    // Latest version for hero/install
    const latest = releases[0];
    const tag = latest.tag_name;
    const shortTag = tag.replace(/^v/, "");
    const versionEl = document.getElementById("hero-version");
    if (versionEl) versionEl.textContent = tag;
    const installLatest = document.getElementById("install-latest");
    if (installLatest) installLatest.textContent = tag;

    // Find APK asset
    let apkName = `aniraku-${tag}.apk`;
    let apkUrl = "";
    for (const r of releases) {
      const asset = r.assets?.find((a) => a.name.endsWith(".apk"));
      if (asset) {
        apkName = asset.name;
        apkUrl = asset.browser_download_url;
        break;
      }
    }

    // Render releases
    list.innerHTML = releases
      .map((r, i) => {
        const date = new Date(r.published_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        const asset = r.assets?.find((a) => a.name.endsWith(".apk"));
        const url = asset?.browser_download_url || r.html_url;
        const badge = i === 0 ? "LATEST" : r.tag_name;
        const desc = r.body
          ? r.body.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim() ||
            r.name
          : r.name;
        return `
          <a href="${url}" class="release-entry" target="_blank" rel="noopener">
            <span class="release-badge">${badge}</span>
            <div class="release-info">
              <h3>${r.name || r.tag_name}</h3>
              <p>${esc(desc)}</p>
            </div>
            <div class="release-meta">
              <span class="release-date">${date}</span>
              <span class="release-link">${asset ? "Download APK →" : "View Release →"}</span>
            </div>
          </a>`;
      })
      .join("");
  } catch (e) {
    list.innerHTML = `<div class="release-loading">Failed to load releases — <a href="https://github.com/${REPO}/releases" target="_blank" style="color:var(--red)">view on GitHub</a></div>`;
    console.error("Release load error:", e);
  }
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// ─── Support modal ───
function initSupport() {
  const modal = document.getElementById("support-prompt");
  if (!modal) return;

  const trigger = document.querySelector('.dock [href="#support"]');
  const closeBtn = modal.querySelector(".modal-close");
  const laterBtn = modal.querySelector(".modal-later");

  function showModal() {
    modal.classList.add("show");
  }
  function hideModal() {
    modal.classList.remove("show");
  }

  if (trigger) {
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      showModal();
    });
  }

  if (closeBtn) closeBtn.addEventListener("click", hideModal);
  if (laterBtn) laterBtn.addEventListener("click", hideModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) hideModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideModal();
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
}

// ─── Copy button ───
function initCopy() {
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.dataset.copy;
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

// ─── Init ───
document.addEventListener("DOMContentLoaded", () => {
  initReveal();
  loadReleases();
  initSupport();
  initNav();
  initCopy();
});
