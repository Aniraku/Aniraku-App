const { withAppBuildGradle, withGradleProperties } = require("expo/config-plugins");

/**
 * Ensures the APK is a universal build containing both armeabi-v7a (32-bit)
 * and arm64-v8a (64-bit) native libraries. Without this, devices like the
 * MediaTek Helio G35 (32-bit only) crash instantly on startup because
 * the APK is missing 32-bit .so files.
 */
module.exports = function withUniversalApk(config) {
  // Force both ABIs in the generated build.gradle
  config = withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes("abiFilters")) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /defaultConfig\s*\{/,
        `defaultConfig {\n        ndk {\n            abiFilters "armeabi-v7a", "arm64-v8a"\n        }`
      );
    }
    // Disable ABI splits to produce a single universal APK
    if (!cfg.modResults.contents.includes("splits")) {
      cfg.modResults.contents += `
android {
    splits {
        abi {
            enable false
        }
    }
}`;
    }
    return cfg;
  });

  // Ensure both ABIs are built
  config = withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    // Remove any property that forces single ABI
    props.push({
      type: "property",
      key: "react.native.archs",
      value: "arm64-v8a,armeabi-v7a",
    });
    return cfg;
  });

  return config;
};
