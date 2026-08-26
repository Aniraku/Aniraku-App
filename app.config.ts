import type { ExpoConfig } from "expo/config";

const env = {
  appName: "Aniraku",
  appSlug: "aniraku",
  logoUrl: "/manus-storage/icon_cc474f8c.png",
  scheme: "aniraku",
  iosBundleId: "tech.aniraku.app",
  androidPackage: "aniraku.anime.app",
  easProjectId: "e96fc02e-d968-4f13-a688-0d553d855df7",
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "4.7.Beta",
  orientation: "default",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "dark",
  // SDK 54 is the final Expo release that supports the proven legacy RN
  // architecture. Use it for the compatibility build after the new-architecture
  // APK terminated immediately on a Snapdragon 680 device.
  newArchEnabled: false,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    versionCode: 42,
    adaptiveIcon: { backgroundColor: "#090909", foregroundImage: "./assets/images/android-icon-foreground.png" },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS", "REQUEST_INSTALL_PACKAGES"],
    intentFilters: [{ action: "VIEW", autoVerify: true, data: [{ scheme: env.scheme, host: "auth" }], category: ["BROWSABLE", "DEFAULT"] }],
  },
  web: { bundler: "metro", output: "static", favicon: "./assets/images/favicon.png" },
  plugins: [
    "expo-router",
    "expo-asset",
    "expo-audio",
    "expo-font",
    "expo-web-browser",
    ["expo-screen-orientation", { initialOrientation: "DEFAULT" }],
    ["expo-secure-store", { configureAndroidBackup: true }],
    ["expo-video", { supportsBackgroundPlayback: true, supportsPictureInPicture: true }],
    ["expo-splash-screen", { image: "./assets/images/splash-icon.png", imageWidth: 200, resizeMode: "contain", backgroundColor: "#090909", dark: { backgroundColor: "#090909" } }],
    ["expo-build-properties", { android: { buildArchs: ["armeabi-v7a", "arm64-v8a"], minSdkVersion: 28 } }],
  ],
  // Keep file-route typing, but remove optional compiler/runtime experiments
  // from the compatibility build's startup path.
  experiments: { typedRoutes: true },
  extra: { eas: { projectId: env.easProjectId } },
};

export default config;
