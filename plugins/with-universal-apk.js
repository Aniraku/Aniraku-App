const { withAppBuildGradle, withGradleProperties } = require("expo/config-plugins");

/**
 * Forces a universal APK with both armeabi-v7a (32-bit) and arm64-v8a (64-bit).
 * Only injects ndk.abiFilters into defaultConfig — does NOT add splits block
 * (splits must be inside android {}, appending outside breaks the build).
 */
module.exports = function withUniversalApk(config) {
  config = withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;

    // Remove any existing ndk block to avoid duplicates
    src = src.replace(/ndk\s*\{[^}]*\}\s*/g, "");

    // Inject ndk block with both ABIs into defaultConfig
    if (!src.includes("abiFilters")) {
      src = src.replace(
        /(defaultConfig\s*\{)/,
        `$1\n            ndk {\n                abiFilters "armeabi-v7a", "arm64-v8a"\n            }`
      );
    }

    cfg.modResults.contents = src;
    return cfg;
  });

  config = withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
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
