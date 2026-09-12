import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, script, styles] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./app.js", import.meta.url), "utf8"),
  readFile(new URL("./app.css", import.meta.url), "utf8"),
]);

// ─── Support section (Patreon + Binance Pay, no USDT) ───
assert.ok(html.includes("https://patreon.com/ShoIslam"));
assert.ok(html.includes("1098400042"));
assert.ok(html.includes("data-copy-support"));
assert.ok(html.includes("data-support-prompt"));
assert.ok(html.includes("ASK AGAIN IN 7 DAYS"));
assert.ok(!html.includes("BEP20"));
assert.match(script, /SUPPORT_PROMPT_ACTIVE_MS = 30 \* 60 \* 1000/);
assert.match(script, /SUPPORT_PROMPT_DISMISS_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
assert.match(script, /querySelectorAll\("\.copy-btn, \[data-copy-support\]"\)/);

// ─── Docs grid mirrors the repo docs (no dead subdomain) ───
for (const doc of ["PRIVACY.md", "TERMS.md", "DMCA.md", "SECURITY.md", "SUPPORT.md", "CONTRIBUTING.md", "CHANGELOG.md"]) {
  assert.ok(
    html.includes(`https://github.com/Aniraku/Aniraku-App/blob/main/${doc}`),
    `docs grid links ${doc}`,
  );
}
assert.ok(!html.includes("docs.aniraku.tech"));
assert.ok(!html.includes("AGENTS.md"));

// ─── Release archive: latest expanded, older collapsed ───
assert.match(script, /ARCHIVE_VISIBLE = \d+/);
assert.ok(script.includes("archive-older"));
assert.ok(script.includes("data-archive-toggle"));
assert.ok(script.includes("release-foot"));
assert.ok(styles.includes(".archive-older"));
assert.ok(styles.includes(".archive-toggle"));
assert.ok(styles.includes(".release-foot"));
assert.ok(styles.includes(".release-badge-old"));

console.log("Download-site support + docs + archive checks passed.");
