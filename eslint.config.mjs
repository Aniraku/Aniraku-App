// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

export default defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Supabase Edge Functions run on Deno and import from `jsr:` URLs, which
    // the Node-based import resolver cannot resolve — silence only that rule
    // there so the rest of the file still lints.
    files: ["supabase/functions/**/*.{ts,js}"],
    rules: {
      "import/no-unresolved": "off",
    },
  },
]);
