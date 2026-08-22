import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, script, styles] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./app.js", import.meta.url), "utf8"),
  readFile(new URL("./app.css", import.meta.url), "utf8"),
]);

const patreon = "https://patreon.com/ShoIslam";
const address = "0x0dc085fc880f2f67b4e200f125bc0de352da904e";

assert.ok(html.includes(patreon));
assert.ok(html.includes(address));
assert.ok(html.includes("BNB SMART CHAIN (BEP20) ONLY"));
assert.ok(html.includes("data-support-prompt"));
assert.ok(html.includes("ASK AGAIN IN 7 DAYS"));
assert.match(script, /SUPPORT_PROMPT_ACTIVE_MS = 30 \* 60 \* 1000/);
assert.match(script, /SUPPORT_PROMPT_DISMISS_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
assert.match(script, /querySelectorAll\("\[data-copy-support\]"\)/);
assert.ok(styles.includes(".support-prompt"));
assert.ok(styles.includes(".support-crypto"));
console.log("Download-site support checks passed.");
