const { withAppBuildGradle, withGradleProperties } = require("expo/config-plugins");

/**
 * Forces a universal APK with both armeabi-v7a (32-bit) and arm64-v8a (64-bit).
 * Without this, Expo may only ship arm64, which crashes on 32-bit devices
 * like MediaTek Helio G35.
 */
module.exports = function withUniversalApk(config) {
  config = withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;

    // 1. Inject ndk.abiFilters into defaultConfig
    if (!src.includes('abiFilters')) {
      // Match defaultConfig { and inject ndk block right after the opening brace
      src = src.replace(
        /(defaultConfig\s*\{)/,
        `$1\n            ndk {\n                abiFilters "armeabi-v7a", "arm64-v8a"\n            }`
      );
    }

    // 2. Remove any splits block that enables ABI splitting
    src = src.replace(
      /splits\s*\{[\s\S]*?abi\s*\{[\s\S]*?enable\s+true[\s\S]*?\}[\s\S]*?\}/,
      `splits {\n        abi {\n            enable false\n            universalApk true\n        }\n    }`
    );

    // 3. If no splits block exists, add one
    if (!src.includes('splits')) {
      src += `
    splits {
        abi {
            enable false
            universalApk true
        }
    }`;
    }

    // 4. Ensure universalApk is true in any existing abi block
    src = src.replace(
      /(abi\s*\{[^}]*enable\s+false[^}]*)/,
      `$1\n            universalApk true`
    );

    cfg.modResults.contents = src;
    return cfg;
  });

  config = withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    // Remove any property that forces single ABI
    const filtered = props.filter(
      (p) => !(p.type === "property" && p.key === "react.native.archs")
    );
    filtered.push({
      type: "property",
      key: "react.native.archs",
      value: "arm64-v8a,armeabi-v7a",
    });
    filtered.push({
      type: "property",
      key: "android.enableSplit",
      value: "false",
    });
    cfg.modResults = filtered;
    return cfg;
  });

  return config;
};
